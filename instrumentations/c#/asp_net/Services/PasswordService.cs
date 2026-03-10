using System.Text.Json;
using System.Security.Cryptography;
using System.Text;

namespace PasswordApi.Services;

public class PasswordService : IPasswordService
{
    private readonly IRedisService _redisService;
    private readonly HttpClient _httpClient;
    private readonly ExternalApiConfig _apiConfig;
    private readonly ILogger<PasswordService> _logger;
    private readonly TimeSpan _localCacheTtl;

    public PasswordService(
        IRedisService redisService,
        HttpClient httpClient,
        ExternalApiConfig apiConfig,
        ILogger<PasswordService> logger)
    {
        _redisService = redisService;
        _httpClient = httpClient;
        _apiConfig = apiConfig;
        _logger = logger;

        var ttlRaw = Environment.GetEnvironmentVariable("CACHE_TTL_SECONDS");
        if (!int.TryParse(ttlRaw, out var ttlSeconds) || ttlSeconds <= 0)
        {
            ttlSeconds = 5;
        }

        _localCacheTtl = TimeSpan.FromSeconds(ttlSeconds);
    }

    public async Task<PasswordResponse> GeneratePasswordsAsync(int passwordLength, int quantity, bool hasPunctuation)
    {
        var cacheKey = $"passwords:{passwordLength}:{quantity}:{hasPunctuation}";
        
        // Try to get from cache
        var cached = await _redisService.GetAsync(cacheKey);
        if (cached != null)
        {
            _logger.LogInformation("Password retrieved from cache");
            return JsonSerializer.Deserialize<PasswordResponse>(cached) ?? new PasswordResponse();
        }

        // Cache miss: fetch from external API to generate outbound HTTP spans.
        var punctuationValue = hasPunctuation.ToString().ToLowerInvariant();
        var url = $"{_apiConfig.BaseUrl}/v1/?password_length={passwordLength}&quantity={quantity}&has_punctuation={punctuationValue}";
        var externalResponse = await _httpClient.GetAsync(url);
        externalResponse.EnsureSuccessStatusCode();

        var content = await externalResponse.Content.ReadAsStringAsync();
        var passwords = ParsePasswordsFromExternalResponse(content);
        var response = new PasswordResponse
        {
            Passwords = passwords,
            Source = "external-cached",
            GeneratedAt = DateTime.UtcNow
        };

        var json = JsonSerializer.Serialize(response);
        await _redisService.SetAsync(cacheKey, json, _localCacheTtl);

        return response;
    }

    public Task<PasswordResponse> GeneratePasswordsWithoutCacheAsync(int passwordLength, int quantity, bool hasPunctuation)
    {
        var passwords = GeneratePasswords(passwordLength, quantity, hasPunctuation);
        var response = new PasswordResponse
        {
            Passwords = passwords,
            Source = "local",
            GeneratedAt = DateTime.UtcNow
        };

        return Task.FromResult(response);
    }

    public async Task<PasswordResponse> GetPasswordsFromExternalApiAsync(int passwordLength, int quantity, bool hasPunctuation)
    {
        try
        {
            var punctuationValue = hasPunctuation.ToString().ToLowerInvariant();
            var url = $"{_apiConfig.BaseUrl}/v1/?password_length={passwordLength}&quantity={quantity}&has_punctuation={punctuationValue}";
            var response = await _httpClient.GetAsync(url);
            response.EnsureSuccessStatusCode();

            var content = await response.Content.ReadAsStringAsync();
            var passwords = ParsePasswordsFromExternalResponse(content);

            var result = new PasswordResponse
            {
                Passwords = passwords,
                Source = "external",
                GeneratedAt = DateTime.UtcNow
            };

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error calling external API");
            throw;
        }
    }

