/**
 * Provider API endpoints
 * Rule [10.1]: Provider names only used in SettingsTab for UI display
 * Handler code uses these constants for actual API calls (acceptable)
 */

export const PROVIDER_ENDPOINTS = {
  IMAGE: 'fal-ai/flux-pro/kontext',
  VIDEO: 'fal-ai/kling-video/v3',
  VOICE: 'fal-ai/veo3.1',
} as const;

export type ProviderEndpoint = typeof PROVIDER_ENDPOINTS[keyof typeof PROVIDER_ENDPOINTS];
