using Microsoft.AspNetCore.Mvc;
using PasswordApi.Models;
using PasswordApi.Services;
using Swashbuckle.AspNetCore.Annotations;
using System.Diagnostics;

namespace PasswordApi.Controllers;

/// <summary>
/// Controlador para gerenciamento de senhas - API v1
/// </summary>
[ApiController]
[Route("v1")]
public class V1PasswordController : ControllerBase
{
    private readonly IPasswordService _passwordService;
    private readonly IKafkaProducerService _kafkaProducerService;
    private readonly ILogger<V1PasswordController> _logger;

    public V1PasswordController(
        IPasswordService passwordService,
        IKafkaProducerService kafkaProducerService,
        ILogger<V1PasswordController> logger)
    {
        _passwordService = passwordService;
        _kafkaProducerService = kafkaProducerService;
        _logger = logger;
    }

    /// <summary>
    /// Gera senhas localmente com cache Redis
    /// </summary>
    /// <remarks>
    /// Gera senhas aleatórias localmente e as armazena em cache Redis por 1 hora.
    /// </remarks>
    /// <returns>Lista de senhas geradas com metadados</returns>
    /// <response code="200">Senhas geradas com sucesso</response>
    /// <response code="400">Parâmetros inválidos</response>
    /// <response code="500">Erro interno do servidor</response>
    [HttpGet("cache/generate")]
    [SwaggerOperation(
        Summary = "Gerar senhas localmente",
        Description = "Gera senhas aleatórias localmente com suporte a cache Redis",
        Tags = new[] { "cached" }
    )]
    public async Task<ActionResult<PasswordResponse>> GeneratePasswords(
        [FromQuery(Name = "password_length")] int passwordLength = 12,
        [FromQuery(Name = "quantity")] int quantity = 10,
        [FromQuery(Name = "has_punctuation")] bool hasPunctuation = true)
    {
        var traceId = Activity.Current?.TraceId.ToString() ?? string.Empty;
        var spanId = Activity.Current?.SpanId.ToString() ?? string.Empty;
        _logger.LogInformation(
            $"Route=v1/cache/generate called with password_length={passwordLength}, quantity={quantity}, has_punctuation={hasPunctuation}, otel_trace_id={traceId}, otel_span_id={spanId}");

        if (passwordLength < 4 || passwordLength > 128)
            return BadRequest(new ErrorResponse 
            { 
                Message = "Password length must be between 4 and 128",
                Code = "INVALID_PASSWORD_LENGTH"
            });

        if (quantity < 1 || quantity > 100)
            return BadRequest(new ErrorResponse 
            { 
                Message = "Quantity must be between 1 and 100",
                Code = "INVALID_QUANTITY"
            });

        _logger.LogInformation("Generating {Quantity} passwords of length {Length}", quantity, passwordLength);
        var result = await _passwordService.GeneratePasswordsAsync(passwordLength, quantity, hasPunctuation);
        return Ok(result);
    }

    /// <summary>
    /// Gera senhas localmente sem cache
    /// </summary>
    /// <remarks>
    /// Gera senhas aleatórias localmente sem salvar ou buscar no Redis.
    /// </remarks>
    /// <returns>Lista de senhas geradas com metadados</returns>
    /// <response code="200">Senhas geradas com sucesso</response>
    /// <response code="400">Parâmetros inválidos</response>
    [HttpGet("generate")]
    [SwaggerOperation(
        Summary = "Gerar senhas localmente sem cache",
        Description = "Gera senhas aleatórias localmente sem usar cache Redis",
        Tags = new[] { "default" }
    )]
    public async Task<ActionResult<PasswordResponse>> GeneratePasswordsNoCache(
        [FromQuery(Name = "password_length")] int passwordLength = 12,
        [FromQuery(Name = "quantity")] int quantity = 10,
        [FromQuery(Name = "has_punctuation")] bool hasPunctuation = true)
    {
        var traceId = Activity.Current?.TraceId.ToString() ?? string.Empty;
        var spanId = Activity.Current?.SpanId.ToString() ?? string.Empty;
        _logger.LogInformation(
            $"Route=v1/generate called with password_length={passwordLength}, quantity={quantity}, has_punctuation={hasPunctuation}, otel_trace_id={traceId}, otel_span_id={spanId}");

        if (passwordLength < 4 || passwordLength > 128)
            return BadRequest(new ErrorResponse
            {
                Message = "Password length must be between 4 and 128",
                Code = "INVALID_PASSWORD_LENGTH"
            });

        if (quantity < 1 || quantity > 100)
            return BadRequest(new ErrorResponse
            {
                Message = "Quantity must be between 1 and 100",
                Code = "INVALID_QUANTITY"
            });

        _logger.LogInformation("Generating {Quantity} passwords without cache", quantity);
        var result = await _passwordService.GeneratePasswordsWithoutCacheAsync(passwordLength, quantity, hasPunctuation);
        return Ok(result);
    }

