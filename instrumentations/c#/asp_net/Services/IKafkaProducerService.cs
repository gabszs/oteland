using PasswordApi.Models;

namespace PasswordApi.Services;

public interface IKafkaProducerService
{
    Task<KafkaTaskResponse> PublishAsync(string message, CancellationToken cancellationToken = default);
    Task<KafkaTasksQueueResponse> ListTasksAsync(int limit = 50, CancellationToken cancellationToken = default);
}
