# Backend Setup - Faro

## Instruções para adicionar a rota POST /v1/debug

O backend está instrumentalizado com Python. Para adicionar a rota POST `/v1/debug` que retorna o body da chamada na resposta, adicione o seguinte código ao seu router v1:

```python
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/v1")

@router.post("/debug")
async def debug_endpoint(request: Request):
    """
    Rota de debug que retorna o body da chamada na resposta.
    Útil para testar e debugar payloads JSON.
    """
    try:
        body = await request.json()
        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "message": "Debug data received",
                "received_data": body
            }
        )
    except Exception as e:
        return JSONResponse(
            status_code=400,
            content={
                "status": "error",
                "message": str(e)
            }
        )
```

## Rotas de Password

As rotas normais de password disponíveis no backend são:

- `GET /v1/`
- `GET /v1/pin`
- `POST /v1/complex_password`

## Variáveis de Ambiente

Configure as seguintes variáveis no seu `.env`:

```
ENVIRONMENT=development
LOG_LEVEL=INFO
FRONTEND_URL=http://frontend:5173
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
```

## Docker

O backend será executado via Docker Compose. Certifique-se de ter um `Dockerfile` na pasta `backend/`.
