# AutoMQ on k3s + Garage S3

Deployment guide for AutoMQ (Kafka-compatible, S3-native) on a k3s homelab cluster using Garage as the S3 backend, integrated with OpenTelemetry Collector.

---

## Architecture

```
Producers (OTLP)
     │
     ▼
otel-collector/producer  ──► Kafka (AutoMQ broker)  ──► otel-collector/consumer  ──► ClickHouse
     │                              │
  LoadBalancer                  S3 (Garage)
192.168.1.112:4317/4318      automq-ops / automq-data
```

- **Controller** → `k3s-worker-1` (manages cluster metadata via KRaft)
- **Broker** → `k3s-worker-2` (handles produce/consume)
- **Storage** → Garage S3 at `192.168.1.4:3900` (all message durability lives here)

---

## Install

```bash
helm install automq-release oci://registry-1.docker.io/bitnamicharts/kafka \
  -f values.yaml \
  --version 31.5.0 \
  --namespace automq \
  --create-namespace
```

### Upgrade

```bash
helm upgrade automq-release oci://registry-1.docker.io/bitnamicharts/kafka \
  -f values.yaml \
  --version 31.5.0 \
  --namespace automq
```

### Uninstall

```bash
helm uninstall automq-release -n automq
```

> When uninstalling and reinstalling, delete PVCs manually — `local-path` binds PVs to specific nodes and causes scheduling conflicts on reinstall:
> ```bash
> kubectl delete pvc -n automq --all
> ```

---

## S3 Buckets

AutoMQ uses two buckets in Garage:

| Bucket | Purpose |
|---|---|
| `automq-ops` | Operational data: cluster metadata, offsets, consumer groups |
| `automq-data` | Message data: WAL (write-ahead log) and streams |

### S3 Credentials

```env
AWS_ACCESS_KEY_ID=GK04646bc70e8928f57ca3db95
AWS_SECRET_ACCESS_KEY=1a9dd69f3336bfc80c368a9d2ffbcf6f862268167742ed3cfc56a3cda8e53f15
S3_ENDPOINT=http://192.168.1.4:3900
```

These are passed as `extraEnvVars` in `values.yaml`. The S3 SDK picks them up automatically via standard AWS env var names.

> **Security note:** credentials are currently in plaintext in `values.yaml`. For production, replace with a Kubernetes Secret and reference via `extraEnvVarsSecret`.

---

## Kafka Credentials

The Bitnami chart auto-generates SASL credentials and stores them in a Kubernetes Secret:

```bash
kubectl get secret automq-kafka-user-passwords -n automq \
  -o jsonpath='{.data}' | \
  python3 -c "import sys,json,base64; d=json.load(sys.stdin); [print(k+':', base64.b64decode(v).decode()) for k,v in d.items()]"
```

| Key | Username | Purpose |
|---|---|---|
| `client-passwords` | `user1` | External/otel-collector client connections |
| `inter-broker-password` | `inter_broker_user` | Internal broker-to-broker communication |
| `controller-password` | `controller_user` | Controller authentication |

---

## SASL Mechanism: SCRAM-SHA-256

**This is the most common gotcha.** The Bitnami chart sets `KAFKA_KRAFT_BOOTSTRAP_SCRAM_USERS=true`, which means it provisions users via SCRAM, not PLAIN.

The broker enforces SASL on port 9092. Connecting without auth or with the wrong mechanism results in:
```
Unexpected Kafka request of type METADATA during SASL handshake.
```

Clients **must** use `SCRAM-SHA-256`, not `PLAIN`. Example in Python:

```python
from kafka import KafkaProducer

producer = KafkaProducer(
    bootstrap_servers="automq-kafka.automq.svc.cluster.local:9092",
    security_protocol="SASL_PLAINTEXT",
    sasl_mechanism="SCRAM-SHA-256",       # NOT "PLAIN"
    sasl_plain_username="user1",
    sasl_plain_password="FeOayikYWD",
)
```

