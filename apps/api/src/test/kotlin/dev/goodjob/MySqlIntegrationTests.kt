package dev.goodjob

import java.sql.SQLException
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.test.web.servlet.post
import org.springframework.test.web.servlet.put

@EnabledIfEnvironmentVariable(named = "GOODJOB_MYSQL_TEST", matches = "true")
@SpringBootTest(
    properties = [
        "goodjob.security.username=learner",
        "goodjob.security.password=test-password",
        "goodjob.security.rate-limit-per-minute=1000",
    ],
)
@AutoConfigureMockMvc
class MySqlIntegrationTests @Autowired constructor(
    private val mockMvc: MockMvc,
    private val jdbc: JdbcTemplate,
) {
    @Test
    fun `parallel creates reuse one project and preserve SQL literals`() {
        assertIsolatedLoopbackDatabase()
        val project = "mysql-create-${UUID.randomUUID()}"
        val titlePrefix = "SQL's ? literal-${UUID.randomUUID()}"

        val responses = concurrently(8) { index ->
            postTask(project, "$titlePrefix $index").status
        }

        assertEquals(List(8) { 201 }, responses.sorted())
        assertEquals(1, count("SELECT COUNT(*) FROM projects WHERE name = ?", project))
        assertEquals(
            8,
            count(
                "SELECT COUNT(*) FROM tasks t JOIN projects p ON p.id = t.project_id WHERE p.name = ?",
                project,
            ),
        )
        assertEquals(
            8,
            count("SELECT COUNT(*) FROM tasks WHERE title LIKE ?", "$titlePrefix%"),
        )
    }

    @Test
    fun `parallel stale updates commit one winner and roll back losing projects`() {
        assertIsolatedLoopbackDatabase()
        val originalProject = "mysql-original-${UUID.randomUUID()}"
        val id = taskId(postTask(originalProject, "before race").contentAsString)
        val projectPrefix = "mysql-race-${UUID.randomUUID()}"
        val titlePrefix = "winner-${UUID.randomUUID()}"

        val responses = concurrently(6) { index ->
            putTask(
                id = id,
                project = "$projectPrefix-$index",
                title = "$titlePrefix-$index",
                revision = 1,
            ).status
        }

        assertEquals(1, responses.count { it == 200 })
        assertEquals(5, responses.count { it == 409 })
        assertEquals(2, jdbc.queryForObject("SELECT revision FROM tasks WHERE id = ?", Int::class.java, id))
        val winnerTitle = jdbc.queryForObject("SELECT title FROM tasks WHERE id = ?", String::class.java, id)
        assertTrue(winnerTitle!!.startsWith(titlePrefix))
        assertEquals(1, count("SELECT COUNT(*) FROM projects WHERE name LIKE ?", "$projectPrefix%"))
    }

    private fun postTask(project: String, title: String) =
        mockMvc.post("/api/v1/tasks") {
            with(httpBasic("learner", "test-password"))
            contentType = MediaType.APPLICATION_JSON
            content = taskJson(project, title)
        }.andReturn().let { result ->
            assertEquals(
                201,
                result.response.status,
                "POST failed; resolved exception chain: ${exceptionDiagnostic(result.resolvedException)}",
            )
            result.response
        }

    private fun putTask(id: String, project: String, title: String, revision: Int) =
        mockMvc.put("/api/v1/tasks/$id") {
            with(httpBasic("learner", "test-password"))
            contentType = MediaType.APPLICATION_JSON
            content = taskJson(project, title, revision)
        }.andReturn().response

    private fun taskJson(project: String, title: String, revision: Int? = null) =
        """{"project":"$project","title":"$title","minutes":30,"priority":2,"done":false,"due":""${revision?.let { ",\"revision\":$it" } ?: ""}}"""

    private fun taskId(body: String): String =
        Regex("\\\"id\\\":\\\"([^\\\"]+)").find(body)!!.groupValues[1]

    private fun count(sql: String, argument: String): Int =
        jdbc.queryForObject(sql, Int::class.java, argument)!!

    private fun exceptionDiagnostic(error: Throwable?): String =
        generateSequence(error) { it.cause }
            .take(8)
            .joinToString(" -> ") { cause ->
                val type = cause::class.qualifiedName ?: cause.javaClass.name
                if (cause is SQLException) {
                    "$type(sqlState=${cause.sqlState},vendorCode=${cause.errorCode})"
                } else {
                    type
                }
            }
            .ifEmpty { "none" }

    private fun assertIsolatedLoopbackDatabase() {
        val url = jdbc.dataSource!!.connection.use { it.metaData.url }
        assertTrue(SAFE_MYSQL_URL.matches(url), "Refusing MySQL test writes to an unsafe database URL")
        assertEquals("goodjob_learning", jdbc.queryForObject("SELECT DATABASE()", String::class.java))
    }

    private fun <T> concurrently(count: Int, action: (Int) -> T): List<T> {
        val executor = Executors.newFixedThreadPool(count)
        val ready = CountDownLatch(count)
        val start = CountDownLatch(1)
        return try {
            val futures = List(count) { index ->
                executor.submit<T> {
                    ready.countDown()
                    start.await()
                    action(index)
                }
            }
            assertTrue(ready.await(5, TimeUnit.SECONDS), "Workers did not reach the race barrier")
            start.countDown()
            futures.map { it.get(30, TimeUnit.SECONDS) }
        } finally {
            start.countDown()
            executor.shutdownNow()
        }
    }

    private companion object {
        val SAFE_MYSQL_URL =
            Regex("^jdbc:mysql://(?:127\\.0\\.0\\.1|localhost|\\[::1])(?::\\d+)?/goodjob_learning(?:\\?.*)?$")

        @JvmStatic
        @DynamicPropertySource
        fun mysqlProperties(registry: DynamicPropertyRegistry) {
            val url = requireNotNull(System.getenv("GOODJOB_MYSQL_TEST_URL")) {
                "GOODJOB_MYSQL_TEST_URL is required for the opt-in MySQL tests"
            }
            require(SAFE_MYSQL_URL.matches(url)) {
                "GOODJOB_MYSQL_TEST_URL must target loopback MySQL database goodjob_learning"
            }
            val username = requireNotNull(System.getenv("GOODJOB_MYSQL_TEST_USERNAME")) {
                "GOODJOB_MYSQL_TEST_USERNAME is required for the opt-in MySQL tests"
            }
            val password = requireNotNull(System.getenv("GOODJOB_MYSQL_TEST_PASSWORD")) {
                "GOODJOB_MYSQL_TEST_PASSWORD is required for the opt-in MySQL tests"
            }
            registry.add("spring.datasource.url") { url }
            registry.add("spring.datasource.username") { username }
            registry.add("spring.datasource.password") { password }
        }
    }
}
