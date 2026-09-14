package dev.goodjob.tasks

import jakarta.validation.ConstraintViolationException
import org.jetbrains.exposed.v1.exceptions.ExposedSQLException
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.web.HttpMediaTypeNotSupportedException
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException
import org.slf4j.LoggerFactory

@RestControllerAdvice
class ApiExceptionHandler {
    @ExceptionHandler(ValidationException::class, MethodArgumentNotValidException::class, ConstraintViolationException::class, HttpMessageNotReadableException::class, MethodArgumentTypeMismatchException::class)
    fun validation(error: Exception) = response(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", safeValidationMessage(error))

    @ExceptionHandler(TaskNotFoundException::class)
    fun notFound() = response(HttpStatus.NOT_FOUND, "TASK_NOT_FOUND", "Task not found")

    @ExceptionHandler(StaleRevisionException::class)
    fun stale() = response(HttpStatus.CONFLICT, "STALE_REVISION", "Task revision is stale")

    @ExceptionHandler(HttpMediaTypeNotSupportedException::class)
    fun mediaType() = response(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json")

    @ExceptionHandler(ExposedSQLException::class)
    fun databaseUnavailable(error: ExposedSQLException): ResponseEntity<ErrorResponse> {
        logger.warn("Task storage operation failed (SQL state={}, vendor code={})", error.sqlState, error.errorCode)
        return response(HttpStatus.SERVICE_UNAVAILABLE, "STORAGE_UNAVAILABLE", "Task storage is unavailable")
    }

    private fun response(status: HttpStatus, code: String, message: String) =
        ResponseEntity.status(status).body(ErrorResponse(error = ErrorDetail(code, message)))

    private fun safeValidationMessage(error: Exception): String =
        if (error is ValidationException) error.message ?: "Invalid request" else "Invalid request"

    private companion object { val logger = LoggerFactory.getLogger(ApiExceptionHandler::class.java) }
}
