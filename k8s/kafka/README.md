# OpenTelemetry Collector with Kafka

This directory runs OpenTelemetry Collector in a two-stage Kafka pipeline:

```text
OTLP clients
  -> otel-kafka-producer
  -> Kafka topics
  -> otel-kafka-consumer
  -> ClickHouse
```

The producer receives OTLP traffic and writes telemetry to Kafka. The consumer reads the Kafka topics and writes logs, metrics, and traces to ClickHouse.

## Files

| File | Purpose |
|---|---|
| `producer.yaml` | Helm values for OTLP -> Kafka |
| `consumer.yaml` | Helm values for Kafka -> ClickHouse |

Both collectors use:

```yaml
image:
  repository: otel/opentelemetry-collector-contrib
  tag: "0.152.0"
```

## Kafka Topics

The pipeline expects these topics:

| Signal | Topic | Encoding |
|---|---|---|
| Logs | `otel-logs` | `otlp_json` |
| Metrics | `otel-metrics` | `otlp_json` |
| Traces | `otel-traces` | `otlp_json` |

Kafka endpoint:

```text
automq-kafka.automq.svc.cluster.local:9092
```

Authentication uses SASL/SCRAM:

```yaml
auth:
  sasl:
    username: user1
    password: FeOayikYWD
    mechanism: SCRAM-SHA-256
```

If the consumer logs `UNKNOWN_TOPIC_OR_PARTITION`, create the missing topics or send data of that signal through the producer if Kafka auto topic creation is enabled.

## Producer

The producer exposes OTLP outside the cluster through a LoadBalancer:

```yaml
service:
  type: LoadBalancer
  loadBalancerIP: "192.168.1.112"
```

Endpoints:

```text
gRPC: 192.168.1.112:4317
HTTP: 192.168.1.112:4318
```

It uses one Kafka exporter with signal-specific topics:

```yaml
exporters:
  kafka:
    logs:
      topic: otel-logs
      encoding: otlp_json
    metrics:
      topic: otel-metrics
      encoding: otlp_json
    traces:
      topic: otel-traces
      encoding: otlp_json
```

The exporter has retry and queueing enabled:

```yaml
retry_on_failure:
  enabled: true
sending_queue:
  enabled: true
producer:
  compression: zstd
```

## Consumer

The consumer uses one Kafka receiver with signal-specific topics:

```yaml
receivers:
  kafka:
    logs:
      topics:
        - otel-logs
      encoding: otlp_json
    metrics:
      topics:
        - otel-metrics
      encoding: otlp_json
    traces:
      topics:
        - otel-traces
      encoding: otlp_json
```

It exports to the internal ClickHouse service:

```text
tcp://clickhouse-clickhouse.clickhouse.svc.cluster.local:9000
```

Current ClickHouse credentials:

```text
username: admin_user
password: clickhouse_admin_password
database: default
```

The ClickHouse exporter has `create_schema: false` because the schema is managed separately in:

```text
pve/k3s/clickhouse/schema/otel.sql
```

Apply that schema before relying on the consumer to write data.

## Kafka Pipeline Marker

The consumer adds resource attributes before writing to ClickHouse:

```yaml
resource/kafka_pipeline:
  attributes:
    - key: messaging.system
      value: kafka
      action: insert
    - key: telemetry.pipeline.name
      value: otel-kafka-consumer
      action: insert
    - key: telemetry.pipeline.stage
      value: kafka-consumer
      action: insert
```

`messaging.system=kafka` follows OpenTelemetry semantic conventions. The `telemetry.pipeline.*` fields are operational markers for querying data that passed through this Kafka consumer.

Example ClickHouse check:

```sql
SELECT
    ServiceName,
    ResourceAttributes['messaging.system'] AS messaging_system,
    ResourceAttributes['telemetry.pipeline.name'] AS pipeline_name,
    count()
FROM default.otel_logs
WHERE Timestamp >= now() - INTERVAL 15 MINUTE
GROUP BY ServiceName, messaging_system, pipeline_name
ORDER BY count() DESC;
```

## Autoscaling

Both producer and consumer enable HPA:

```yaml
autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 65
  targetMemoryUtilizationPercentage: 75
```

Resource requests are configured because HPA needs them to calculate utilization.

Producer:

```yaml
requests:
  cpu: 100m
  memory: 256Mi
limits:
  cpu: 500m
  memory: 512Mi
```

Consumer:

```yaml
requests:
  cpu: 150m
  memory: 384Mi
limits:
  cpu: 750m
  memory: 768Mi
```

For a Kafka consumer group, useful scaling is bounded by topic partition count. If a topic has fewer partitions than consumer replicas, extra replicas may stay idle.

## Install Or Upgrade

Use the OpenTelemetry Collector Helm chart with separate releases.

Producer:

```bash
helm upgrade --install otel-kafka-producer open-telemetry/opentelemetry-collector \
  -n observability \
  --create-namespace \
  -f /home/gabriel-carvalho/Documents/homelab/pve/k3s/monitoring/otel-collector/kafka/producer.yaml
```

Consumer:

```bash
helm upgrade --install otel-kafka-consumer open-telemetry/opentelemetry-collector \
  -n observability \
  --create-namespace \
  -f /home/gabriel-carvalho/Documents/homelab/pve/k3s/monitoring/otel-collector/kafka/consumer.yaml
```

