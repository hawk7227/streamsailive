package com.streamsai.shared.auth

import com.streamsai.shared.api.SessionScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.serialization.Serializable

@Serializable
data class AuthTokens(
    val accessToken: String,
    val refreshToken: String? = null,
    val expiresAtEpochSeconds: Long? = null,
)

sealed interface AuthState {
    data object SignedOut : AuthState
    data object Restoring : AuthState
    data class SignedIn(val tokens: AuthTokens, val scope: SessionScope? = null) : AuthState
    data class Failed(val message: String) : AuthState
}

class AuthStore(initial: AuthState = AuthState.SignedOut) {
    private val mutable = MutableStateFlow(initial)
    val state: StateFlow<AuthState> = mutable

    fun restore(tokens: AuthTokens) {
        mutable.value = AuthState.SignedIn(tokens)
    }

    fun attachScope(scope: SessionScope) {
        val current = mutable.value
        if (current is AuthState.SignedIn) mutable.value = current.copy(scope = scope)
    }

    fun beginRestore() {
        mutable.value = AuthState.Restoring
    }

    fun fail(message: String) {
        mutable.value = AuthState.Failed(message)
    }

    fun signOut() {
        mutable.value = AuthState.SignedOut
    }
}
