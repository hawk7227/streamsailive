package com.streamsai.shared.errors

import kotlinx.serialization.json.JsonElement

open class StreamsException(message: String, cause: Throwable? = null) : Exception(message, cause)

class StreamsApiException(
    message: String,
    val status: Int,
    val code: String? = null,
    val details: JsonElement? = null,
) : StreamsException(message)

class StreamsConflictException(
    message: String,
    val localRevision: Long?,
    val serverRevision: Long?,
) : StreamsException(message)

class StreamsOfflineException(message: String = "Streams is offline") : StreamsException(message)

class StreamsValidationException(message: String) : StreamsException(message)