## Verify

Check pods and HPAs:

```bash
kubectl get pods -n observability
kubectl get hpa -n observability
```

Check services:

```bash
kubectl get svc -n observability
```

Watch producer logs:

```bash
kubectl logs -n observability deploy/otel-kafka-producer-opentelemetry-collector -f
```

Watch consumer logs:

```bash
kubectl logs -n observability deploy/otel-kafka-consumer-opentelemetry-collector -f
```

Check ClickHouse tables:

```bash
kubectl exec -n clickhouse -it chi-clickhouse-ch-0-0-0 -- \
  clickhouse-client \
  --user admin_user \
  --password clickhouse_admin_password \
  --query "SELECT name, engine FROM system.tables WHERE database = 'default' AND match(name, '^otel_.*') ORDER BY name"
```

Check recent logs:

```bash
kubectl exec -n clickhouse -it chi-clickhouse-ch-0-0-0 -- \
  clickhouse-client \
  --user admin_user \
  --password clickhouse_admin_password \
  --query "SELECT Timestamp, ServiceName, Body FROM default.otel_logs ORDER BY Timestamp DESC LIMIT 10"
```

## Send A Test Log

```bash
curl -X POST http://192.168.1.112:4318/v1/logs \
  -H "Content-Type: application/json" \
  -d '{
    "resourceLogs": [
      {
        "resource": {
          "attributes": [
            {
              "key": "service.name",
              "value": { "stringValue": "otel-kafka-demo" }
            }
          ]
        },
        "scopeLogs": [
          {
            "logRecords": [
              {
                "timeUnixNano": "1735689600000000000",
                "severityText": "INFO",
                "body": { "stringValue": "hello from otel kafka pipeline" }
              }
            ]
          }
        ]
      }
    ]
  }'
```

Then query ClickHouse:

```sql
SELECT
    Timestamp,
    ServiceName,
    Body,
    ResourceAttributes['messaging.system'] AS messaging_system
FROM default.otel_logs
WHERE ServiceName = 'otel-kafka-demo'
ORDER BY Timestamp DESC
LIMIT 10;
```

## Load Test With Telemetrygen

Use `telemetrygen` to generate synthetic telemetry for HPA and Kafka throughput demos.

Install locally:

```bash
go install github.com/open-telemetry/opentelemetry-collector-contrib/cmd/telemetrygen@latest
```

The producer OTLP/gRPC endpoint is:

```text
192.168.1.112:4317
```

To generate about `500 records/s` total, split the rate equally across the three signals:

```text
logs:    166.67/s
metrics: 166.67/s
traces:  166.67/s
total:   ~500/s
```

Continuous load test:

```bash
telemetrygen logs \
  --otlp-endpoint 192.168.1.112:4317 \
  --otlp-insecure \
  --duration inf \
  --rate 166.67 \
  --service otel-kafka-loadtest-logs &

telemetrygen metrics \
  --otlp-endpoint 192.168.1.112:4317 \
  --otlp-insecure \
  --duration inf \
  --rate 166.67 \
  --service otel-kafka-loadtest-metrics &

telemetrygen traces \
  --otlp-endpoint 192.168.1.112:4317 \
  --otlp-insecure \
  --duration inf \
  --rate 166.67 \
  --service otel-kafka-loadtest-traces &
```

Controlled 5-minute demo:

```bash
telemetrygen logs \
  --otlp-endpoint 192.168.1.112:4317 \
  --otlp-insecure \
  --duration 5m \
  --rate 166.67 \
  --service otel-kafka-loadtest-logs &

telemetrygen metrics \
  --otlp-endpoint 192.168.1.112:4317 \
  --otlp-insecure \
  --duration 5m \
  --rate 166.67 \
  --service otel-kafka-loadtest-metrics &

telemetrygen traces \
  --otlp-endpoint 192.168.1.112:4317 \
  --otlp-insecure \
  --duration 5m \
  --rate 166.67 \
  --service otel-kafka-loadtest-traces &
```

Stop a continuous local test:

```bash
pkill -f "telemetrygen logs"
pkill -f "telemetrygen metrics"
pkill -f "telemetrygen traces"
```

Watch HPA during the test:

```bash
kubectl get hpa -n observability -w
```

Watch Kafka producer and consumer pods scale:

```bash
kubectl get pods -n observability -w
```

## Troubleshooting

`UNKNOWN_TOPIC_OR_PARTITION`

The consumer is trying to read a topic that does not exist. Create the topic or produce that signal first if auto topic creation is enabled.

`create_schema: false` errors in the ClickHouse exporter

Apply the schema first:

```bash
kubectl cp /home/gabriel-carvalho/Documents/homelab/pve/k3s/clickhouse/schema/otel.sql \
  clickhouse/chi-clickhouse-ch-0-0-0:/tmp/otel.sql

kubectl exec -n clickhouse -it chi-clickhouse-ch-0-0-0 -- \
  clickhouse-client \
  --user admin_user \
  --password clickhouse_admin_password \
  --multiquery \
  --queries-file /tmp/otel.sql
```

HPA does not scale

Check that metrics-server is installed and that the pods have CPU and memory requests:

```bash
kubectl top pods -n observability
kubectl describe hpa -n observability
```
