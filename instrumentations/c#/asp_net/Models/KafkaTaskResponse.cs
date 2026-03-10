namespace PasswordApi.Models;

/// <summary>
/// Retorno da publicação no Kafka.
/// </summary>
public class KafkaTaskResponse
{
    /// <summary>
    /// ID derivado de topic-partition-offset.
    /// </summary>
    public string TaskId { get; set; } = string.Empty;

    /// <summary>
    /// Tópico utilizado.
    /// </summary>
    public string Topic { get; set; } = string.Empty;

    /// <summary>
    /// Partição em que a mensagem foi gravada.
    /// </summary>
    public int Partition { get; set; }

    /// <summary>
    /// Offset gerado.
    /// </summary>
    public long Offset { get; set; }

    /// <summary>
    /// Data de criação da task.
    /// </summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
