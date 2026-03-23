# Resumo das Alterações - Faro

## Frontend (Angular)

### Novas Páginas Criadas

1. **Página /password** - Consumo das rotas de password
   - Componente: `src/app/pages/password/password.component.ts`
   - Template: `src/app/pages/password/password.component.html`
   - Estilos: `src/app/pages/password/password.component.css`
   - Funcionalidades:
     - Senha simples via `GET /v1/`
     - PIN via `GET /v1/pin`
     - Senha complexa via `POST /v1/complex_password`

### Alterações na Página /otel

- Atualizado componente `src/app/pages/otel/otel.component.ts`
- Adicionada funcionalidade de envio de JSON para a rota `POST /v1/debug`
- O ID é apenas para referência (não é enviado)
- Adicionada exibição da resposta do servidor

### Configurações

- Adicionado `provideHttpClient()` em `app.config.ts`
- Atualizado `app.routes.ts` com a nova rota `/password`
- Atualizado `home.component.html` com link para `/password`
- Criado `.env` com variáveis de ambiente para Docker

### Arquivos Criados

- `Dockerfile` - Para containerização do frontend
- `.env` - Variáveis de ambiente
- `.env.example` - Exemplo de variáveis de ambiente

## Backend (Python)

### Rotas Implementadas

1. **POST /v1/debug**
   - Retorna o body da chamada na resposta
   - Útil para testar payloads JSON
   - Exemplo de implementação em `BACKEND_SETUP.md`

2. **GET /v1/**
   - Gera senhas simples

3. **GET /v1/pin**
   - Gera PINs numéricos

4. **POST /v1/complex_password**
   - Gera senhas complexas

### Arquivos Criados

- `Dockerfile` - Para containerização do backend
- `.env.example` - Exemplo de variáveis de ambiente
- `requirements.txt.example` - Dependências Python recomendadas

## Docker Compose

### Arquivo: compose.yaml

Configuração para orquestração de dois serviços:

1. **Backend**
   - Porta: 8000
   - Comando: `python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload`
   - Volumes: código do backend para hot-reload
   - Rede: `faro-network`

2. **Frontend**
   - Porta: 5173
   - Comando: `pnpm dev`
   - Volumes: código do frontend + node_modules
   - Rede: `faro-network`

### Variáveis de Ambiente

**Backend:**
- `ENVIRONMENT=development`
- `LOG_LEVEL=INFO`
- `FRONTEND_URL=http://frontend:5173`
- `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317`

## Documentação

- `README.md` - Guia completo do projeto
- `BACKEND_SETUP.md` - Instruções específicas do backend
- `CHANGES_SUMMARY.md` - Este arquivo

## Como Usar

1. Configure as variáveis de ambiente:
   ```bash
   cp backend/.env.example backend/.env
   ```

2. Inicie os serviços:
   ```bash
   docker-compose up
   ```

3. Acesse:
   - Frontend: http://localhost:5173
   - Backend: http://localhost:8000
   - Docs da API: http://localhost:8000/docs

## Próximos Passos

1. Configurar autenticação/autorização
2. Adicionar testes de frontend
3. Configurar CI/CD
