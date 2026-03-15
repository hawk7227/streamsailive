import { AIProvider, GenerationOptions, GenerationResult, GenerationType } from "../types";
import jwt from "jsonwebtoken";
import { getSiteConfig } from "../../config";

export class KlingProvider implements AIProvider {
    private generateToken(): string {
        const config = getSiteConfig();
        const sk = config.apiKeys?.KLING_API_KEY || process.env.KLING_API_KEY;
        const ak = config.apiKeys?.KLING_ASSESS_API_KEY || process.env.KLING_ASSESS_API_KEY;

        if (!ak || !sk) {
            throw new Error("KLING_API_KEY or KLING_ASSESS_API_KEY is not set");
        }

        const payload = {
            iss: ak,
            exp: Math.floor(Date.now() / 1000) + 1800,
            nbf: Math.floor(Date.now() / 1000) - 5
        };

        return jwt.sign(payload, sk, { header: { alg: "HS256", typ: "JWT" } });
    }

    async generate(type: GenerationType, options: GenerationOptions): Promise<GenerationResult> {
        if (type === "image") {
            return this.generateImage(options);
        } else if (type === "video") {
            return this.generateVideo(options);
        }

        console.warn(`KlingProvider called for unsupported type: ${type}`);
        throw new Error(`Kling provider does not currently support generating ${type}.`);
    }

    private async generateImage(options: GenerationOptions): Promise<GenerationResult> {
        const token = this.generateToken();

        // 1. Submit the image task
        const submitResponse = await fetch("https://api-singapore.klingai.com/v1/images/generations", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model_name: "kling-v2-1",
                prompt: options.prompt,
                negative_prompt: "",
                n: 1,
            }),
        });

        if (!submitResponse.ok) {
            const errorText = await submitResponse.text();
            console.error("Kling API submit error:", errorText);
            throw new Error(`Kling Image generation failed: ${submitResponse.statusText}`);
        }

        const submitResult = await submitResponse.json();

        if (submitResult.code !== 0 || !submitResult.data?.task_id) {
            throw new Error(`Kling Image generation failed: ${submitResult.message}`);
        }

        const taskId = submitResult.data.task_id;
        console.log(`[Kling] Image task submitted: ${taskId}. Polling for completion...`);

        // 2. Poll for completion (up to ~60 seconds)
        const maxRetries = 20;
        const delayMs = 3000;

        for (let i = 0; i < maxRetries; i++) {
            await new Promise(resolve => setTimeout(resolve, delayMs));

            const checkResponse = await fetch(`https://api-singapore.klingai.com/v1/images/generations/${taskId}`, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`,
                },
            });

            if (!checkResponse.ok) continue;

            const checkResult = await checkResponse.json();

            if (checkResult.code !== 0) continue;

            const status = checkResult.data?.task_status;

            if (status === "succeed") {
                const imageUrl = checkResult.data?.task_result?.images?.[0]?.url;
                if (imageUrl) {
                    return {
                        status: "completed",
                        outputUrl: imageUrl,
                    };
                }
                break;
            } else if (status === "failed") {
                console.error("Kling Image generation failed:", checkResult.data?.task_status_msg);
                return { status: "failed" };
            }
            // If "submitted" or "processing", loop continues
        }

        console.warn(`[Kling] Image generation timed out waiting for task ${taskId}`);
        return {
            status: "pending",
            externalId: taskId
        };
    }

    private async generateVideo(options: GenerationOptions): Promise<GenerationResult> {
        const token = this.generateToken();

        const aspectRatio = options.aspectRatio || "16:9";
        const durationStr = options.duration || "5";
        const duration = durationStr.replace("s", "");

        const submitResponse = await fetch("https://api-singapore.klingai.com/v1/videos/text2video", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model_name: "kling-v2-6",
                prompt: options.prompt,
                negative_prompt: "",
                duration: duration,
                mode: "pro",
                sound: "on",
                aspect_ratio: aspectRatio,
            }),
        });

        if (!submitResponse.ok) {
            const errorText = await submitResponse.text();
            console.error("Kling Video API submit error:", errorText);
            throw new Error(`Kling Video generation failed: ${submitResponse.statusText}`);
        }

        const submitResult = await submitResponse.json();

        if (submitResult.code !== 0 || !submitResult.data?.task_id) {
            console.error("Kling Video generation failed:", submitResult.message);
            throw new Error(`Kling Video generation failed: ${submitResult.message}`);
        }

        const taskId = submitResult.data.task_id;

        // Return pending since videos take several minutes to generate.
        return {
            status: "pending",
            externalId: taskId,
        };
    }
}
