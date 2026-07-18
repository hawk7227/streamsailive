package com.streamsai.shared.projects

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

@Serializable
data class ProjectFile(
    val id: String? = null,
    val assetId: String? = null,
    val name: String? = null,
    val kind: String? = null,
    val mimeType: String? = null,
    val sizeBytes: Long = 0,
    val storageUrl: String? = null,
    val previewUrl: String? = null,
    val url: String? = null,
    val createdAt: String? = null,
)

@Serializable
data class ProjectSummary(
    val id: String,
    val name: String,
    val instructions: String = "",
    val files: List<ProjectFile> = emptyList(),
    val chatIds: List<String> = emptyList(),
    val storageUsedBytes: Long = 0,
    val createdAt: String? = null,
    val updatedAt: String? = null,
    val metadata: JsonObject = JsonObject(emptyMap()),
)

@Serializable
data class ProjectsResponse(
    val ok: Boolean,
    val apiVersion: String,
    val projects: List<ProjectSummary> = emptyList(),
    val project: ProjectSummary? = null,
)

@Serializable
data class ProjectUpdateRequest(
    val projectId: String? = null,
    val name: String? = null,
    val instructions: String? = null,
    val files: List<ProjectFile>? = null,
    val chatIds: List<String>? = null,
    val moveSessionId: String? = null,
    val removeFileId: String? = null,
    val clearFiles: Boolean = false,
)
