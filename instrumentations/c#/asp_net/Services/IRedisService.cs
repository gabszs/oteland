namespace PasswordApi.Services;

/// <summary>
/// Interface para o serviço de Redis
/// </summary>
public interface IRedisService
{
    /// <summary>
    /// Obtém um valor do Redis
    /// </summary>
    Task<string?> GetAsync(string key);

    /// <summary>
    /// Define um valor no Redis
    /// </summary>
    Task SetAsync(string key, string value, TimeSpan? expiry = null);

    /// <summary>
    /// Deleta uma chave do Redis
    /// </summary>
    Task DeleteAsync(string key);

    /// <summary>
    /// Verifica se uma chave existe no Redis
    /// </summary>
    Task<bool> ExistsAsync(string key);
}
