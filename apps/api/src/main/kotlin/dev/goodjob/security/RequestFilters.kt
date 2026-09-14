package dev.goodjob.security

import jakarta.servlet.FilterChain
import jakarta.servlet.ReadListener
import jakarta.servlet.ServletInputStream
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletRequestWrapper
import jakarta.servlet.http.HttpServletResponse
import java.io.BufferedReader
import java.io.ByteArrayInputStream
import java.io.InputStreamReader
import java.time.Clock
import java.util.concurrent.ConcurrentHashMap
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter

@Component
class NoStoreFilter : OncePerRequestFilter() {
    override fun doFilterInternal(request: HttpServletRequest, response: HttpServletResponse, chain: FilterChain) {
        response.setHeader("Cache-Control", "no-store")
        chain.doFilter(request, response)
    }
}

@Component
class PayloadLimitFilter(@Value("\${goodjob.http.max-body-bytes:16384}") private val maxBodyBytes: Long) : OncePerRequestFilter() {
    override fun doFilterInternal(request: HttpServletRequest, response: HttpServletResponse, chain: FilterChain) {
        if (request.contentLengthLong > maxBodyBytes || maxBodyBytes > Int.MAX_VALUE - 1) {
            writeError(response, 413, "PAYLOAD_TOO_LARGE", "Request body is too large")
            return
        }
        if (request.contentLengthLong == 0L || request.method in setOf("GET", "HEAD")) {
            chain.doFilter(request, response)
            return
        }
        val body = request.inputStream.readNBytes(maxBodyBytes.toInt() + 1)
        if (body.size > maxBodyBytes) {
            writeError(response, 413, "PAYLOAD_TOO_LARGE", "Request body is too large")
            return
        }
        chain.doFilter(CachedBodyRequest(request, body), response)
    }
}

private class CachedBodyRequest(request: HttpServletRequest, private val body: ByteArray) : HttpServletRequestWrapper(request) {
    override fun getInputStream(): ServletInputStream = ByteArrayServletInputStream(body)
    override fun getReader(): BufferedReader = BufferedReader(InputStreamReader(inputStream, characterEncoding ?: Charsets.UTF_8.name()))
    override fun getContentLength(): Int = body.size
    override fun getContentLengthLong(): Long = body.size.toLong()
}

private class ByteArrayServletInputStream(body: ByteArray) : ServletInputStream() {
    private val input = ByteArrayInputStream(body)
    override fun read(): Int = input.read()
    override fun isFinished(): Boolean = input.available() == 0
    override fun isReady(): Boolean = true
    override fun setReadListener(listener: ReadListener) {
        if (isFinished) listener.onAllDataRead() else listener.onDataAvailable()
    }
}

@Component
class OriginPolicyFilter(@Value("\${goodjob.security.allowed-origin:http://127.0.0.1:8080}") private val allowedOrigin: String) : OncePerRequestFilter() {
    override fun doFilterInternal(request: HttpServletRequest, response: HttpServletResponse, chain: FilterChain) {
        val origin = request.getHeader("Origin")
        val stateChanging = request.method in setOf("POST", "PUT", "PATCH", "DELETE")
        if (stateChanging && origin != null && origin != allowedOrigin) {
            writeError(response, 403, "ORIGIN_REJECTED", "Browser origin is not allowed")
            return
        }
        chain.doFilter(request, response)
    }
}

@Component
class RateLimitFilter(
    @Value("\${goodjob.security.rate-limit-per-minute:120}") private val limit: Int,
    private val clock: Clock = Clock.systemUTC(),
) : OncePerRequestFilter() {
    private val counters = ConcurrentHashMap<String, Counter>()

    override fun doFilterInternal(request: HttpServletRequest, response: HttpServletResponse, chain: FilterChain) {
        val minute = clock.instant().epochSecond / 60
        val key = request.userPrincipal?.name ?: request.remoteAddr
        if (counters.size >= MAX_KEYS) counters.entries.removeIf { it.value.minute < minute }
        if (!counters.containsKey(key) && counters.size >= MAX_KEYS) {
            writeError(response, 429, "RATE_LIMITED", "Too many request sources")
            return
        }
        val next = counters.compute(key) { _, old -> if (old == null || old.minute != minute) Counter(minute, 1) else old.copy(count = old.count + 1) }!!
        if (next.count > limit) {
            response.setHeader("Retry-After", "60")
            writeError(response, 429, "RATE_LIMITED", "Too many requests")
            return
        }
        chain.doFilter(request, response)
    }

    private data class Counter(val minute: Long, val count: Int)
    private companion object { const val MAX_KEYS = 10_000 }
}

@Component
class ClockConfig {
    @org.springframework.context.annotation.Bean
    fun clock(): Clock = Clock.systemUTC()
}
