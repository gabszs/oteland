namespace PasswordApi.Models;

/// <summary>
/// Payload para envio de mensagens ao Kafka.
/// </summary>
public class KafkaMessageRequest
{
    /// <summary>
    /// Mensagem a ser publicada.
    /// </summary>
    public string Message { get; set; } = string.Empty;
}
