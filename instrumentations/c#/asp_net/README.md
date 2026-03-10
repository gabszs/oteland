# Password API

API em C# para geração e gerenciamento de senhas com suporte a Redis e integração com API externa.

## Funcionalidades

- ✅ Geração local de senhas com cache Redis
- ✅ Integração com API externa de senhas
- ✅ Versionamento de API (v1)
- ✅ Validação de parâmetros
- ✅ Documentação Swagger
- ✅ Docker Compose para fácil deployment

## Requisitos

- Docker e Docker Compose
- .NET 8 SDK (para desenvolvimento local)

## Instalação e Execução

### Com Docker Compose

```bash
docker-compose up --build
```

A API estará disponível em `http://localhost:5000`

### Desenvolvimento Local

```bash
# Restaurar dependências
dotnet restore

# Executar
dotnet run
```

## Endpoints

### 1. Gerar Senhas Localmente

```bash
curl -X GET 'http://localhost:5000/v1/generate?password_length=12&quantity=10&has_punctuation=true' \
  -H 'accept: application/json'
```

**Parâmetros:**
- `password_length` (int): Comprimento da senha (4-128, padrão: 12)
- `quantity` (int): Quantidade de senhas (1-100, padrão: 10)
- `has_punctuation` (bool): Incluir pontuação (padrão: true)

**Resposta:**
```json
{
  "passwords": [
    "aB3!xY@pQ9#",
    "mN5$kL&wE2*"
  ],
  "source": "local",
  "generatedAt": "2026-03-03T10:30:00Z"
}
```

### 2. Obter Senhas da API Externa

```bash
curl -X GET 'http://localhost:5000/v1/external?password_length=12&quantity=10&has_punctuation=true' \
  -H 'accept: application/json'
```

**Parâmetros:** Mesmos do endpoint anterior

**Resposta:** Mesma estrutura, com `source: "external"`

### 3. Health Check

```bash
curl -X GET 'http://localhost:5000/v1/health' \
  -H 'accept: application/json'
```

## Variáveis de Ambiente

Configure no `docker-compose.yml`:

- `REDIS_CONNECTION_STRING`: Conexão Redis (padrão: `redis:6379`)
- `EXTERNAL_API_URL`: URL da API externa (padrão: `https://password.gabrielcarvalho.dev`)
- `ASPNETCORE_ENVIRONMENT`: Ambiente (Development/Production)

## Estrutura do Projeto

```
.
├── Controllers/
│   └── V1PasswordController.cs    # Endpoints da API v1
├── Services/
│   ├── IPasswordService.cs        # Interface do serviço de senhas
│   ├── PasswordService.cs         # Implementação do serviço
│   ├── IRedisService.cs           # Interface do Redis
│   ├── RedisService.cs            # Implementação do Redis
│   └── ExternalApiConfig.cs       # Configuração da API externa
├── Program.cs                      # Configuração da aplicação
├── appsettings.json               # Configurações
├── PasswordApi.csproj             # Projeto C#
├── Dockerfile                      # Imagem Docker
├── docker-compose.yml             # Orquestração Docker
└── README.md                       # Este arquivo
```

## Cache Redis

Ambos os endpoints utilizam cache Redis com expiração de 1 hora:

- **Chave local:** `passwords:{length}:{quantity}:{hasPunctuation}`
- **Chave externa:** `external_passwords:{length}:{quantity}:{hasPunctuation}`

## Documentação Swagger

Acesse em desenvolvimento: `http://localhost:5000/swagger`

## Logs

Os logs são exibidos no console e incluem:
- Requisições recebidas
- Cache hits/misses
- Erros de integração com API externa

## Tratamento de Erros

- `400 Bad Request`: Parâmetros inválidos
- `500 Internal Server Error`: Erro ao chamar API externa ou Redis

## Desenvolvimento

### Adicionar novo endpoint

1. Adicione o método no `V1PasswordController.cs`
2. Implemente a lógica no `PasswordService.cs`
3. Use `IRedisService` para cache quando apropriado

### Testes

Para adicionar testes, crie um projeto `PasswordApi.Tests` com xUnit.

## Licença

MIT
