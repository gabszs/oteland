package com.delfia.agent.controller;

import java.time.Instant;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import com.delfia.agent.telemetry.WideEvent;

import io.opentelemetry.api.trace.Span;
import jakarta.servlet.http.HttpServletRequest;

@RestController
public class HealthController {

    private static final Logger log = LoggerFactory.getLogger(HealthController.class);

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health(HttpServletRequest request) {
        log.info("Health check requested");

        // Get WideEvent from request (like c.get("wideEvent") in Hono)
        WideEvent event = (WideEvent) request.getAttribute(WideEvent.REQUEST_ATTRIBUTE_KEY);
        if (event != null) {
            event.put("health.check.type", "liveness");
            event.put("health.check.status", "ok");
        }

        return ResponseEntity.ok(Map.of(
                "status", "ok",
                "timestamp", Instant.now().toString(),
                "trace-id", Span.current().getSpanContext().getTraceId()));
    }
}
