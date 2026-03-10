namespace PasswordApi.Services;

/// <summary>
/// Interface para o serviço de gerenciamento de senhas
/// </summary>
public interface IPasswordService
{
    /// <summary>
    /// Gera senhas localmente
    /// </summary>
    Task<PasswordResponse> GeneratePasswordsAsync(int passwordLength, int quantity, bool hasPunctuation);

    /// <summary>
    /// Gera senhas localmente sem usar cache
    /// </summary>
    Task<PasswordResponse> GeneratePasswordsWithoutCacheAsync(int passwordLength, int quantity, bool hasPunctuation);

    /// <summary>
    /// Obtém senhas da API externa
    /// </summary>
    Task<PasswordResponse> GetPasswordsFromExternalApiAsync(int passwordLength, int quantity, bool hasPunctuation);

    /// <summary>
    /// Obtém senhas da API externa protegida com cache Redis
    /// </summary>
    Task<PasswordResponse> GetProtectedPasswordsWithCacheAsync(int passwordLength, int quantity, bool hasPunctuation, string authorizationHeader);
}

/// <summary>
/// Resposta contendo senhas geradas
/// </summary>
public class PasswordResponse
{
    /// <summary>
    /// Lista de senhas geradas
    /// </summary>
    public List<string> Passwords { get; set; } = new();

    /// <summary>
    /// Fonte das senhas (local ou external)
    /// </summary>
    public string Source { get; set; } = string.Empty;

    /// <summary>
    /// Data e hora de geração
    /// </summary>
    public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;
}
