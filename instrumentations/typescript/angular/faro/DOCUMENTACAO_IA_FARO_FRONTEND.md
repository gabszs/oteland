# Documentacao IA - Instrumentacao do Frontend Angular com Grafana Faro

Este guia descreve, de forma pratica, como instrumentar o frontend Angular com Grafana Faro para:

- capturar logs e erros de frontend (RUM),
- propagar contexto de trace do cliente para APIs,
- adicionar atributos custom nos spans (ex.: `user.id`),
- configurar URL do Faro por variavel de ambiente em runtime.

O backend pode permanecer como esta. O foco aqui e apenas o frontend.

## Objetivo tecnico

Ao final, o frontend deve:

1. Inicializar Faro ao subir a aplicacao.
2. Capturar erros globais do Angular com `ErrorHandler`.
3. Propagar `traceparent` nas chamadas HTTP.
4. Adicionar atributos de span dinamicos (`user.id` + atributos custom).
5. Permitir configurar o endpoint do Faro via `FARO_WEB_URL`.

## Dependencias necessarias

No frontend Angular:

```bash
pnpm add @grafana/faro-web-sdk @grafana/faro-web-tracing
```

## Arquivos de referencia deste projeto

- `frontend/src/app/faro-initializer.ts`
- `frontend/src/app/app.config.ts`
- `frontend/src/app/global-error-handler.ts`
- `frontend/src/app/trace-user-context.ts`
- `frontend/src/app/trace-id.utils.ts`
- `frontend/scripts/start-dev.sh`
- `frontend/public/env.js`
- `compose.yaml`

## 1) Inicializar Faro no bootstrap do Angular

Em apps standalone, usar `APP_INITIALIZER` em `app.config.ts`:

```ts
{
  provide: APP_INITIALIZER,
  useFactory: faroInitializer,
  deps: [],
  multi: true
}
```

No `faroInitializer`:

- inicializar com `initializeFaro(...)`,
- incluir `getWebInstrumentations(...)`,
- incluir `new TracingInstrumentation(...)`,
- habilitar `sessionTracking`,
- configurar `propagateTraceHeaderCorsUrls`.

Exemplo simplificado:

```ts
initializeFaro({
  url: faroUrl,
  app: {
    name: 'frontend-angular-labs-test',
    version: '1.0.0',
    environment: 'production',
  },
  sessionTracking: {
    samplingRate: 1,
    persistent: true,
  },
  instrumentations: [
    ...getWebInstrumentations(),
    new TracingInstrumentation({
      propagateTraceHeaderCorsUrls: [/^https?:\/\//],
    }),
  ],
});
```

## 2) Capturar erros globais do Angular

Criar `global-error-handler.ts`:

```ts
import { ErrorHandler, Injectable } from '@angular/core';
import { faro } from '@grafana/faro-web-sdk';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  handleError(error: any): void {
    if (error instanceof Error) {
      faro.api.pushError(error);
    }
    console.error(error);
  }
}
```

Registrar no provider:

```ts
{
  provide: ErrorHandler,
  useClass: GlobalErrorHandler
}
```

## 3) Configurar URL do Faro por variavel de ambiente (runtime)

Neste projeto, a URL do Faro vem de `FARO_WEB_URL` via Docker Compose:

```yaml
frontend:
  environment:
    - FARO_WEB_URL=${FARO_WEB_URL}
```

O script `frontend/scripts/start-dev.sh` escreve em `frontend/public/env.js`:

```js
window.__APP_ENV__ = {
  FARO_WEB_URL: "..."
};
```

No `faro-initializer.ts`, ler `window.__APP_ENV__?.FARO_WEB_URL`.
Se vazio, usar fallback padrao.

## 4) Adicionar atributos de span (user.id + custom)

Este projeto usa estado global simples no browser:

- `setTraceUserId(...)` / `getTraceUserId(...)`
- `setTraceMetaAttributes(...)` / `getTraceMetaAttributes(...)`

Durante a instrumentacao de `fetch/xhr`, aplicar atributos no span:

```ts
span.setAttribute('user.id', userId);
span.setAttribute('<chave-custom>', '<valor-custom>');
```

Assim, qualquer request pode sair com contexto adicional util para correlacao em trace.

## 5) Configurar usuario global no Faro

Quando o usuario informar dados no frontend:

```ts
faro.api.setUser({
  id: '12345',
  username: 'joao',
  attributes: {
    plano: 'premium',
    regiao: 'BR-SP',
  },
});
```

Esse contexto e global para telemetria do frontend.

## 6) Ler Trace ID no frontend para debug funcional

Para exibir trace na UI, usar util centralizado que busca:

1. headers (`otel-trace-id`, `x-trace-id`, `traceparent`),
2. payload de resposta (fallback),
3. normalizacao em `UPPERCASE`.

Neste projeto isso esta em:

- `frontend/src/app/trace-id.utils.ts`

## 7) Checklist rapido de validacao

1. Suba o ambiente (`docker compose up --build`).
2. Abra `http://localhost:5173/otel`.
3. Configure user e meta globais.
4. Envie um JSON para `/v1/debug`.
5. Verifique `Trace ID` na tela e no Grafana Explore.
6. Repita em `http://localhost:5173/password` e confira os traces.

## Troubleshooting

### Trace nao aparece no frontend

- Verifique se a resposta da API contem `otel-trace-id` ou `traceparent`.
- Verifique se existe fallback de leitura pelo payload da resposta.
- Verifique se a URL chamada no frontend esta correta (`localhost:8000` para backend local).

### Logs/erros nao chegam no Faro

- Verifique `FARO_WEB_URL` no runtime (`public/env.js`).
- Verifique conectividade da URL do Faro e configuracao do projeto no Grafana.
- Verifique se `initializeFaro(...)` esta sendo executado no startup.

## Resumo

Com essa abordagem, voce tem:

- RUM no frontend Angular,
- correlacao de trace cliente -> backend,
- contexto de usuario e metadados customizaveis,
- configuracao por ambiente sem rebuild do codigo.
