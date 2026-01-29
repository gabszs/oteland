package com.delfia.agent.filter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.util.ContentCachingRequestWrapper;

import com.delfia.agent.config.ServiceOwnerSettings;

import io.opentelemetry.api.common.AttributeKey;
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

        // Service owner attributes
        span.setAttribute(AttributeKey.stringKey("service.environment"), serviceOwner.environment());
        span.setAttribute(AttributeKey.stringKey("service.owner.name"), serviceOwner.name());
        span.setAttribute(AttributeKey.stringKey("service.owner.url"), serviceOwner.url());
        span.setAttribute(AttributeKey.stringKey("service.owner.contact"), serviceOwner.contact());
        span.setAttribute(AttributeKey.stringKey("client.address"), httpRequest.getRemoteAddr());

        // Request attributes
        span.setAttribute(AttributeKey.stringKey("http.request.method"), httpRequest.getMethod());
        span.setAttribute(AttributeKey.stringKey("http.request.path"), httpRequest.getRequestURI());
        span.setAttribute(AttributeKey.stringKey("http.request.query"), httpRequest.getQueryString());
        span.setAttribute(AttributeKey.stringKey("user_agent.original"), httpRequest.getHeader("User-Agent"));

        // Response attributes
        span.setAttribute(AttributeKey.longKey("http.response.status_code"), httpResponse.getStatus());

        // Payload (if present and not too large)
        byte[] content = wrappedRequest.getContentAsByteArray();
        if (content.length > 0 && content.length <= 10_000) {
            String payload = new String(content, StandardCharsets.UTF_8);
            span.setAttribute(AttributeKey.stringKey("http.request.body"), payload);
        }
    }
}
