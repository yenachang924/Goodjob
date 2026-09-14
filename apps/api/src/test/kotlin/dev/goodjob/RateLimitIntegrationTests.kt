package dev.goodjob

import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get

@SpringBootTest(properties = [
    "spring.datasource.url=jdbc:h2:mem:rate-limit;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
    "spring.datasource.username=sa", "spring.datasource.password=",
    "goodjob.security.username=learner", "goodjob.security.password=test-password",
    "goodjob.security.rate-limit-per-minute=2",
])
@AutoConfigureMockMvc
class RateLimitIntegrationTests @Autowired constructor(private val mockMvc: MockMvc) {
    @Test
    fun `single instance rate limiter returns the API error envelope`() {
        repeat(2) { mockMvc.get("/api/v1/tasks") { with(httpBasic("learner", "test-password")) }.andExpect { status { isOk() } } }
        mockMvc.get("/api/v1/tasks") { with(httpBasic("learner", "test-password")) }
            .andExpect { status { isTooManyRequests() }; jsonPath("$.error.code") { value("RATE_LIMITED") } }
    }

    @Test
    fun `failed Basic authentication attempts are rate limited by source`() {
        repeat(2) {
            mockMvc.get("/api/v1/tasks") {
                with(httpBasic("learner", "wrong-password"))
                with { request -> request.remoteAddr = "192.0.2.10"; request }
            }.andExpect { status { isUnauthorized() } }
        }
        mockMvc.get("/api/v1/tasks") {
            with(httpBasic("learner", "wrong-password"))
            with { request -> request.remoteAddr = "192.0.2.10"; request }
        }.andExpect { status { isTooManyRequests() }; jsonPath("$.error.code") { value("RATE_LIMITED") } }
    }
}
