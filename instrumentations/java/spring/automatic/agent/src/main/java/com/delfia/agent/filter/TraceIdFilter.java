package com.delfia.agent.filter;

import java.io.IOException;

import io.opentelemetry.api.trace.Span;
import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;

@Component
public class TraceIdFilter implements Filter {

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        String traceId = Span.current().getSpanContext().getTraceId();
        ((HttpServletResponse) response).setHeader("otel-trace-id", traceId);
        chain.doFilter(request, response);
    }
}
