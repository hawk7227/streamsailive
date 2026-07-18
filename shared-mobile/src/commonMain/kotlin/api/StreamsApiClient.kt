package com.streamsai.shared.api

import com.streamsai.shared.errors.StreamsApiException
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.accept
import io.ktor.client.request.bearerAuth
import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.patch
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpMethod
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

class StreamsApiClient(
    baseUrl: String,
    accessToken: String? = null,
    client: HttpClient? = null,
) {
    private val json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
        encodeDefaults = true
    }
    private val http = client ?: HttpClient {
        install(ContentNegotiation) { json(json) }
    }
    private val root = baseUrl.trimEnd('/')
    private val tokenState = MutableStateFlow(accessToken)
    val accessToken: StateFlow<String?> = tokenState

    fun setAccessToken(value: String?) {
        tokenState.value = value?.takeIf { it.isNotBlank() }
    }

    suspend fun auth(): AuthResponse = request("/api/v1/auth")

    suspend inline fun <reified T> get(
        path: String,
        query: Map<String, Any?> = emptyMap(),
    ): T = request(path, HttpMethod.Get, query)

    suspend inline fun <reified T> post(
        path: String,
        body: Any? = null,
        query: Map<String, Any?> = emptyMap(),
        idempotencyKey: String? = null,
    ): T = request(path, HttpMethod.Post, query, body, idempotencyKey)

    suspend inline fun <reified T> patch(
        path: String,
        body: Any? = null,
        query: Map<String, Any?> = emptyMap(),
        idempotencyKey: String? = null,
    ): T = request(path, HttpMethod.Patch, query, body, idempotencyKey)

    suspend inline fun <reified T> delete(
        path: String,
        query: Map<String, Any?> = emptyMap(),
    ): T = request(path, HttpMethod.Delete, query)

    suspend inline fun <reified T> request(
        path: String,
        method: HttpMethod = HttpMethod.Get,
        query: Map<String, Any?> = emptyMap(),
        body: Any? = null,
        idempotencyKey: String? = null,
    ): T {
        val response = execute(path, method, query, body, idempotencyKey)
        if (response.status.value !in 200..299) {
            val error = runCatching { response.body<ApiErrorEnvelope>() }.getOrNull()
            throw StreamsApiException(
                message = error?.error ?: response.status.description,
                status = response.status.value,
                code = error?.code,
                details = error?.details,
            )
        }
        return response.body()
    }

    suspend fun execute(
        path: String,
        method: HttpMethod = HttpMethod.Get,
        query: Map<String, Any?> = emptyMap(),
        body: Any? = null,
        idempotencyKey: String? = null,
    ): HttpResponse {
        val url = root + if (path.startsWith('/')) path else "/$path"
        val configure: io.ktor.client.request.HttpRequestBuilder.() -> Unit = {
            accept(ContentType.Application.Json)
            tokenState.value?.let { bearerAuth(it) }
            idempotencyKey?.takeIf { it.isNotBlank() }?.let { header("Idempotency-Key", it) }
            url {
                query.forEach { (key, raw) ->
                    when (raw) {
                        null -> Unit
                        is Iterable<*> -> raw.forEach { value -> if (value != null) parameters.append(key, value.toString()) }
                        else -> parameters.append(key, raw.toString())
                    }
                }
            }
            if (body != null) {
                contentType(ContentType.Application.Json)
                setBody(body)
            }
        }
        return when (method) {
            HttpMethod.Get -> http.get(url, configure)
            HttpMethod.Post -> http.post(url, configure)
            HttpMethod.Patch -> http.patch(url, configure)
            HttpMethod.Delete -> http.delete(url, configure)
            else -> error("Unsupported Streams v1 method ${method.value}")
        }
    }

    suspend fun jsonObject(
        path: String,
        method: HttpMethod = HttpMethod.Get,
        query: Map<String, Any?> = emptyMap(),
        body: JsonElement? = null,
        idempotencyKey: String? = null,
    ): JsonObject = request(path, method, query, body, idempotencyKey)

    fun close() {
        http.close()
    }
}

class StreamsSseParser {
    private var carry = ""

    fun append(chunk: String): List<SseEvent> {
        val normalized = (carry + chunk).replace("\r\n", "\n")
        val blocks = normalized.split("\n\n").toMutableList()
        carry = blocks.removeLastOrNull().orEmpty()
        return blocks.map { parseBlock(it) }
    }

    fun remainder(): String = carry

    fun reset() {
        carry = ""
    }

    private fun parseBlock(block: String): SseEvent {
        var event = "message"
        var id: String? = null
        var retry: Long? = null
        val data = mutableListOf<String>()
        block.lineSequence().forEach { line ->
            if (line.isBlank() || line.startsWith(':')) return@forEach
            val separator = line.indexOf(':')
            val field = if (separator >= 0) line.substring(0, separator) else line
            val value = if (separator >= 0) line.substring(separator + 1).removePrefix(" ") else ""
            when (field) {
                "event" -> event = value
                "data" -> data += value
                "id" -> id = value
                "retry" -> retry = value.toLongOrNull()
            }
        }
        return SseEvent(event = event, data = data.joinToString("\n"), id = id, retry = retry)
    }
}
