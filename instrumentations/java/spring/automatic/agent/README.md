# Spring Boot — OpenTelemetry Java Agent (Automatic Instrumentation)

## Setup

### 1. Build the application

```bash
mvn clean package -DskipTests
```

### 2. Download the OpenTelemetry Java Agent

```bash
curl -L -O https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/latest/download/opentelemetry-javaagent.jar
```

### 3. Run with the agent

```bash
export $(cat .env | xargs) && \
java -javaagent:opentelemetry-javaagent.jar \
     -jar target/agent-0.0.1-SNAPSHOT.jar
```

## Endpoints

- `GET /health` — Health check
- `GET /debug` — Returns curl of the incoming request
- `POST /debug` — Returns curl of the incoming request (with body)
