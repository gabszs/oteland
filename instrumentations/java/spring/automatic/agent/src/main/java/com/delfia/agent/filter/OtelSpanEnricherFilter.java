package com.delfia.agent.filter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.util.ContentCachingRequestWrapper;

import com.delfia.agent.config.ServiceOwnerSettings;

import io.opentelemetry.api.common.Attributes;
import io.opentelemetry.api.common.AttributesBuilder;
import io.opentelemetry.api.trace.Span;
import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class OtelSpanEnricherFilter implements Filter {

    private final ServiceOwnerSettings serviceOwner;

    public OtelSpanEnricherFilter(ServiceOwnerSettings serviceOwner) {
        this.serviceOwner = serviceOwner;
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        HttpServletRequest httpRequest = (HttpServletRequest) request;
        HttpServletResponse httpResponse = (HttpServletResponse) response;

        ContentCachingRequestWrapper wrappedRequest = new ContentCachingRequestWrapper(httpRequest);

        chain.doFilter(wrappedRequest, response);

        Span span = Span.current();
        if (!span.getSpanContext().isValid()) {
            return;
        }

        AttributesBuilder event = Attributes.builder();

        // Service owner attributes
        event.put("service.environment", serviceOwner.environment());
        event.put("service.owner.name", serviceOwner.name());
        event.put("service.owner.url", serviceOwner.url());
        event.put("service.owner.contact", serviceOwner.contact());

        // Request attributes
        event.put("client.address", httpRequest.getRemoteAddr());
        event.put("http.request.method", httpRequest.getMethod());
        event.put("http.request.path", httpRequest.getRequestURI());
        if (httpRequest.getQueryString() != null) {
            event.put("http.request.query", httpRequest.getQueryString());
        }
        if (httpRequest.getHeader("User-Agent") != null) {
            event.put("user_agent.original", httpRequest.getHeader("User-Agent"));
        }

        // Response attributes
        event.put("http.response.status_code", httpResponse.getStatus());

        // Payload (if present and not too large)
        byte[] content = wrappedRequest.getContentAsByteArray();
        if (content.length > 0 && content.length <= 10_000) {
            String payload = new String(content, StandardCharsets.UTF_8);
            event.put("http.request.body", payload);
        }

        span.setAllAttributes(event.build());
    }
}
