import { getSiteConfigSync } from "../config";
import { AIProvider, GenerationOptions, GenerationResult, GenerationType } from "./types";
import type { FalImageModelKey, FalVideoModelKey } from "./providers/fal";
import { OpenAIProvider } from "./providers/openai";
import { ClaudeProvider } from "./providers/claude";
import { KlingProvider } from "./providers/kling";
import { Veo3Provider } from "./providers/veo3";
import { ElevenlabsProvider } from "./providers/elevenlabs";
import { RunwayProvider } from "./providers/runway";
import { FalProvider } from "./providers/fal";

// Instantiate providers once
const providers: Record<string, AIProvider> = {
    openai: new OpenAIProvider(),
    claude: new ClaudeProvider(),
    kling: new KlingProvider(),
    veo3: new Veo3Provider(),
    elevenlabs: new ElevenlabsProvider(),
    runway: new RunwayProvider(),
    fal: new FalProvider(),
};

const FAL_IMAGE_MODELS: FalImageModelKey[] = ["seedream-lite-v5", "nano-banana-2"];
const FAL_VIDEO_MODELS: FalVideoModelKey[] = ["kling-v3", "veo-3.1"];

function resolveProvider(type: GenerationType, options: GenerationOptions, providerOverride?: string): string {
    if (providerOverride) return providerOverride;
    const explicitModel = typeof options.model === "string" ? options.model : "";

    if (type === "image") {
        if (explicitModel === "openai-image") return "openai";
        if (FAL_IMAGE_MODELS.includes(explicitModel as FalImageModelKey)) return "fal";
    }

    if (type === "video" || type === "i2v") {
        if (FAL_VIDEO_MODELS.includes(explicitModel as FalVideoModelKey)) return "fal";
    }

    const config = getSiteConfigSync();
    return config.aiProviders?.[type] || "openai";
}

/**
 * Main entry point for generating AI content.
 * It resolves provider from explicit override first, then model, then site config.
 */
export async function generateContent(
    type: GenerationType,
    options: GenerationOptions,
    providerOverride?: string
): Promise<GenerationResult> {
    const providerKey = resolveProvider(type, options, providerOverride);

    const provider = providers[providerKey.toLowerCase()];

    if (!provider) {
        throw new Error(`AI Provider '${providerKey}' is not configured for type '${type}'`);
    }

    console.log(`[AI Routing] Generating ${type} using provider: ${providerKey}`);
    try {
        return await provider.generate(type, options);
    } catch (err) {
        // Kling failed — try Runway as fallback for video/i2v
        const isVideoType = type === "video" || type === "i2v";
        const isKling = providerKey.toLowerCase() === "kling";
        if (isVideoType && isKling && providers["runway"]) {
            console.warn(`[AI Routing] Kling failed for ${type}, falling back to Runway:`, err instanceof Error ? err.message : err);
            return await providers["runway"].generate(type, options);
        }
        throw err;
    }
}
