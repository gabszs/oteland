# Angular Docs App - Setup

Projeto Angular com páginas de documentação, home, privacidade, OpenTelemetry e password.

## Estrutura do Projeto

```
src/app/
├── pages/
│   ├── home/          # Página inicial com atalhos
│   ├── docs/          # Página de documentação
│   ├── privacy/       # Página de privacidade
│   ├── otel/          # Página OpenTelemetry (ID + JSON para POST /v1/debug)
│   └── password/      # Página de consumo das rotas de password
├── app.ts             # Componente raiz
├── app.routes.ts      # Configuração de rotas
└── app.html           # Template principal com navegação
```

## Rotas Disponíveis

- `/` ou `/home` - Página inicial
- `/docs` - Documentação
- `/privacy` - Política de privacidade
- `/otel` - OpenTelemetry (envia JSON para `POST /v1/debug`)
- `/password` - Consome rotas de password (`/v1`, `/v1/pin`, `/v1/complex_password`)

## Como Executar

1. Navegue até a pasta do projeto:
   ```bash
   cd frontend
   ```

2. Instale as dependências (se necessário):
   ```bash
   pnpm install
   ```

3. Inicie o servidor de desenvolvimento:
   ```bash
   pnpm dev
   ```

4. Abra o navegador em `http://localhost:5173`

## Funcionalidades

### Página Home
- Exibe bem-vindo ao aplicativo
- Atalhos para Docs, Privacy, OpenTelemetry e Password

### Página Docs
- Informações sobre o sistema
- Lista de recursos principais

### Página Privacy
- Política de privacidade
- Informações sobre proteção de dados

### Página OpenTelemetry (/otel)
- Campo de ID (não utilizado por enquanto)
- Campo de entrada para JSON
- Envio para `POST /v1/debug`
- Exibição da resposta do backend

### Página Password (/password)
- Gera senha simples via `GET /v1/`
- Gera PIN via `GET /v1/pin`
- Gera senha complexa via `POST /v1/complex_password`

## Build para Produção

```bash
pnpm build
```

Os arquivos compilados estarão em `dist/`
