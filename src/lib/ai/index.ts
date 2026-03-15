import { getSiteConfig } from "../config";
import { AIProvider, GenerationOptions, GenerationResult, GenerationType } from "./types";
import { OpenAIProvider } from "./providers/openai";
import { ClaudeProvider } from "./providers/claude";
import { KlingProvider } from "./providers/kling";
import { Veo3Provider } from "./providers/veo3";
import { ElevenlabsProvider } from "./providers/elevenlabs";
import { RunwayProvider } from "./providers/runway";

// Instantiate providers once
const providers: Record<string, AIProvider> = {
    openai: new OpenAIProvider(),
    claude: new ClaudeProvider(),
    kling: new KlingProvider(),
    veo3: new Veo3Provider(),
    elevenlabs: new ElevenlabsProvider(),
    runway: new RunwayProvider(),
};

/**
 * Main entry point for generating AI content.
 * It reads the desired provider from the site configuration for the given type,
 * and delegates the work to the corresponding initialized provider.
 */
export async function generateContent(
    type: GenerationType,
    options: GenerationOptions
): Promise<GenerationResult> {
    const config = getSiteConfig();

    // Default to openai if not configured
    const providerKey = config.aiProviders?.[type] || "openai";

    const provider = providers[providerKey.toLowerCase()];

    if (!provider) {
        throw new Error(`AI Provider '${providerKey}' is not configured for type '${type}'`);
    }

    console.log(`[AI Routing] Generating ${type} using provider: ${providerKey}`);
    return provider.generate(type, options);
}
