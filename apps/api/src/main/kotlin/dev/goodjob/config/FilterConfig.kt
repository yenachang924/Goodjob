package dev.goodjob.config

import dev.goodjob.security.NoStoreFilter
import dev.goodjob.security.OriginPolicyFilter
import dev.goodjob.security.PayloadLimitFilter
import dev.goodjob.security.RateLimitFilter
import org.springframework.boot.web.servlet.FilterRegistrationBean
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
class FilterConfig {
    @Bean fun noStoreRegistration(filter: NoStoreFilter) = disabled(filter)
    @Bean fun originRegistration(filter: OriginPolicyFilter) = disabled(filter)
    @Bean fun payloadRegistration(filter: PayloadLimitFilter) = disabled(filter)
    @Bean fun rateLimitRegistration(filter: RateLimitFilter) = disabled(filter)

    private fun <T : jakarta.servlet.Filter> disabled(filter: T) =
        FilterRegistrationBean(filter).apply { isEnabled = false }
}