In otel-collector kafka exporter/receiver:
```yaml
auth:
  sasl:
    username: user1
    password: FeOayikYWD
    mechanism: SCRAM-SHA-256   # NOT PLAIN
  tls:
    insecure: true             # no TLS on internal cluster traffic
```

---

## Internal Kafka URL

For any client running **inside the cluster**, always use the ClusterIP service:

```
automq-kafka.automq.svc.cluster.local:9092
```

Do not use the headless services (`*-headless`) for client connections — those are StatefulSet-internal.

### Why not the pod IP or headless?

The broker advertises `advertised.listeners` to clients on metadata responses. Connecting directly to a pod IP or headless bypasses the service, which breaks client reconnection logic after restarts.

### External access

An optional LoadBalancer service is defined in `load-balancer.yaml` (IP `192.168.1.111`). It was not used in the final setup because:
- External `advertised.listeners` would need to be configured to avoid metadata redirect back to `localhost`
- For this homelab, all consumers run inside the cluster

---

## Memory Configuration

Each pod (controller and broker) uses:

```
-Xmx3g -Xms3g -XX:MaxDirectMemorySize=2g -XX:MetaspaceSize=128m
```

| Area | Size | Notes |
|---|---|---|
| JVM Heap (`Xmx`) | 3 GB | Objects, caches managed by GC |
| Direct memory (`MaxDirectMemorySize`) | 2 GB | Netty buffers + S3 caches |
| WAL cache (`s3.wal.cache.size`) | 1 GB | Batches writes before flushing to S3 |
| Block cache (`s3.block.cache.size`) | 512 MB | Caches reads from S3 |
| Metaspace | 128 MB | JVM class metadata |

Total: ~5.5 GB — within the `limits.memory: 6Gi`.

> WAL and block caches live **inside** `MaxDirectMemorySize`. Increasing them beyond `MaxDirectMemorySize` causes OOM.

---

## Node Scheduling

Pods are distributed automatically via `podAntiAffinity` — no node names hardcoded:

- **Controller** avoids nodes running broker pods
- **Broker** avoids nodes running controller pods

This uses `preferredDuringSchedulingIgnoredDuringExecution` (soft rule), so if only one node is available the pod still schedules.

> `nodeSelector` with hardcoded hostnames was tried first but abandoned — it caused `volume node affinity conflict` errors when PVCs were pre-bound to a different node.

---

## Issues Encountered

### 1. `ZeroZoneTrafficInterceptor` — node rack required

**Error:**
```
IllegalArgumentException: The node rack should be set when enable cross available zone router
```

**Cause:** `automq.zonerouter.channels` in `extraConfig` enables the cross-AZ router, which requires `broker.rack` to be set. This feature is for multi-AZ cloud deployments.

**Fix:** Remove `automq.zonerouter.channels` from `extraConfig` in both controller and broker. Not needed in single-zone homelab.

---

### 2. `local-path` PVC node affinity conflict

**Error:**
```
1 node(s) had volume node affinity conflict
```

**Cause:** `local-path` provisioner binds PVs to the node where the pod first ran. After adding `nodeSelector` or `podAntiAffinity`, the pod was rescheduled to a different node — but the PV was still tied to the old one.

**Fix:** Delete the conflicting PVC and let the StatefulSet recreate it on the correct node:
```bash
kubectl delete pvc data-automq-release-kafka-broker-0 -n automq
```

---

### 3. SASL handshake error (wrong mechanism)

**Error:**
```
Unexpected Kafka request of type METADATA during SASL handshake.
```

**Cause:** Client connected with no SASL or with `PLAIN` mechanism, but broker requires `SCRAM-SHA-256`.