    public async Task<PasswordResponse> GetProtectedPasswordsWithCacheAsync(int passwordLength, int quantity, bool hasPunctuation, string authorizationHeader)
    {
        var tokenHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(authorizationHeader)));
        var cacheKey = $"protected_passwords:{passwordLength}:{quantity}:{hasPunctuation}:{tokenHash}";

        var cached = await _redisService.GetAsync(cacheKey);
        if (cached != null)
        {
            _logger.LogInformation("Password retrieved from protected API cache");
            return JsonSerializer.Deserialize<PasswordResponse>(cached) ?? new PasswordResponse();
        }

        try
        {
            var punctuationValue = hasPunctuation.ToString().ToLowerInvariant();
            var url = $"{_apiConfig.ProtectedBaseUrl}?password_length={passwordLength}&quantity={quantity}&has_punctuation={punctuationValue}";
            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.TryAddWithoutValidation("Authorization", authorizationHeader);
            request.Headers.TryAddWithoutValidation("accept", "application/json");

            var response = await _httpClient.SendAsync(request);
            response.EnsureSuccessStatusCode();

            var content = await response.Content.ReadAsStringAsync();
            var passwords = ParsePasswordsFromExternalResponse(content);

            var result = new PasswordResponse
            {
                Passwords = passwords,
                Source = "external-protected-cached",
                GeneratedAt = DateTime.UtcNow
            };

            var json = JsonSerializer.Serialize(result);
            await _redisService.SetAsync(cacheKey, json, _localCacheTtl);

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error calling protected external API");
            throw;
        }
    }

    private List<string> ParsePasswordsFromExternalResponse(string content)
    {
        using var document = JsonDocument.Parse(content);
        var root = document.RootElement;

        var passwords = ExtractPasswords(root);
        if (passwords.Count > 0)
        {
            return passwords;
        }

        _logger.LogWarning("Unsupported external API response format. Payload: {Payload}", content);
        throw new JsonException("Unsupported external API response format.");
    }

    private static List<string> ExtractPasswords(JsonElement element)
    {
        if (element.ValueKind == JsonValueKind.Array)
        {
            var directStrings = element.EnumerateArray()
                .Where(item => item.ValueKind == JsonValueKind.String)
                .Select(item => item.GetString())
                .Where(item => !string.IsNullOrWhiteSpace(item))
                .Cast<string>()
                .ToList();
            if (directStrings.Count > 0)
            {
                return directStrings;
            }

            var fromObjects = element.EnumerateArray()
                .Where(item => item.ValueKind == JsonValueKind.Object && item.TryGetProperty("password", out var password) && password.ValueKind == JsonValueKind.String)
                .Select(item => item.GetProperty("password").GetString())
                .Where(item => !string.IsNullOrWhiteSpace(item))
                .Cast<string>()
                .ToList();
            if (fromObjects.Count > 0)
            {
                return fromObjects;
            }

            foreach (var item in element.EnumerateArray())
            {
                var nested = ExtractPasswords(item);
                if (nested.Count > 0)
                {
                    return nested;
                }
            }
        }

        if (element.ValueKind == JsonValueKind.Object)
        {
            if (element.TryGetProperty("password", out var singlePassword) && singlePassword.ValueKind == JsonValueKind.String)
            {
                var value = singlePassword.GetString();
                if (!string.IsNullOrWhiteSpace(value))
                {
                    return new List<string> { value };
                }
            }

            var preferredProperties = new[] { "passwords", "data", "result", "values", "items" };
            foreach (var propertyName in preferredProperties)
            {
                if (element.TryGetProperty(propertyName, out var propertyValue))
                {
                    var fromProperty = ExtractPasswords(propertyValue);
                    if (fromProperty.Count > 0)
                    {
                        return fromProperty;
                    }
                }
            }

            foreach (var property in element.EnumerateObject())
            {
                var nested = ExtractPasswords(property.Value);
                if (nested.Count > 0)
                {
                    return nested;
                }
            }
        }

        return new List<string>();
    }

    private List<string> GeneratePasswords(int length, int quantity, bool hasPunctuation)
    {
        const string lowercase = "abcdefghijklmnopqrstuvwxyz";
        const string uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        const string digits = "0123456789";
        const string punctuation = "!@#$%^&*()_+-=[]{}|;:,.<>?";

        var chars = lowercase + uppercase + digits;
        if (hasPunctuation)
            chars += punctuation;

        var random = new Random();
        var passwords = new List<string>();

        for (int i = 0; i < quantity; i++)
        {
            var password = new string(Enumerable.Range(0, length)
                .Select(_ => chars[random.Next(chars.Length)])
                .ToArray());
            passwords.Add(password);
        }

        return passwords;
    }
}
