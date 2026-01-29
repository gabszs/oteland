package com.delfia.agent.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "service.owner")
public record ServiceOwnerSettings(
        String name,
        String url,
        String contact,
        String environment
) {
}
