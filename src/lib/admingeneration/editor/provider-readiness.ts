export type ProviderReadiness = {
  id: string;
  label: string;
  requiredEnv: string[];
  routes: string[];
  ready: boolean;
  missingEnv: string[];
};

function hasEnv(name: string) {
  return Boolean(process.env[name] && String(process.env[name]).trim());
}

export function getProviderReadiness(): ProviderReadiness[] {
  const providers = [
    {
      id: "ffmpeg",
      label: "FFmpeg media worker",
      requiredEnv: [],
      routes: ["/api/pipeline-test/audio/extract", "/api/pipeline-test/audio/separate", "/api/streams/stitch"],
    },
    {
      id: "fal",
      label: "fal.ai video/image analysis",
      requiredEnv: ["FAL_API_KEY"],
      routes: ["/api/streams/video/generate"],
    },
    {
      id: "runway",
      label: "Runway video editing",
      requiredEnv: ["RUNWAY_API_KEY"],
      routes: ["/api/streams/video/edit-motion", "/api/streams/video/edit-emotion"],
    },
    {
      id: "kling",
      label: "Kling video generation",
      requiredEnv: ["KLING_ACCESS_KEY", "KLING_SECRET_KEY"],
      routes: ["/api/streams/video/generate"],
    },
    {
      id: "veo",
      label: "Veo high-end generation",
      requiredEnv: ["VEO_API_KEY"],
      routes: ["/api/streams/video/generate"],
    },
    {
      id: "elevenlabs",
      label: "ElevenLabs voice",
      requiredEnv: ["ELEVENLABS_API_KEY"],
      routes: ["/api/streams/voice/generate", "/api/streams/video/edit-voice"],
    },
  ];

  return providers.map((provider) => {
    const missingEnv = provider.requiredEnv.filter((key) => !hasEnv(key));
    return {
      ...provider,
      ready: missingEnv.length === 0,
      missingEnv,
    };
  });
}
