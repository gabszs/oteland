package com.delfia.agent.telemetry;

import java.lang.management.ManagementFactory;
import java.lang.management.MemoryMXBean;
import java.lang.management.OperatingSystemMXBean;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.opentelemetry.api.common.Attributes;
import io.opentelemetry.api.common.AttributesBuilder;

public class WideEvent {

    public static final String REQUEST_ATTRIBUTE_KEY = "wideEvent";
    private static final ObjectMapper objectMapper = new ObjectMapper();

    private final Map<String, Object> attributes = new ConcurrentHashMap<>();
    private final Map<String, Map<String, Object>> jsonAttributes = new ConcurrentHashMap<>();
    private final long startTimeMs = System.currentTimeMillis();

    // Stats counters
    private final AtomicInteger dbQueryCount = new AtomicInteger(0);
    private final AtomicLong dbQueryDurationMs = new AtomicLong(0);
    private final AtomicInteger httpRequestCount = new AtomicInteger(0);
    private final AtomicLong httpRequestDurationMs = new AtomicLong(0);
    private final AtomicInteger cacheHitCount = new AtomicInteger(0);
    private final AtomicInteger cacheMissCount = new AtomicInteger(0);

    public WideEvent put(String key, String value) {
        if (value != null) {
            attributes.put(key, value);
        }
        return this;
    }

    public WideEvent put(String key, long value) {
        attributes.put(key, value);
        return this;
    }

    public WideEvent put(String key, double value) {
        attributes.put(key, value);
        return this;
    }

    public WideEvent put(String key, boolean value) {
        attributes.put(key, value);
        return this;
    }

    // Stats tracking methods
    public void recordDbQuery(long durationMs) {
        dbQueryCount.incrementAndGet();
        dbQueryDurationMs.addAndGet(durationMs);
    }

    public void recordHttpRequest(long durationMs) {
        httpRequestCount.incrementAndGet();
        httpRequestDurationMs.addAndGet(durationMs);
    }

    public void recordCacheHit() {
        cacheHitCount.incrementAndGet();
    }

    public void recordCacheMiss() {
        cacheMissCount.incrementAndGet();
    }

    /**
     * Put a nested JSON object attribute.
     * Usage: event.putJson("service", Map.of("operation", "findAll", "entity", "Product"))
     * Result: service = {"operation":"findAll","entity":"Product"}
     */
    public WideEvent putJson(String key, Map<String, Object> value) {
        jsonAttributes.put(key, new HashMap<>(value));
        return this;
    }

    /**
     * Add a field to an existing JSON attribute, creating it if needed.
     * Usage: event.addToJson("service", "operation", "findAll")
     */
    public WideEvent addToJson(String key, String field, Object value) {
        jsonAttributes.computeIfAbsent(key, k -> new ConcurrentHashMap<>()).put(field, value);
        return this;
    }

    public Attributes toAttributes() {
        // Add duration
        long durationMs = System.currentTimeMillis() - startTimeMs;
        attributes.put("duration_ms", durationMs);

        // Add stats
        attributes.put("stats.db_query_count", dbQueryCount.get());
        attributes.put("stats.db_query_duration_ms", dbQueryDurationMs.get());
        attributes.put("stats.http_request_count", httpRequestCount.get());
        attributes.put("stats.http_request_duration_ms", httpRequestDurationMs.get());
        attributes.put("stats.cache_hit_count", cacheHitCount.get());
        attributes.put("stats.cache_miss_count", cacheMissCount.get());

        // Add system metrics
        addSystemMetrics();

        // Build attributes
        AttributesBuilder builder = Attributes.builder();
        for (Map.Entry<String, Object> entry : attributes.entrySet()) {
            Object value = entry.getValue();
            if (value instanceof String s) {
                builder.put(entry.getKey(), s);
            } else if (value instanceof Long l) {
                builder.put(entry.getKey(), l);
            } else if (value instanceof Integer i) {
                builder.put(entry.getKey(), i.longValue());
            } else if (value instanceof Double d) {
                builder.put(entry.getKey(), d);
            } else if (value instanceof Boolean b) {
                builder.put(entry.getKey(), b);
            }
        }

        // Add JSON attributes as serialized strings
        for (Map.Entry<String, Map<String, Object>> entry : jsonAttributes.entrySet()) {
            try {
                String json = objectMapper.writeValueAsString(entry.getValue());
                builder.put(entry.getKey(), json);
            } catch (JsonProcessingException e) {
                // Skip if serialization fails
            }
        }

        return builder.build();
    }

    private void addSystemMetrics() {
        try {
            // Memory metrics
            MemoryMXBean memoryBean = ManagementFactory.getMemoryMXBean();
            long heapUsed = memoryBean.getHeapMemoryUsage().getUsed();
            long heapMax = memoryBean.getHeapMemoryUsage().getMax();
            long nonHeapUsed = memoryBean.getNonHeapMemoryUsage().getUsed();

            attributes.put("metrics.heap_used_mb", heapUsed / (1024 * 1024));
            attributes.put("metrics.heap_max_mb", heapMax / (1024 * 1024));
            attributes.put("metrics.non_heap_used_mb", nonHeapUsed / (1024 * 1024));
            attributes.put("metrics.heap_usage_percent", (double) heapUsed / heapMax * 100);

            // CPU metrics
            OperatingSystemMXBean osBean = ManagementFactory.getOperatingSystemMXBean();
            attributes.put("metrics.available_processors", osBean.getAvailableProcessors());
            attributes.put("metrics.system_load_average", osBean.getSystemLoadAverage());

            // Extended OS metrics (if available)
            if (osBean instanceof com.sun.management.OperatingSystemMXBean sunOsBean) {
                attributes.put("metrics.process_cpu_load", sunOsBean.getProcessCpuLoad() * 100);
                attributes.put("metrics.system_cpu_load", sunOsBean.getCpuLoad() * 100);
                attributes.put("metrics.free_memory_mb", sunOsBean.getFreeMemorySize() / (1024 * 1024));
                attributes.put("metrics.total_memory_mb", sunOsBean.getTotalMemorySize() / (1024 * 1024));
                attributes.put("metrics.free_swap_mb", sunOsBean.getFreeSwapSpaceSize() / (1024 * 1024));
                attributes.put("metrics.total_swap_mb", sunOsBean.getTotalSwapSpaceSize() / (1024 * 1024));
            }

            // Thread metrics
            attributes.put("metrics.thread_count", ManagementFactory.getThreadMXBean().getThreadCount());
            attributes.put("metrics.peak_thread_count", ManagementFactory.getThreadMXBean().getPeakThreadCount());

            // GC metrics
            long gcCount = 0;
            long gcTime = 0;
            for (var gc : ManagementFactory.getGarbageCollectorMXBeans()) {
                gcCount += gc.getCollectionCount();
                gcTime += gc.getCollectionTime();
            }
            attributes.put("metrics.gc_count", gcCount);
            attributes.put("metrics.gc_time_ms", gcTime);

            // Runtime info
            attributes.put("metrics.uptime_ms", ManagementFactory.getRuntimeMXBean().getUptime());

        } catch (Exception e) {
            // Ignore metrics errors - don't fail the request
        }
    }
}
