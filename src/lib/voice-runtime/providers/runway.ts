/**
 * runway provider disabled for production build.
 *
 * Reason:
 * This provider used stale video-runtime type names inside voice-runtime.
 * It is disabled until rebuilt against the real voice-runtime provider contract.
 */

type DisabledProviderResult = {
  accepted: false;
  provider: string;
  providerJobId: null;
  status: "failed";
  outputUrl: null;
  audioUrl: null;
  mimeType: "audio/mpeg";
  raw: string;
  error: string;
};

function disabledProviderResult(): DisabledProviderResult {
  return {
    accepted: false,
    provider: "runway",
    providerJobId: null,
    status: "failed",
    outputUrl: null,
    audioUrl: null,
    mimeType: "audio/mpeg",
    raw: "runway provider disabled for production build.",
    error: "runway provider disabled for production build.",
  };
}


export async function pollRunwayVideo(..._args: unknown[]): Promise<DisabledProviderResult> {
  return disabledProviderResult();
}

export async function submitRunwayVideo(..._args: unknown[]): Promise<DisabledProviderResult> {
  return disabledProviderResult();
}



export default {
  provider: "runway",
  disabled: true,
  submit: async (..._args: unknown[]): Promise<DisabledProviderResult> => disabledProviderResult(),
  status: async (..._args: unknown[]): Promise<DisabledProviderResult> => disabledProviderResult(),
  poll: async (..._args: unknown[]): Promise<DisabledProviderResult> => disabledProviderResult(),
};
