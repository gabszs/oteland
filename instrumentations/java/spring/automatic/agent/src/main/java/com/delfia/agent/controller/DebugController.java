package com.delfia.agent.controller;

import java.util.Enumeration;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;

@RestController
public class DebugController {

    @GetMapping("/debug")
    public ResponseEntity<Map<String, String>> debugGet(HttpServletRequest request) {
        String curl = buildCurl(request, null);
        return ResponseEntity.ok(Map.of("curl", curl));
    }

    @PostMapping("/debug")
    public ResponseEntity<Map<String, String>> debugPost(
            HttpServletRequest request,
            @RequestBody(required = false) String body) {
        String curl = buildCurl(request, body);
        return ResponseEntity.ok(Map.of("curl", curl));
    }

    private String buildCurl(HttpServletRequest request, String body) {
        StringBuilder curl = new StringBuilder("curl");

        String method = request.getMethod();
        curl.append(" -X ").append(method);

        // Headers
        Enumeration<String> headerNames = request.getHeaderNames();
        while (headerNames.hasMoreElements()) {
            String name = headerNames.nextElement();
            String value = request.getHeader(name);
            curl.append(" -H '").append(escapeQuote(name)).append(": ").append(escapeQuote(value)).append("'");
        }

        // Body
        if (body != null && !body.isBlank()) {
            curl.append(" -d '").append(escapeQuote(body)).append("'");
        }

        // URL with query string
        String url = buildUrl(request);
        curl.append(" '").append(escapeQuote(url)).append("'");

        return curl.toString();
    }

    private String buildUrl(HttpServletRequest request) {
        StringBuilder url = new StringBuilder();
        url.append(request.getScheme()).append("://").append(request.getServerName());

        int port = request.getServerPort();
        if ((request.getScheme().equals("http") && port != 80)
                || (request.getScheme().equals("https") && port != 443)) {
            url.append(":").append(port);
        }

        url.append(request.getRequestURI());

        String queryString = request.getQueryString();
        if (queryString != null && !queryString.isEmpty()) {
            url.append("?").append(queryString);
        }

        return url.toString();
    }

    private String escapeQuote(String value) {
        return value.replace("'", "'\\''");
    }
}
