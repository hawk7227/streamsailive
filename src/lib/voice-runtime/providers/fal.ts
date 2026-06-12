/**
 * FAL voice provider disabled.
 *
 * Production build was blocked by stale video-style provider types inside the
 * voice runtime FAL provider. FAL is intentionally disabled until the provider
 * contract is rebuilt against the real voice-runtime types.
 */

function disabledFalResult() {
  return {
    accepted: false,
    provider: "fal",
    providerJobId: null,
    status: "failed",
    outputUrl: null,
    audioUrl: null,
    mimeType: "audio/mpeg",
    raw: "FAL provider disabled for production build.",
    error: "FAL provider disabled for production build.",
  };
}

export async function pollFalVideo(..._args: any[]): Promise<any> {
  return disabledFalResult();
}

export async function submitFalVideo(..._args: any[]): Promise<any> {
  return disabledFalResult();
}



export default {
  provider: "fal",
  disabled: true,
  submit: async (..._args: any[]) => disabledFalResult(),
  status: async (..._args: any[]) => disabledFalResult(),
  poll: async (..._args: any[]) => disabledFalResult(),
};
