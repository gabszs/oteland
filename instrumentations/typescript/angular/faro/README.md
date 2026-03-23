# Faro - Frontend + Backend

Projeto completo com frontend Angular e backend Python instrumentalizado.

## Estrutura

```
faro/
├── frontend/          # Aplicação Angular
├── backend/           # API Python (FastAPI)
├── compose.yaml       # Docker Compose para orquestração
├── BACKEND_SETUP.md   # Instruções para setup do backend
└── README.md          # Este arquivo
```

## Pré-requisitos

- Docker e Docker Compose instalados
- Node.js 20+ (para desenvolvimento local)
- Python 3.9+ (para desenvolvimento local do backend)

## Iniciando com Docker Compose

1. Clone o repositório e navegue até a pasta `faro`:
   ```bash
   cd faro
   ```

2. Configure as variáveis de ambiente:
   ```bash
   cp backend/.env.example backend/.env
   ```

3. Inicie os serviços:
   ```bash
   docker-compose up
   ```

4. Acesse a aplicação:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8000
   - Docs da API: http://localhost:8000/docs

## Desenvolvimento Local

### Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

Acesse em http://localhost:5173

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # ou `venv\Scripts\activate` no Windows
pip install -r requirements.txt
python -m uvicorn main:app --reload
```

Acesse em http://localhost:8000

## Páginas Disponíveis

### Frontend

- `/` - Home com atalhos
- `/docs` - Documentação
- `/privacy` - Política de Privacidade
- `/otel` - Debug OpenTelemetry (envia JSON para `POST /v1/debug`)
- `/password` - Tela que consome as rotas normais de password (`/v1`, `/v1/pin`, `/v1/complex_password`)

## Rotas da API

### Debug
- `GET /v1/debug` - Retorna headers e informações de geo
- `POST /v1/debug` - Retorna headers, geo e o body recebido

### Password
- `GET /v1/` - Gera senhas simples
- `GET /v1/pin` - Gera PINs numéricos
- `POST /v1/complex_password` - Gera senhas complexas

## Variáveis de Ambiente

### Backend (.env)
```
ENVIRONMENT=development
LOG_LEVEL=INFO
FRONTEND_URL=http://frontend:5173
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
```

## Comunicação entre Serviços

No Docker Compose, os serviços se comunicam através da rede `faro-network`:
- Frontend acessa backend em: `http://backend:8000`
- Backend acessa frontend em: `http://frontend:5173`

## Parar os Serviços

```bash
docker-compose down
```

## Mais Informações

- Veja [BACKEND_SETUP.md](./BACKEND_SETUP.md) para instruções específicas do backend
- Veja [frontend/SETUP.md](./frontend/SETUP.md) para instruções do frontend
