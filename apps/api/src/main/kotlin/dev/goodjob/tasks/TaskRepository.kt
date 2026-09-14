package dev.goodjob.tasks

import java.time.LocalDate
import java.util.UUID
import org.jetbrains.exposed.v1.core.ResultRow
import org.jetbrains.exposed.v1.core.and
import org.jetbrains.exposed.v1.core.eq
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.insert
import org.jetbrains.exposed.v1.jdbc.insertIgnore
import org.jetbrains.exposed.v1.jdbc.selectAll
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import org.jetbrains.exposed.v1.jdbc.update
import org.jetbrains.exposed.v1.exceptions.ExposedSQLException
import org.springframework.stereotype.Repository

@Repository
class TaskRepository(private val database: Database) {
    fun list(page: Int, size: Int): Pair<List<TaskView>, Long> = transaction(database) {
        val total = Tasks.selectAll().count()
        val rows = (Tasks innerJoin Projects)
            .selectAll()
            .orderBy(Tasks.id)
            .limit(size)
            .offset(page.toLong() * size)
            .map(::toView)
        rows to total
    }

    fun create(input: ValidTask): TaskView = createWithRetry(input, DEADLOCK_ATTEMPTS)

    private fun createWithRetry(input: ValidTask, attemptsRemaining: Int): TaskView = try {
        transaction(database) {
            maxAttempts = 1
            val projectId = findOrCreateProject(input.project)
            val id = UUID.randomUUID()
            Tasks.insert {
                it[Tasks.id] = id.toString()
                it[Tasks.projectId] = projectId
                it[title] = input.title
                it[minutes] = input.minutes
                it[priority] = input.priority
                it[done] = input.done
                it[due] = input.due
                it[revision] = 1
            }
            find(id) ?: error("Inserted task was not found")
        }
    } catch (error: ExposedSQLException) {
        if (error.sqlState == DEADLOCK_SQL_STATE && attemptsRemaining > 1) {
            try {
                Thread.sleep((DEADLOCK_ATTEMPTS - attemptsRemaining + 1) * RETRY_DELAY_MILLIS)
            } catch (_: InterruptedException) {
                Thread.currentThread().interrupt()
                throw error
            }
            createWithRetry(input, attemptsRemaining - 1)
        } else {
            throw error
        }
    }

    fun update(id: UUID, input: ValidTask, expectedRevision: Int): UpdateResult = try {
        transaction(database) {
            val existing = Tasks.selectAll().where { Tasks.id eq id.toString() }.forUpdate().singleOrNull()
                ?: return@transaction UpdateResult.Missing
            if (existing[Tasks.revision] != expectedRevision) return@transaction UpdateResult.Stale
            val projectId = findOrCreateProject(input.project)
            val changed = Tasks.update({ (Tasks.id eq id.toString()) and (Tasks.revision eq expectedRevision) }) {
                it[Tasks.projectId] = projectId
                it[title] = input.title
                it[minutes] = input.minutes
                it[priority] = input.priority
                it[done] = input.done
                it[due] = input.due
                it[revision] = expectedRevision + 1
            }
            if (changed == 0) throw StaleWriteRollback()
            UpdateResult.Updated(find(id)!!)
        }
    } catch (_: StaleWriteRollback) {
        UpdateResult.Stale
    }

    private fun find(id: UUID): TaskView? = (Tasks innerJoin Projects)
        .selectAll().where { Tasks.id eq id.toString() }.forUpdate().singleOrNull()?.let(::toView)

    private fun findOrCreateProject(name: String): Long {
        Projects.selectAll().where { Projects.name eq name }.singleOrNull()?.let { return it[Projects.id] }
        Projects.insertIgnore { it[Projects.name] = name }
        return Projects.selectAll().where { Projects.name eq name }.forUpdate().single()[Projects.id]
    }

    private fun toView(row: ResultRow) = TaskView(
        id = UUID.fromString(row[Tasks.id]),
        project = row[Projects.name],
        title = row[Tasks.title],
        minutes = row[Tasks.minutes],
        priority = row[Tasks.priority],
        done = row[Tasks.done],
        due = row[Tasks.due]?.toString() ?: "",
        revision = row[Tasks.revision],
    )

    private companion object {
        const val DEADLOCK_ATTEMPTS = 3
        const val DEADLOCK_SQL_STATE = "40001"
        const val RETRY_DELAY_MILLIS = 10L
    }
}

private class StaleWriteRollback : RuntimeException()

data class ValidTask(
    val project: String,
    val title: String,
    val minutes: Int,
    val priority: Int,
    val done: Boolean,
    val due: LocalDate?,
)

sealed interface UpdateResult {
    data class Updated(val task: TaskView) : UpdateResult
    data object Missing : UpdateResult
    data object Stale : UpdateResult
}
