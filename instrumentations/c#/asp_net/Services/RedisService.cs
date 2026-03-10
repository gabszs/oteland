using StackExchange.Redis;

namespace PasswordApi.Services;

public class RedisService : IRedisService
{
    private readonly IConnectionMultiplexer _redis;
    private readonly IDatabase _db;

    public RedisService(IConnectionMultiplexer redis)
    {
        _redis = redis;
        _db = redis.GetDatabase();
    }

    public async Task<string?> GetAsync(string key)
    {
        var value = await _db.StringGetAsync(key);
        return value.IsNullOrEmpty ? null : value.ToString();
    }

    public async Task SetAsync(string key, string value, TimeSpan? expiry = null)
    {
        await _db.StringSetAsync(key, value, expiry);
    }

    public async Task DeleteAsync(string key)
    {
        await _db.KeyDeleteAsync(key);
    }

    public async Task<bool> ExistsAsync(string key)
    {
        return await _db.KeyExistsAsync(key);
    }
}