**Fix:** Set `mechanism: SCRAM-SHA-256` in all clients. See [SASL section](#sasl-mechanism-scram-sha-256) above.

---

### 4. Kafka metadata redirect to `localhost`

**Error:** Producer connects but times out on every send.

**Cause:** `advertised.listeners=PLAINTEXT://localhost:9092` — the broker tells clients to reconnect to its own `localhost`, which is unreachable externally.

**Fix:** For internal cluster clients this is fine (they connect via the ClusterIP service and stay internal). For external clients, `KAFKA_CFG_ADVERTISED_LISTENERS` must be set to the external IP — not implemented in this setup.

---

### 5. otel-collector-contrib kafka config schema breaking changes

**Error:**
```
'kafkaexporter.Config' has invalid keys: encoding, topic
```

**Cause:** `otel/opentelemetry-collector-contrib:latest` introduced signal-specific sub-configs. `topic` and `encoding` at the top level of the kafka exporter are no longer valid.

**Exporter fix (new schema):**
```yaml
exporters:
  kafka:
    brokers: [...]
    logs:
      topic: otel-logs
      encoding: otlp_json
```

**Receiver fix:** Pin to `0.111.0` — the receiver schema change was not yet stable and the new format was inconsistent across versions:
```yaml
image:
  repository: otel/opentelemetry-collector-contrib
  tag: "0.111.0"
```

---

## AutoMQ Native Telemetry (OTLP Push)

AutoMQ exposes its own metrics natively via the OpenTelemetry SDK. This is configured in `extraConfig` of both controller and broker:

```properties
s3.telemetry.metrics.exporter.uri=otlp://?endpoint=http://otel-collector-deployment-opentelemetry-collector.observability.svc.cluster.local:4317&protocol=grpc
```

This pushes AutoMQ broker metrics (JVM, S3 operations, stream throughput, WAL, autobalancer) directly to the otel-collector — no scraping, no jmx_exporter needed.

### URI format

The config accepts multiple exporters comma-separated:

```properties
# OTLP gRPC
s3.telemetry.metrics.exporter.uri=otlp://?endpoint=http://<host>:<port>&protocol=grpc

# OTLP HTTP
s3.telemetry.metrics.exporter.uri=otlp://?endpoint=http://<host>:<port>&protocol=http

# Prometheus pull (AutoMQ becomes HTTP server)
s3.telemetry.metrics.exporter.uri=prometheus://?host=0.0.0.0&port=9090

# Multiple at once
s3.telemetry.metrics.exporter.uri=otlp://?endpoint=...,prometheus://?host=0.0.0.0&port=9090
```

### Signal coverage

| Signal | AutoMQ native | How to collect |
|---|---|---|
| **Metrics** | ✓ via `s3.telemetry.metrics.exporter.uri` | Push OTLP to otel-collector |
| **Logs** | ✗ | otel-collector reads container logs from pods |
| **Traces** | ✗ | Generated by your apps (producers/consumers), not the broker |

> For the full list of available telemetry configs, see the AutoMQ source:
> `https://github.com/AutoMQ/automq/blob/main/core/src/main/java/kafka/automq/AutoMQConfig.java`

---

## OpenTelemetry Collector Integration

Two collector deployments in the `monitoring/otel-collector/kafka/` directory:

| File | Role | Image |
|---|---|---|
| `producer.yaml` | Receives OTLP → exports to Kafka | `contrib:latest` |
| `consumer.yaml` | Reads from Kafka → exports to ClickHouse | `contrib:0.111.0` |

### Topics

| Topic | Signal |
|---|---|
| `otel-logs` | Logs |
| `otel-traces` | Traces |
| `otel-metrics` | Metrics |

### Producer LoadBalancer

The otel producer exposes OTLP endpoints externally at `192.168.1.112`:
- gRPC: `192.168.1.112:4317`
- HTTP: `192.168.1.112:4318`

Send a test log:
```bash
curl -X POST http://192.168.1.112:4318/v1/logs \
  -H "Content-Type: application/json" \
  -d '{"resourceLogs":[{"resource":{"attributes":[{"key":"service.name","value":{"stringValue":"test"}}]},"scopeLogs":[{"logRecords":[{"body":{"stringValue":"hello kafka"},"severityText":"INFO"}]}]}]}'
```
