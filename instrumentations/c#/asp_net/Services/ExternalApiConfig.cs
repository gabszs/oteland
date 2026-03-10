namespace PasswordApi.Services;

/// <summary>
/// Configuração da API externa
/// </summary>
public class ExternalApiConfig
{
    /// <summary>
    /// URL base da API externa
    /// </summary>
    public string BaseUrl { get; set; } = string.Empty;

    /// <summary>
    /// URL da API externa protegida
    /// </summary>
    public string ProtectedBaseUrl { get; set; } = string.Empty;
}
