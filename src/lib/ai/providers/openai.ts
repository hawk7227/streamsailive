import { AIProvider, GenerationOptions, GenerationResult, GenerationType } from "../types";
import { getSiteConfigSync } from "../../config";
import { IMAGE_MODEL, OPENAI_API_KEY, OPENAI_API_KEY_IMAGES, OPENAI_API_KEY_SORA, OPENAI_API_KEY_VOICE } from "@/lib/env";

export class OpenAIProvider implements AIProvider {
    async generate(type: GenerationType, options: GenerationOptions): Promise<GenerationResult> {
        if (type === "script") {
            return this.generateScript(options);
        } else if (type === "image") {
            return this.generateImage(options);
        } else if (type === "voice") {
            return this.generateVoice(options);
        } else if (type === "video") {
            return this.generateVideo(options);
        }

        throw new Error(`Unsupported type for OpenAI: ${type}`);
    }

    private async generateScript(options: GenerationOptions): Promise<GenerationResult> {
        const siteConfig = getSiteConfigSync();
        const apiKey = siteConfig.apiKeys?.OPENAI_API_KEY || OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error("OPENAI_API_KEY is not set");
        }

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: options.model || "gpt-4o",
                messages: [{ role: "user", content: options.prompt }],
                temperature: options.temperature ?? 0.7,
            }),
        });

        if (!response.ok) {
            throw new Error(`OpenAI Script generation failed: ${response.statusText}`);
        }

        const result = await response.json();
        if (result.choices && result.choices[0] && result.choices[0].message) {
            return {
                status: "completed",
                responseText: result.choices[0].message.content,
            };
        }

        return { status: "failed" };
    }

    private async generateImage(options: GenerationOptions): Promise<GenerationResult> {
        const siteConfig = getSiteConfigSync();
        const apiKey = siteConfig.apiKeys?.OPENAI_API_KEY_IMAGES || OPENAI_API_KEY_IMAGES || OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error("OPENAI_API_KEY is not set");
        }

        const size = options.aspectRatio === "1:1"
            ? "1024x1024"
            : options.aspectRatio === "9:16" || options.aspectRatio === "4:5"
              ? "1024x1536"
              : "1536x1024";

        const response = await fetch("https://api.openai.com/v1/images/generations", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: options.model || IMAGE_MODEL || "gpt-image-1",
                prompt: options.prompt,
                n: 1,
                size,
            }),
        });

        if (!response.ok) {
            const errBody = await response.json().catch(() => ({})) as { error?: { message?: string; code?: string } };
            const detail = errBody?.error?.message ?? response.statusText;
            throw new Error(`OpenAI Image generation failed (${response.status}): ${detail}`);
        }

        const result = await response.json() as { data?: Array<{ url?: string; b64_json?: string }> };
        const first = result.data?.[0];
        const outputUrl = first?.url ?? (first?.b64_json ? `data:image/png;base64,${first.b64_json}` : undefined);
        if (outputUrl) {
            return {
                status: "completed",
                outputUrl,
            };
        }

        return { status: "failed" };
    }

    private async generateVoice(options: GenerationOptions): Promise<GenerationResult> {
        const siteConfig = getSiteConfigSync();
        const apiKey = siteConfig.apiKeys?.OPENAI_API_KEY_VOICE || OPENAI_API_KEY_VOICE;
        if (!apiKey) {
            throw new Error("OPENAI_API_KEY_VOICE is not set");
        }

        const response = await fetch("https://api.openai.com/v1/audio/speech", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "tts-1",
                input: options.prompt,
                voice: "alloy",
            }),
        });

        if (!response.ok) {
            throw new Error(`OpenAI Voice generation failed: ${response.statusText}`);
        }

        console.log("=== Voice Generation Response ===");
        console.log("Response:", JSON.stringify(response));

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Audio = buffer.toString("base64");

        return {
            status: "completed",
            outputUrl: `data:audio/mp3;base64,${base64Audio}`,
        };
    }

    private async generateVideo(options: GenerationOptions): Promise<GenerationResult> {
        const siteConfig = getSiteConfigSync();
        const apiKey = siteConfig.apiKeys?.OPENAI_API_KEY_SORA || OPENAI_API_KEY_SORA;
        if (!apiKey) {
            throw new Error("OPENAI_API_KEY_SORA is not set");
        }

        try {
            console.log("=== Video Generation Request ===");
            console.log("Prompt:", options.prompt);

            const aspectRatio = options.aspectRatio || "16:9";
            const durationStr = options.duration || "8s";

            let size = "1280x720"; // 16:9
            if (aspectRatio === "9:16") size = "720x1280";
            else if (aspectRatio === "1:1") size = "1024x1024";

            const seconds = durationStr.replace("s", "");

            const formData = new FormData();
            formData.append("prompt", options.prompt);
            formData.append("model", "sora-2-pro");
            formData.append("size", size);
            formData.append("seconds", seconds);

            const response = await fetch("https://api.openai.com/v1/videos", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                },
                body: formData,
            });

            console.log("OpenAI Video Response Status:", response.status, response.statusText);

            if (response.ok) {
                const result = await response.json();
                console.log("OpenAI Video Response Data:", JSON.stringify(result, null, 2));

                if (result.id) {
                    return {
                        status: "pending",
                        externalId: result.id,
                    };
                }
            } else {
                const errorText = await response.text();
                console.warn("Sora generation failed or not available:");
                console.warn("Status:", response.status, response.statusText);
                console.warn("Error Body:", errorText);
            }
        } catch (err) {
            console.warn("Sora generation network/parsing error:", err);
        }

        return { status: "failed" };
    }
}
