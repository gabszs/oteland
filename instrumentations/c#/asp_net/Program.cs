using StackExchange.Redis;
using PasswordApi.Services;
using PasswordApi.Controllers;
using Microsoft.OpenApi.Models;
using System.Reflection;
using System.Diagnostics;

var builder = WebApplication.CreateBuilder(args);

// Add services
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Password API",
        Version = "v1",
        Description = "API para geração e gerenciamento de senhas com suporte a Redis e integração com API externa",
        Contact = new OpenApiContact
        {
            Name = "Gabriel Carvalho",
            Url = new Uri("https://gabrielcarvalho.dev")
        },
        License = new OpenApiLicense
        {
            Name = "MIT",
            Url = new Uri("https://opensource.org/licenses/MIT")
        }
    });

    // Incluir comentários XML
    var xmlFile = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    if (File.Exists(xmlPath))
    {
        options.IncludeXmlComments(xmlPath);
    }

    // JWT Bearer para habilitar Authorize/cadeado no Swagger UI.
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        Description = "Informe apenas o token JWT. Exemplo: eyJ..."
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            new string[] { }
        }
    });

    // Ordenar endpoints por tag
    options.OrderActionsBy(x => x.RelativePath);
});

// Redis configuration
var redisConnection = Environment.GetEnvironmentVariable("REDIS_CONNECTION_STRING")
    ?? builder.Configuration["Redis:ConnectionString"]
    ?? "localhost:6379";
var redisOptions = ConfigurationOptions.Parse(redisConnection);
redisOptions.AbortOnConnectFail = false;
redisOptions.ConnectRetry = 5;
redisOptions.ConnectTimeout = 5000;
builder.Services.AddSingleton<IConnectionMultiplexer>(ConnectionMultiplexer.Connect(redisOptions));

// External API configuration
var externalApiUrl = Environment.GetEnvironmentVariable("EXTERNAL_API_URL")
    ?? builder.Configuration["ExternalApi:BaseUrl"]
    ?? "https://password.gabrielcarvalho.dev";
var protectedExternalApiUrl = Environment.GetEnvironmentVariable("PROTECTED_EXTERNAL_API_URL")
    ?? builder.Configuration["ExternalApi:ProtectedBaseUrl"]
    ?? "https://auth-fastapi.gabrielcarvalho.dev/v1/passwords/protected";

builder.Services.AddSingleton(new ExternalApiConfig
{
    BaseUrl = externalApiUrl,
    ProtectedBaseUrl = protectedExternalApiUrl
});

// Services
builder.Services.AddScoped<IRedisService, RedisService>();
builder.Services.AddScoped<IPasswordService, PasswordService>();
builder.Services.AddSingleton<IKafkaProducerService, KafkaProducerService>();
builder.Services.AddHttpClient();

var app = builder.Build();

app.Use(async (context, next) =>
{
    context.Response.OnStarting(() =>
    {
        var traceId = Activity.Current?.TraceId.ToString();
        if (!string.IsNullOrWhiteSpace(traceId))
        {
            context.Response.Headers["otel-trace-id"] = traceId;
        }

        return Task.CompletedTask;
    });

    await next();
});

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/swagger/v1/swagger.json", "Password API v1");
        options.RoutePrefix = "swagger";
        options.DefaultModelsExpandDepth(2);
        options.DefaultModelExpandDepth(2);
        options.DocExpansion(Swashbuckle.AspNetCore.SwaggerUI.DocExpansion.List);
        options.DisplayOperationId();
    });
}
else
{
    app.UseSwagger();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/swagger/v1/swagger.json", "Password API v1");
        options.RoutePrefix = "swagger";
    });
}

app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();

app.Run();