    /// <summary>
    /// Obtém senhas da API externa com cache Redis
    /// </summary>
    /// <remarks>
    /// Chama a API externa configurada para obter senhas e as armazena em cache Redis por 1 hora.
    /// </remarks>
    /// <returns>Lista de senhas da API externa com metadados</returns>
    /// <response code="200">Senhas obtidas com sucesso</response>
    /// <response code="400">Parâmetros inválidos</response>
    /// <response code="500">Erro ao chamar API externa ou erro interno</response>
    [HttpGet("external/generate")]
    [SwaggerOperation(
        Summary = "Obter senhas da API externa",
        Description = "Chama a API externa configurada para obter senhas com suporte a cache Redis",
        Tags = new[] { "external", "cached" }
    )]
    public async Task<ActionResult<PasswordResponse>> GetFromExternalApi(
        [FromQuery(Name = "password_length")] int passwordLength = 12,
        [FromQuery(Name = "quantity")] int quantity = 10,
        [FromQuery(Name = "has_punctuation")] bool hasPunctuation = true)
    {
        var traceId = Activity.Current?.TraceId.ToString() ?? string.Empty;
        var spanId = Activity.Current?.SpanId.ToString() ?? string.Empty;
        _logger.LogInformation(
            $"Route=v1/external/generate called with password_length={passwordLength}, quantity={quantity}, has_punctuation={hasPunctuation}, otel_trace_id={traceId}, otel_span_id={spanId}");

        if (passwordLength < 4 || passwordLength > 128)
            return BadRequest(new ErrorResponse 
            { 
                Message = "Password length must be between 4 and 128",
                Code = "INVALID_PASSWORD_LENGTH"
            });

        if (quantity < 1 || quantity > 100)
            return BadRequest(new ErrorResponse 
            { 
                Message = "Quantity must be between 1 and 100",
                Code = "INVALID_QUANTITY"
            });

        try
        {
            _logger.LogInformation("Fetching {Quantity} passwords from external API", quantity);
            var result = await _passwordService.GetPasswordsFromExternalApiAsync(passwordLength, quantity, hasPunctuation);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch passwords from external API");
            return StatusCode(StatusCodes.Status502BadGateway, new ErrorResponse
            {
                Message = "Failed to fetch passwords from external API",
                Code = "EXTERNAL_API_ERROR"
            });
        }
    }

    /// <summary>
    /// Obtém senhas da API externa protegida com cache Redis
    /// </summary>
    /// <remarks>
    /// Encaminha o header Authorization recebido para a API externa protegida e armazena o resultado em cache.
    /// </remarks>
    /// <returns>Lista de senhas da API protegida com metadados</returns>
    /// <response code="200">Senhas obtidas com sucesso</response>
    /// <response code="400">Parâmetros inválidos</response>
    /// <response code="401">Authorization header ausente</response>
    /// <response code="500">Erro ao chamar API externa protegida</response>
    [HttpGet("cache/protected/generate")]
    [SwaggerOperation(
        Summary = "Obter senhas da API externa protegida com cache",
        Description = "Repassa o token Bearer para API externa protegida e cacheia o resultado no Redis",
        Tags = new[] { "cached", "protected" }
    )]
    public async Task<ActionResult<PasswordResponse>> GetFromProtectedExternalApiWithCache(
        [FromQuery(Name = "password_length")] int passwordLength = 12,
        [FromQuery(Name = "quantity")] int quantity = 10,
        [FromQuery(Name = "has_punctuation")] bool hasPunctuation = true)
    {
        var traceId = Activity.Current?.TraceId.ToString() ?? string.Empty;
        var spanId = Activity.Current?.SpanId.ToString() ?? string.Empty;
        var authorization = Request.Headers.Authorization.ToString();
        _logger.LogInformation(
            $"Route=v1/cache/protected/generate called with password_length={passwordLength}, quantity={quantity}, has_punctuation={hasPunctuation}, has_authorization={!string.IsNullOrWhiteSpace(authorization)}, otel_trace_id={traceId}, otel_span_id={spanId}");

        if (passwordLength < 4 || passwordLength > 128)
            return BadRequest(new ErrorResponse
            {
                Message = "Password length must be between 4 and 128",
                Code = "INVALID_PASSWORD_LENGTH"
            });

        if (quantity < 1 || quantity > 100)
            return BadRequest(new ErrorResponse
            {
                Message = "Quantity must be between 1 and 100",
                Code = "INVALID_QUANTITY"
            });

        if (string.IsNullOrWhiteSpace(authorization))
        {
            return Unauthorized(new ErrorResponse
            {
                Message = "Authorization header is required",
                Code = "MISSING_AUTHORIZATION"
            });
        }

        try
        {
            var result = await _passwordService.GetProtectedPasswordsWithCacheAsync(passwordLength, quantity, hasPunctuation, authorization);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch passwords from protected external API");
            return StatusCode(StatusCodes.Status502BadGateway, new ErrorResponse
            {
                Message = "Failed to fetch passwords from protected external API",
                Code = "PROTECTED_EXTERNAL_API_ERROR"
            });
        }
    }

