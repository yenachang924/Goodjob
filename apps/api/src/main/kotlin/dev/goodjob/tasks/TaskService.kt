package dev.goodjob.tasks

import java.time.LocalDate
import java.time.format.DateTimeParseException
import java.util.UUID
import org.springframework.stereotype.Service

@Service
class TaskService(private val repository: TaskRepository) {
    fun list(page: Int, size: Int): SuccessResponse<List<TaskView>> {
        if (page !in 0..10_000 || size !in 1..100) throw ValidationException("page must be between 0 and 10000 and size must be between 1 and 100")
        val (tasks, total) = repository.list(page, size)
        return SuccessResponse(data = tasks, meta = PageMeta(total, page, size))
    }

    fun create(input: TaskInput): TaskView = repository.create(validate(input))

    fun update(id: UUID, input: TaskUpdate): TaskView {
        val valid = validate(TaskInput(input.project, input.title, input.minutes, input.priority, input.done, input.due))
        return when (val result = repository.update(id, valid, input.revision)) {
            UpdateResult.Missing -> throw TaskNotFoundException()
            UpdateResult.Stale -> throw StaleRevisionException()
            is UpdateResult.Updated -> result.task
        }
    }

    private fun validate(input: TaskInput): ValidTask {
        val project = input.project.trim()
        val title = input.title.trim()
        if (project.isEmpty() || project.length > 100 || title.isEmpty() || title.length > 300) {
            throw ValidationException("project and title must contain non-whitespace text within their length limits")
        }
        val due = if (input.due.isEmpty()) null else if (!ISO_DATE.matches(input.due)) {
            throw ValidationException("due must be empty or an ISO date")
        } else try {
            LocalDate.parse(input.due)
        } catch (_: DateTimeParseException) {
            throw ValidationException("due must be empty or an ISO date")
        }
        return ValidTask(project, title, input.minutes, input.priority, input.done, due)
    }

    private companion object { val ISO_DATE = Regex("\\d{4}-\\d{2}-\\d{2}") }
}

class ValidationException(message: String) : RuntimeException(message)
class TaskNotFoundException : RuntimeException("Task not found")
class StaleRevisionException : RuntimeException("Task revision is stale")
