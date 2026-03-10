using Confluent.Kafka;
using PasswordApi.Models;

namespace PasswordApi.Services;

public class KafkaProducerService : IKafkaProducerService, IDisposable
{
    private readonly ILogger<KafkaProducerService> _logger;
    private readonly IProducer<string?, string> _producer;
    private readonly IAdminClient _adminClient;
    private readonly IConsumer<Ignore, Ignore> _offsetConsumer;
    private readonly string _defaultTopic;
    private readonly string? _defaultMessageKey;

    public KafkaProducerService(IConfiguration configuration, ILogger<KafkaProducerService> logger)
    {
        _logger = logger;

        var bootstrapServers = Environment.GetEnvironmentVariable("KAFKA_BOOTSTRAP_SERVERS")
            ?? configuration["Kafka:BootstrapServers"];
        _defaultTopic = Environment.GetEnvironmentVariable("KAFKA_DEFAULT_TOPIC")
            ?? configuration["Kafka:DefaultTopic"]
            ?? "orders";
        _defaultMessageKey = Environment.GetEnvironmentVariable("KAFKA_DEFAULT_MESSAGE_KEY")
            ?? configuration["Kafka:DefaultMessageKey"];

        if (string.IsNullOrWhiteSpace(bootstrapServers))
        {
            throw new InvalidOperationException("Kafka bootstrap servers not configured. Set KAFKA_BOOTSTRAP_SERVERS or Kafka:BootstrapServers.");
        }

        if (string.IsNullOrWhiteSpace(_defaultTopic))
        {
            throw new InvalidOperationException("Kafka default topic not configured. Set KAFKA_DEFAULT_TOPIC or Kafka:DefaultTopic.");
        }

        var config = new ProducerConfig
        {
            BootstrapServers = bootstrapServers,
            ClientId = Environment.MachineName
        };

        _producer = new ProducerBuilder<string?, string>(config).Build();
        _adminClient = new AdminClientBuilder(new AdminClientConfig
        {
            BootstrapServers = bootstrapServers
        }).Build();
        _offsetConsumer = new ConsumerBuilder<Ignore, Ignore>(new ConsumerConfig
        {
            BootstrapServers = bootstrapServers,
            GroupId = $"kafka-inspector-{Guid.NewGuid():N}",
            EnableAutoCommit = false,
            AllowAutoCreateTopics = false
        }).Build();
    }

    public async Task<KafkaTaskResponse> PublishAsync(string message, CancellationToken cancellationToken = default)
    {
        var delivery = await _producer.ProduceAsync(_defaultTopic, new Message<string?, string>
        {
            Key = _defaultMessageKey,
            Value = message
        }, cancellationToken);

        var taskId = $"{delivery.Topic}-{delivery.Partition.Value}-{delivery.Offset.Value}";

        _logger.LogInformation(
            "Kafka message sent. topic={Topic}, partition={Partition}, offset={Offset}, task_id={TaskId}",
            delivery.Topic,
            delivery.Partition.Value,
            delivery.Offset.Value,
            taskId);

        return new KafkaTaskResponse
        {
            TaskId = taskId,
            Topic = delivery.Topic,
            Partition = delivery.Partition.Value,
            Offset = delivery.Offset.Value
        };
    }

    public Task<KafkaTasksQueueResponse> ListTasksAsync(int limit = 50, CancellationToken cancellationToken = default)
    {
        var safeLimit = Math.Clamp(limit, 1, 500);
        var metadata = _adminClient.GetMetadata(_defaultTopic, TimeSpan.FromSeconds(5));
        var topicMetadata = metadata.Topics.FirstOrDefault(t => t.Topic == _defaultTopic);

        if (topicMetadata is null || topicMetadata.Error.IsError)
        {
            throw new InvalidOperationException($"Kafka topic '{_defaultTopic}' not available.");
        }

        var taskCandidates = new List<KafkaQueuedTaskItem>();
        long totalPending = 0;

        foreach (var partitionMetadata in topicMetadata.Partitions)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var partition = partitionMetadata.PartitionId;
            var topicPartition = new TopicPartition(_defaultTopic, new Partition(partition));
            var watermarks = _offsetConsumer.QueryWatermarkOffsets(topicPartition, TimeSpan.FromSeconds(5));
            var low = watermarks.Low.Value;
            var high = watermarks.High.Value;
            var pending = Math.Max(0, high - low);
            totalPending += pending;

            var takeFromPartition = (int)Math.Min(safeLimit, pending);
            for (var i = 0; i < takeFromPartition; i++)
            {
                var offset = high - 1 - i;
                taskCandidates.Add(new KafkaQueuedTaskItem
                {
                    TaskId = $"{_defaultTopic}-{partition}-{offset}",
                    Topic = _defaultTopic,
                    Partition = partition,
                    Offset = offset
                });
            }
        }

        var tasks = taskCandidates
            .OrderByDescending(x => x.Offset)
            .ThenBy(x => x.Partition)
            .Take(safeLimit)
            .ToList();

        return Task.FromResult(new KafkaTasksQueueResponse
        {
            Topic = _defaultTopic,
            TotalPending = totalPending,
            Returned = tasks.Count,
            Tasks = tasks
        });
    }

    public void Dispose()
    {
        _producer.Flush(TimeSpan.FromSeconds(5));
        _producer.Dispose();
        _offsetConsumer.Close();
        _offsetConsumer.Dispose();
        _adminClient.Dispose();
    }
}
