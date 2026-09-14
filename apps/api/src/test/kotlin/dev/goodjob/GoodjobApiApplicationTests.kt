package dev.goodjob

import org.junit.jupiter.api.Test
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.test.web.servlet.put
import org.springframework.jdbc.core.JdbcTemplate
import org.junit.jupiter.api.BeforeEach
import org.springframework.beans.factory.annotation.Autowired
import dev.goodjob.tasks.TaskRepository

@SpringBootTest(
	properties = [
		"spring.datasource.url=jdbc:h2:mem:goodjob;MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
		"spring.datasource.username=sa",
		"spring.datasource.password=",
		"goodjob.security.username=learner",
		"goodjob.security.password=test-password",
		"goodjob.security.rate-limit-per-minute=100",
	],
)
@AutoConfigureMockMvc
class GoodjobApiApplicationTests @Autowired constructor(
	private val mockMvc: MockMvc,
	private val jdbc: JdbcTemplate,
	private val repository: TaskRepository,
) {
	@BeforeEach
	fun cleanDatabase() {
		jdbc.update("DELETE FROM tasks")
		jdbc.update("DELETE FROM projects")
	}

	@Test
	fun `authenticated learner sees an empty task page`() {
		mockMvc.get("/api/v1/tasks") {
			with(httpBasic("learner", "test-password"))
		}
			.andExpect {
				status { isOk() }
				jsonPath("$.data") { isEmpty() }
			}
	}

	@Test
	fun `Exposed reads the Flyway-created schema`() {
		kotlin.test.assertEquals(emptyList(), repository.list(0, 20).first)
	}

	@Test
	fun `task lifecycle persists through HTTP and reuses a normalized project`() {
		val first = createTask("  Backend  ", "learn SQL's ? placeholders")
		createTask("Backend", "learn transactions")
		mockMvc.get("/api/v1/tasks?page=0&size=20") { with(httpBasic("learner", "test-password")) }
			.andExpect { status { isOk() }; jsonPath("$.meta.total") { value(2) }; jsonPath("$.data[0].project") { value("Backend") } }
		mockMvc.put("/api/v1/tasks/$first") {
			with(httpBasic("learner", "test-password")); contentType = org.springframework.http.MediaType.APPLICATION_JSON
			content = taskJson("Backend", "learn SQL's ? placeholders", done = true, revision = 1)
		}.andExpect { status { isOk() }; jsonPath("$.data.done") { value(true) }; jsonPath("$.data.revision") { value(2) } }
		kotlin.test.assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM projects", Int::class.java))
	}

	@Test
	fun `security and validation errors use the API envelope`() {
		mockMvc.get("/api/v1/tasks").andExpect { status { isUnauthorized() }; jsonPath("$.success") { value(false) } }
		mockMvc.get("/api/v1/tasks") { with(httpBasic("learner", "wrong-password")) }
			.andExpect { status { isUnauthorized() }; jsonPath("$.error.code") { value("UNAUTHORIZED") } }
		mockMvc.post("/api/v1/tasks") {
			with(httpBasic("learner", "test-password")); contentType = org.springframework.http.MediaType.APPLICATION_JSON
			content = taskJson(" ", " ")
		}.andExpect { status { isBadRequest() }; jsonPath("$.error.code") { value("VALIDATION_ERROR") } }
		mockMvc.post("/api/v1/tasks") {
			with(httpBasic("learner", "test-password")); contentType = org.springframework.http.MediaType.TEXT_PLAIN; content = "x"
		}.andExpect { status { isUnsupportedMediaType() }; jsonPath("$.success") { value(false) } }
		mockMvc.get("/api/v1/tasks?page=-1") { with(httpBasic("learner", "test-password")) }
			.andExpect { status { isBadRequest() } }
		mockMvc.get("/api/v1/tasks?page=10001&size=101") { with(httpBasic("learner", "test-password")) }
			.andExpect { status { isBadRequest() } }
		mockMvc.post("/api/v1/tasks") {
			with(httpBasic("learner", "test-password")); contentType = org.springframework.http.MediaType.APPLICATION_JSON
			content = taskJson("Core", "unknown") .dropLast(1) + ",\"revision\":1}"
		}.andExpect { status { isBadRequest() } }
		mockMvc.post("/api/v1/tasks") {
			with(httpBasic("learner", "test-password")); contentType = org.springframework.http.MediaType.APPLICATION_JSON
			content = """{"project":"Core","title":"fraction","minutes":1.5,"priority":2,"done":false,"due":"2026-09-10"}"""
		}.andExpect { status { isBadRequest() } }
		mockMvc.post("/api/v1/tasks") {
			with(httpBasic("learner", "test-password")); contentType = org.springframework.http.MediaType.APPLICATION_JSON
			content = """{"project":"Core","title":"invalid date","minutes":30,"priority":2,"done":false,"due":"2026-2-03"}"""
		}.andExpect { status { isBadRequest() } }
		mockMvc.post("/api/v1/tasks") {
			with(httpBasic("learner", "test-password")); contentType = org.springframework.http.MediaType.APPLICATION_JSON
			content = "x".repeat(17_000)
		}.andExpect { status { isPayloadTooLarge() }; jsonPath("$.error.code") { value("PAYLOAD_TOO_LARGE") } }
	}

	@Test
	fun `missing and stale updates do not leave project rows or alter tasks`() {
		val id = createTask("Core", "unchanged")
		mockMvc.put("/api/v1/tasks/$id") {
			with(httpBasic("learner", "test-password")); contentType = org.springframework.http.MediaType.APPLICATION_JSON
			content = taskJson("Should rollback", "changed", revision = 99)
		}.andExpect { status { isConflict() }; jsonPath("$.error.code") { value("STALE_REVISION") } }
		mockMvc.put("/api/v1/tasks/00000000-0000-0000-0000-000000000001") {
			with(httpBasic("learner", "test-password")); contentType = org.springframework.http.MediaType.APPLICATION_JSON
			content = taskJson("Missing rollback", "missing", revision = 1)
		}.andExpect { status { isNotFound() } }
		kotlin.test.assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM projects", Int::class.java))
		kotlin.test.assertEquals("unchanged", jdbc.queryForObject("SELECT title FROM tasks WHERE id = ?", String::class.java, id))
	}

	@Test
	fun `responses are no-store and cross-site browser requests are forbidden`() {
		mockMvc.get("/api/v1/tasks") { with(httpBasic("learner", "test-password")) }
			.andExpect { status { isOk() }; header { string("Cache-Control", "no-store") } }
		mockMvc.post("/api/v1/tasks") {
			with(httpBasic("learner", "test-password")); header("Origin", "https://evil.example")
			contentType = org.springframework.http.MediaType.APPLICATION_JSON; content = taskJson("Core", "blocked")
		}.andExpect { status { isForbidden() }; jsonPath("$.error.code") { value("ORIGIN_REJECTED") } }
	}

	private fun createTask(project: String, title: String): String {
		val response = mockMvc.post("/api/v1/tasks") {
			with(httpBasic("learner", "test-password")); contentType = org.springframework.http.MediaType.APPLICATION_JSON
			content = taskJson(project, title)
		}.andExpect { status { isCreated() }; jsonPath("$.data.revision") { value(1) } }.andReturn().response.contentAsString
		return Regex("\\\"id\\\":\\\"([^\\\"]+)").find(response)!!.groupValues[1]
	}

	private fun taskJson(project: String, title: String, done: Boolean = false, revision: Int? = null): String =
		"""{"project":"$project","title":"$title","minutes":30,"priority":2,"done":$done,"due":"2026-09-10"${revision?.let { ",\"revision\":$it" } ?: ""}}"""
}
