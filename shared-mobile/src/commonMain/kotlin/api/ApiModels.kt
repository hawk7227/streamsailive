package com.streamsai.shared.api

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

@Serializable
data class ApiErrorEnvelope(
    val ok: Boolean = false,
    val apiVersion: String = "v1",
    val error: String,
    val code: String? = null,
    val details: JsonElement? = null,
)

@Serializable
data class ApiSuccessEnvelope(
    val ok: Boolean = true,
    val apiVersion: String = "v1",
)

@Serializable
data class CursorPage<T>(
    val items: List<T> = emptyList(),
    val nextCursor: String? = null,
    val hasMore: Boolean = false,
)

@Serializable
data class SessionScope(
    val tenantId: String,
    val userId: String,
    val defaultProjectId: String? = null,
    val workspaceId: String = "streams-ai",
    val moduleId: String = "streams-ai-core",
    val productId: String = "streams-ai",
    val userFirstName: String? = null,
    val userFullName: String? = null,
    val userDisplayName: String? = null,
)

@Serializable
data class AuthResponse(
    val ok: Boolean,
    val apiVersion: String,
    val authenticated: Boolean,
    val scope: SessionScope,
)

@Serializable
data class JsonEnvelope(
    val ok: Boolean = true,
    val apiVersion: String = "v1",
    val data: JsonObject? = null,
)

@Serializable
data class SseEvent(
    val event: String = "message",
    val data: String = "",
    val id: String? = null,
    val retry: Long? = null,
)

@Serializable
enum class HttpMethodName {
    @SerialName("GET") GET,
    @SerialName("POST") POST,
    @SerialName("PATCH") PATCH,
    @SerialName("DELETE") DELETE,
}
