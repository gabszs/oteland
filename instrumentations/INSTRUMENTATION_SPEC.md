# Delfia Instrumentation Specification

Este documento define as regras e padrões para criar instrumentações de APIs em diferentes linguagens e frameworks. O objetivo é garantir consistência entre todas as implementações.

---

## Estrutura de Pastas

```
instrumentations/
├── {language}/
│   └── {framework}/
│       ├── automatic/           # Instrumentação automática (agent/bytecode)
│       │   └── agent/
│       └── manual/              # Instrumentação manual (SDK)
│           └── sdk/
```

---

## Endpoints Obrigatórios

### 1. Health Check
```
GET /health
```
Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "trace-id": "abc123..."
}
```

### 2. Debug (curl reconstructor)
```
GET /debug
POST /debug
```
Response:
```json
{
  "curl": "curl -X POST -H 'content-type: application/json' -d '{...}' 'http://localhost:8080/debug'"
}
```
- Reconstrói o comando curl da requisição recebida
- Inclui: method, headers, body (se POST), query params, URL completa

### 3. Products CRUD
```
GET    /v1/products         → Lista todos (200)
GET    /v1/products/{id}    → Busca por ID (200)
POST   /v1/products         → Cria novo (201)
PUT    /v1/products/{id}    → Atualiza (200)
DELETE /v1/products/{id}    → Remove (204)
```

#### Product Schema
```json
{
  "id": 1,
  "name": "string (required)",
  "description": "string (optional, max 1000)",
  "price": "decimal (required, >= 0)",
  "sku": "string (required, max 100)",
  "quantity": "integer (required, >= 0)",
  "active": "boolean (default: true)",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

---

## Arquitetura de Camadas

### 1. Entity (Model)
- **BaseEntity**: classe/struct base com `id`, `createdAt`, `updatedAt`
- **Product**: extends BaseEntity, adiciona campos específicos

### 2. Repository
- **BaseRepository**: interface/classe genérica com CRUD básico
- **ProductRepository**: extends BaseRepository

### 3. Service
- **BaseService**: classe abstrata com métodos genéricos
  - `findAll()`, `findById(id)`, `create(entity)`, `update(id, entity)`, `delete(id)`
- **ProductService**: extends BaseService, adiciona lógica específica se necessário

### 4. Controller
- Validação de entrada (request DTOs)
- Mapeamento para/de DTOs
- Tratamento de erros via GlobalExceptionHandler

### 5. DTOs
- **ProductRequest**: campos de entrada com validações
- **ProductResponse**: campos de saída incluindo id, timestamps
- **ProductMapper**: conversão entre Entity e DTOs

---

## Banco de Dados

- **SQLite** como padrão (arquivo local)
- Auto-criação do arquivo se não existir
- Schema gerado automaticamente via ORM/migrations
- Seed data opcional via `data.sql` ou equivalente

---

## OpenTelemetry Instrumentation

### Variáveis de Ambiente (.env)
```env
OTEL_SERVICE_NAME={language}-{framework}-{type}-{mode}
OTEL_EXPORTER_OTLP_ENDPOINT=http://collector.gabrielcarvalho.dev
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_TRACES_EXPORTER=otlp
OTEL_METRICS_EXPORTER=otlp
OTEL_LOGS_EXPORTER=otlp

SERVICE_OWNER_NAME=pre-sales-team
SERVICE_OWNER_URL=gabrielcarvalho.dev
SERVICE_OWNER_CONTACT=gabriel.carvalho@delfia.tech
SERVICE_OWNER_ENVIRONMENT=development
```

### Middleware/Filter de Telemetria

#### WideEvent Pattern
Criar objeto `WideEvent` que acumula atributos durante o request:

1. **ANTES do request** (no middleware):
   - Criar WideEvent
   - Adicionar atributos do service owner
   - Adicionar atributos da request
   - Armazenar no contexto do request (para acesso nos controllers)

2. **DURANTE o request** (nos controllers):
   - Buscar WideEvent do contexto
   - Adicionar atributos específicos da rota

3. **APÓS o request** (no middleware):
   - Adicionar atributos da response
   - Adicionar payload (se presente e <= 10KB)
   - Setar todos atributos no span

#### Atributos Obrigatórios do Span

**Service Owner:**
```
service.environment
service.owner.name
service.owner.url
service.owner.contact
```

**Request:**
```
client.address
http.request.method
http.request.path
http.request.query (se presente)
http.request.body (se presente e <= 10KB)
user_agent.original
```

**Response:**
```
http.response.status_code
```

### Response Headers
- `otel-trace-id`: trace ID do span atual em toda resposta

### Logging
- Usar logger nativo do framework
- `log.info()` em cada endpoint com contexto relevante
- O agent OTel injeta trace_id/span_id automaticamente no MDC

---

## Configuração de Settings

Usar padrão de configuração tipada (equivalente ao Pydantic Settings):
- Java: `@ConfigurationProperties`
- Python: `pydantic-settings`
- Node.js: `env-var` ou similar
- Go: `envconfig`

Carregar do `.env` e permitir override via variáveis de ambiente.

---

## Docker

### Dockerfile (multi-stage)
```dockerfile
# Stage 1: Build
FROM {build-image} AS build
# ... build steps

# Stage 2: Runtime
FROM {runtime-image}
# Download OTel agent/SDK se necessário
COPY --from=build ...
ENTRYPOINT [...]
```

### docker-compose.yml
```yaml
services:
  app:
    build: .
    ports:
      - "8080:8080"
    env_file:
      - .env
    volumes:
      - db-data:/app/data
    environment:
      - DATABASE_URL=...

volumes:
  db-data:
```

---

## OpenAPI/Swagger

- Endpoint: `/docs` (Swagger UI)
- Endpoint: `/v3/api-docs` ou equivalente (JSON spec)

---

## Arquivos Necessários

```
{instrumentation}/
├── README.md                 # Instruções de uso
├── Dockerfile
├── docker-compose.yml
├── .env
├── .gitignore
├── {build-config}           # pom.xml, package.json, go.mod, etc.
└── src/
    ├── main/
    │   ├── config/          # Settings, configurações
    │   ├── controller/      # Endpoints HTTP
    │   ├── dto/             # Request/Response DTOs
    │   ├── entity/          # Modelos de dados
    │   ├── filter/          # Middlewares
    │   ├── repository/      # Acesso a dados
    │   ├── service/         # Lógica de negócio
    │   └── telemetry/       # WideEvent, helpers OTel
    └── resources/
        ├── application.{ext} # Configuração da app
        └── data.sql          # Seed data (opcional)
```

---

## Checklist de Implementação

- [ ] Estrutura de pastas conforme especificação
- [ ] Endpoints: `/health`, `/debug`, `/v1/products` CRUD
- [ ] BaseEntity com id, createdAt, updatedAt
- [ ] BaseRepository e BaseService genéricos
- [ ] Product entity, repository, service, controller
- [ ] DTOs com validação (Request) e mapeamento (Mapper)
- [ ] GlobalExceptionHandler (404, 400)
- [ ] SQLite configurado com auto-create
- [ ] Seed data para products
- [ ] OpenTelemetry instrumentação (agent ou SDK)
- [ ] WideEvent middleware com atributos obrigatórios
- [ ] TraceIdFilter para header `otel-trace-id`
- [ ] ConfigurationProperties para service owner
- [ ] Logger em todos endpoints
- [ ] OpenAPI/Swagger em `/docs`
- [ ] Dockerfile multi-stage
- [ ] docker-compose.yml com volume para DB
- [ ] .env com todas variáveis
- [ ] README.md com instruções

---

## Exemplo de Uso

Para criar uma nova instrumentação:

```
Input: "Python + FastAPI + automatic"

Output esperado em: instrumentations/python/fastapi/automatic/agent/
```

O agente deve seguir todas as regras deste documento para garantir consistência entre implementações.
