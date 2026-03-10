namespace PasswordApi.Models;

/// <summary>
/// Item de task presente na fila Kafka.
/// </summary>
public class KafkaQueuedTaskItem
{
    /// <summary>
    /// ID no formato topic-partition-offset.
    /// </summary>
    public string TaskId { get; set; } = string.Empty;

    /// <summary>
    /// Tópico.
    /// </summary>
    public string Topic { get; set; } = string.Empty;

    /// <summary>
    /// Partição.
    /// </summary>
    public int Partition { get; set; }

    /// <summary>
    /// Offset.
    /// </summary>
    public long Offset { get; set; }
}

/// <summary>
/// Resumo de tasks na fila Kafka.
/// </summary>
public class KafkaTasksQueueResponse
{
    /// <summary>
    /// Tópico consultado.
    /// </summary>
    public string Topic { get; set; } = string.Empty;

    /// <summary>
    /// Total aproximado de mensagens pendentes no tópico.
    /// </summary>
    public long TotalPending { get; set; }

    /// <summary>
    /// Quantidade retornada nesta resposta.
    /// </summary>
    public int Returned { get; set; }

    /// <summary>
    /// Lista de tasks retornadas.
    /// </summary>
    public List<KafkaQueuedTaskItem> Tasks { get; set; } = new();

    /// <summary>
    /// Momento da consulta.
    /// </summary>
    public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;
}
