package dev.goodjob.tasks

import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import java.util.UUID

data class TaskInput(
    @field:NotBlank @field:Size(max = 100) val project: String,
    @field:NotBlank @field:Size(max = 300) val title: String,
    @field:Min(1) @field:Max(1440) val minutes: Int,
    @field:Min(1) @field:Max(3) val priority: Int,
    val done: Boolean,
    val due: String,
)

data class TaskUpdate(
    @field:NotBlank @field:Size(max = 100) val project: String,
    @field:NotBlank @field:Size(max = 300) val title: String,
    @field:Min(1) @field:Max(1440) val minutes: Int,
    @field:Min(1) @field:Max(3) val priority: Int,
    val done: Boolean,
    val due: String,
    @field:Min(1) @field:Max(2147483646) val revision: Int,
)

data class TaskView(
    val id: UUID,
    val project: String,
    val title: String,
    val minutes: Int,
    val priority: Int,
    val done: Boolean,
    val due: String,
    val revision: Int,
)

data class PageMeta(val total: Long, val page: Int, val limit: Int)
data class SuccessResponse<T>(val success: Boolean = true, val data: T, val meta: PageMeta? = null)
data class ErrorDetail(val code: String, val message: String)
data class ErrorResponse(val success: Boolean = false, val error: ErrorDetail)
