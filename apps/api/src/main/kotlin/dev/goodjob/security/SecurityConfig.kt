package dev.goodjob.security

import jakarta.servlet.http.HttpServletResponse
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.core.annotation.Order
import org.springframework.security.config.Customizer
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.core.userdetails.User
import org.springframework.security.core.userdetails.UserDetailsService
import org.springframework.security.core.userdetails.UsernameNotFoundException
import org.springframework.security.crypto.factory.PasswordEncoderFactories
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.authentication.www.BasicAuthenticationFilter
import org.springframework.security.web.AuthenticationEntryPoint

@Configuration
class SecurityConfig {
    @Bean
    fun userDetailsService(
        @Value("\${goodjob.security.username}") username: String,
        @Value("\${goodjob.security.password}") password: String,
    ): UserDetailsService {
        require(username.isNotBlank() && password.isNotBlank()) { "GOODJOB_USERNAME and GOODJOB_PASSWORD are required" }
        val encoder = PasswordEncoderFactories.createDelegatingPasswordEncoder()
        val encodedPassword = encoder.encode(password)
        return UserDetailsService { requested ->
            if (requested == username) User.withUsername(username).password(encodedPassword).roles("LEARNER").build()
            else throw UsernameNotFoundException("Unknown learner")
        }
    }

    @Bean
    fun securityFilterChain(
        http: HttpSecurity,
        originFilter: OriginPolicyFilter,
        rateLimitFilter: RateLimitFilter,
        noStoreFilter: NoStoreFilter,
        payloadLimitFilter: PayloadLimitFilter,
    ): SecurityFilterChain {
        http.csrf { it.disable() }
            .cors { it.disable() }
            .sessionManagement { it.sessionCreationPolicy(SessionCreationPolicy.STATELESS) }
            .requestCache { it.disable() }
            .securityContext { it.requireExplicitSave(true) }
            .authorizeHttpRequests { it.anyRequest().authenticated() }
            .httpBasic { it.authenticationEntryPoint(apiAuthenticationEntryPoint()) }
            .exceptionHandling {
                it.authenticationEntryPoint { _, response, _ -> writeError(response, 401, "UNAUTHORIZED", "Authentication required") }
                it.accessDeniedHandler { _, response, _ -> writeError(response, 403, "FORBIDDEN", "Access denied") }
            }
            .addFilterBefore(noStoreFilter, BasicAuthenticationFilter::class.java)
            .addFilterBefore(payloadLimitFilter, BasicAuthenticationFilter::class.java)
            .addFilterBefore(originFilter, BasicAuthenticationFilter::class.java)
            .addFilterBefore(rateLimitFilter, BasicAuthenticationFilter::class.java)
        return http.build()
    }

    private fun apiAuthenticationEntryPoint() = AuthenticationEntryPoint { _, response, _ ->
        writeError(response, 401, "UNAUTHORIZED", "Authentication required")
    }
}

internal fun writeError(response: HttpServletResponse, status: Int, code: String, message: String) {
    response.status = status
    response.contentType = "application/json"
    response.characterEncoding = "UTF-8"
    response.writer.write("{\"success\":false,\"error\":{\"code\":\"$code\",\"message\":\"$message\"}}")
}