    /// <summary>
    /// Verifica a saúde da API
    /// </summary>
    /// <remarks>
    /// Endpoint para verificar se a API está funcionando corretamente.
    /// </remarks>
    /// <returns>Status de saúde da API</returns>
    /// <response code="200">API está saudável</response>
    [HttpGet("health")]
    [SwaggerOperation(
        Summary = "Health check",
        Description = "Verifica se a API está funcionando corretamente",
        Tags = new[] { "default" }
    )]
    public ActionResult<HealthResponse> Health()
    {
        var traceId = Activity.Current?.TraceId.ToString() ?? string.Empty;
        var spanId = Activity.Current?.SpanId.ToString() ?? string.Empty;
        _logger.LogInformation(
            $"Route=v1/health called with user_agent={Request.Headers.UserAgent}, otel_trace_id={traceId}, otel_span_id={spanId}");

        return Ok(new HealthResponse 
        { 
            Status = "healthy",
            Timestamp = DateTime.UtcNow,
            Version = "1.0.0"
        });
    }

    /// <summary>
    /// Cria uma task e publica a mensagem no Kafka.
    /// </summary>
    /// <remarks>
    /// Publica uma mensagem em um tópico Kafka e retorna o ID no formato topic-partition-offset.
    /// </remarks>
    /// <response code="200">Mensagem enviada com sucesso</response>
    /// <response code="400">Payload inválido</response>
    /// <response code="502">Falha ao publicar no Kafka</response>
    [HttpPost("kafka/publish")]
    [SwaggerOperation(
        Summary = "Publicar task no Kafka",
        Description = "Publica mensagem no Kafka (topic e key definidos por configuração interna) e retorna task_id no formato topic-partition-offset",
        Tags = new[] { "kafka" }
    )]
    public async Task<ActionResult<KafkaTaskResponse>> PublishKafkaTask([FromBody] KafkaMessageRequest request, CancellationToken cancellationToken)
    {
        if (request is null)
        {
            return BadRequest(new ErrorResponse
            {
                Message = "Request body is required",
                Code = "INVALID_REQUEST"
            });
        }

        if (string.IsNullOrWhiteSpace(request.Message))
        {
            return BadRequest(new ErrorResponse
            {
                Message = "Message is required",
                Code = "INVALID_MESSAGE"
            });
        }

        try
        {
            var result = await _kafkaProducerService.PublishAsync(request.Message, cancellationToken);

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to publish message to Kafka");
            return StatusCode(StatusCodes.Status502BadGateway, new ErrorResponse
            {
                Message = "Failed to publish message to Kafka",
                Code = "KAFKA_PUBLISH_ERROR"
            });
        }
    }

    /// <summary>
    /// Lista tasks disponíveis na fila Kafka.
    /// </summary>
    /// <remarks>
    /// Retorna as tasks mais recentes no tópico padrão, com ID no formato topic-partition-offset.
    /// </remarks>
    /// <response code="200">Tasks retornadas com sucesso</response>
    /// <response code="400">Limite inválido</response>
    /// <response code="502">Falha ao consultar Kafka</response>
    [HttpGet("kafka/tasks")]
    [SwaggerOperation(
        Summary = "Listar tasks na fila Kafka",
        Description = "Lista tasks pendentes no tópico Kafka padrão",
        Tags = new[] { "kafka" }
    )]
    public async Task<ActionResult<KafkaTasksQueueResponse>> ListKafkaTasks(
        [FromQuery] int limit = 50,
        CancellationToken cancellationToken = default)
    {
        if (limit < 1 || limit > 500)
        {
            return BadRequest(new ErrorResponse
            {
                Message = "Limit must be between 1 and 500",
                Code = "INVALID_LIMIT"
            });
        }

        try
        {
            var result = await _kafkaProducerService.ListTasksAsync(limit, cancellationToken);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to list tasks from Kafka");
            return StatusCode(StatusCodes.Status502BadGateway, new ErrorResponse
            {
                Message = "Failed to list tasks from Kafka",
                Code = "KAFKA_LIST_TASKS_ERROR"
            });
        }
    }
}

/// <summary>
/// Resposta de saúde da API
/// </summary>
public class HealthResponse
{
    /// <summary>
    /// Status da API
    /// </summary>
    public string Status { get; set; } = string.Empty;

    /// <summary>
    /// Timestamp da verificação
    /// </summary>
    public DateTime Timestamp { get; set; }

    /// <summary>
    /// Versão da API
    /// </summary>
    public string Version { get; set; } = string.Empty;
}

/// <summary>
/// Resposta de erro
/// </summary>
public class ErrorResponse
{
    /// <summary>
    /// Mensagem de erro
    /// </summary>
    public string Message { get; set; } = string.Empty;

    /// <summary>
    /// Código de erro
    /// </summary>
    public string Code { get; set; } = string.Empty;

    /// <summary>
    /// Timestamp do erro
    /// </summary>
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}
