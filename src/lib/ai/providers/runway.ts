import { AIProvider, GenerationOptions, GenerationResult, GenerationType } from "../types";
import { getSiteConfig } from "../../config";

export class RunwayProvider implements AIProvider {
    async generate(type: GenerationType, options: GenerationOptions): Promise<GenerationResult> {
        if (type === "image") {
            return this.generateImage(options);
        } else if (type === "video") {
            return this.generateVideo(options);
        }

        console.warn(`RunwayProvider called for unsupported type: ${type}`);
        throw new Error(`Runway provider does not currently support generating ${type}.`);
    }

    private async generateImage(options: GenerationOptions): Promise<GenerationResult> {
        const config = getSiteConfig();
        const apiKey = config.apiKeys?.RUNWAY_API_KEY || process.env.RUNWAY_API_KEY;
        if (!apiKey) {
            throw new Error("RUNWAY_API_KEY is not set");
        }

        const ratio = options.aspectRatio === "9:16" ? "768:1280" : "1280:720";

        const response = await fetch("https://api.dev.runwayml.com/v1/text_to_image", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "X-Runway-Version": "2024-11-06"
            },
            body: JSON.stringify({
                promptText: options.prompt,
                model: "gen4_image",
                ratio: ratio,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Runway API error (Image):", errorText);
            throw new Error(`Runway Image generation failed: ${response.statusText}`);
        }

        const result = await response.json();

        // Runway async endpoints typically return { id: "task_id" }
        if (result.id) {
            return {
                status: "pending",
                externalId: result.id,
            };
        }

        return { status: "failed" };
    }

    private async generateVideo(options: GenerationOptions): Promise<GenerationResult> {
        const config = getSiteConfig();
        const apiKey = config.apiKeys?.RUNWAY_API_KEY || process.env.RUNWAY_API_KEY;
        if (!apiKey) {
            throw new Error("RUNWAY_API_KEY is not set");
        }

        // Adjust ratio mapping if needed (Runway typically supports 1280:768, etc. but relying on standard values)
        const ratio = options.aspectRatio === "9:16" ? "768:1280" : "1280:720";

        let duration = 5;
        if (options.duration) {
            const parsed = parseInt(options.duration.replace("s", ""), 10);
            if (!isNaN(parsed)) duration = parsed;
        }

        const response = await fetch("https://api.dev.runwayml.com/v1/text_to_video", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "X-Runway-Version": "2024-11-06"
            },
            body: JSON.stringify({
                promptText: options.prompt,
                model: "gen4.5",
                ratio: ratio,
                duration: duration > 10 ? 10 : duration, // Cap at something reasonable for Gen4.5
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Runway API error (Video):", errorText);
            throw new Error(`Runway Video generation failed: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.id) {
            return {
                status: "pending",
                externalId: result.id,
            };
        }

        return { status: "failed" };
    }
}
