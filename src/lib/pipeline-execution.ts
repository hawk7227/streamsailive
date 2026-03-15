
import { generateContent } from '@/lib/ai';
import { GenerationType } from '@/lib/ai/types';

const replaceVariables = (text: string, context: any) => {
    if (!text) return "";
    if (typeof text !== 'string') return text;
    return text.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (match, path) => {
        const parts = path.split(".");
        let current = context;
        for (const part of parts) {
            if (current === undefined || current === null) return match;
            current = current[part];
        }
        return current !== undefined ? String(current) : match;
    });
};

export async function executeNode(node: any, context: any) {
    // Handle ReactFlow generic 'pipelineNode' type
    const type = (node.type === 'pipelineNode' ? node.data?.type : node.type) || 'unknown';
    const data = node.data || {};

    let output: any = {};
    const generationId = crypto.randomUUID();

    // Small processing delay for UX
    await new Promise(resolve => setTimeout(resolve, 300));

    try {
        // ---------------------------------------------------------------
        // SCRIPT WRITER — uses AI provider system (e.g. OpenAI gpt-4o-mini)
        // ---------------------------------------------------------------
        if (type === 'scriptWriter') {
            const prompt = data.content || "";
            const processedPrompt = replaceVariables(prompt, context);

            try {
                const result = await generateContent('script' as GenerationType, {
                    prompt: processedPrompt,
                    style: data.style,
                });

                output = {
                    prompt_used: processedPrompt,
                    script: result.responseText || "No script generated.",
                    status: result.status,
                };
            } catch (err: any) {
                console.error("[Pipeline] scriptWriter error:", err);
                output = { status: "error", error: err.message, script: "Failed to generate script." };
            }

            // ---------------------------------------------------------------
            // IMAGE GENERATOR — uses AI provider system (e.g. DALL-E, Runway)
            // ---------------------------------------------------------------
        } else if (type === 'imageGenerator') {
            const prompt = data.content || "";
            const processedPrompt = replaceVariables(prompt, context);
            const aspectRatio = data.aspectRatio || "16:9";

            try {
                const result = await generateContent('image' as GenerationType, {
                    prompt: processedPrompt,
                    aspectRatio,
                    quality: data.quality,
                    style: data.style,
                });

                output = {
                    prompt_used: processedPrompt,
                    aspect_ratio: aspectRatio,
                    image_url: result.outputUrl || null,
                    external_id: result.externalId || null,
                    status: result.status,
                };
            } catch (err: any) {
                console.error("[Pipeline] imageGenerator error:", err);
                output = {
                    status: "error",
                    error: err.message,
                    image_url: null,
                };
            }

            // ---------------------------------------------------------------
            // VIDEO GENERATOR — uses AI provider system (e.g. Kling, Sora, Veo3)
            // ---------------------------------------------------------------
        } else if (type === 'videoGenerator') {
            const prompt = data.content || "";
            const processedPrompt = replaceVariables(prompt, context);
            const duration = data.duration || "8s";
            const quality = data.quality || "1080p";
            const aspectRatio = data.aspectRatio || "16:9";

            try {
                const result = await generateContent('video' as GenerationType, {
                    prompt: processedPrompt,
                    duration,
                    quality,
                    aspectRatio,
                    style: data.style,
                });

                output = {
                    prompt_used: processedPrompt,
                    duration,
                    quality,
                    aspect_ratio: aspectRatio,
                    video_url: result.outputUrl || null,
                    external_id: result.externalId || null,
                    status: result.status,
                };
            } catch (err: any) {
                console.error("[Pipeline] videoGenerator error:", err);
                output = {
                    status: "error",
                    error: err.message,
                    video_url: null,
                };
            }

            // ---------------------------------------------------------------
            // VOICE GENERATOR — uses AI provider system (e.g. ElevenLabs, OpenAI TTS)
            // ---------------------------------------------------------------
        } else if (type === 'voiceGenerator') {
            const prompt = data.content || "";
            const processedPrompt = replaceVariables(prompt, context);
            const speaker = data.speaker;

            try {
                const result = await generateContent('voice' as GenerationType, {
                    prompt: processedPrompt,
                    style: speaker,   // pass speaker/voice as style hint
                    quality: data.quality,
                });

                output = {
                    text_spoken: processedPrompt,
                    speaker: speaker || "default",
                    audio_url: result.outputUrl || null,
                    external_id: result.externalId || null,
                    status: result.status,
                };
            } catch (err: any) {
                console.error("[Pipeline] voiceGenerator error:", err);
                output = {
                    status: "error",
                    error: err.message,
                    audio_url: null,
                };
            }

            // ---------------------------------------------------------------
            // HTTP REQUEST
            // ---------------------------------------------------------------
        } else if (type === 'httpRequest') {
            const method = data.method || "GET";
            let url = replaceVariables(data.url || "", context);
            let bodyStr: string | null = null;

            if (data.bodyMode === 'fields' && Array.isArray(data.bodyFields)) {
                const payloadObj: Record<string, string> = {};
                data.bodyFields.forEach((field: any) => {
                    if (field.key) {
                        payloadObj[field.key] = replaceVariables(field.value || "", context);
                    }
                });

                if (method === 'GET' || method === 'HEAD') {
                    try {
                        const hasQuery = url.includes('?');
                        const qs = new URLSearchParams(payloadObj).toString();
                        if (qs) url += (hasQuery ? '&' : '?') + qs;
                    } catch (e) {
                        console.error("Error appending query params", e);
                    }
                } else {
                    bodyStr = JSON.stringify(payloadObj);
                }
            } else if (method !== 'GET' && method !== 'HEAD') {
                bodyStr = data.body ? replaceVariables(data.body, context) : null;
            }

            const headersStr = data.headers ? replaceVariables(data.headers, context) : "{}";
            let headers: Record<string, string> = { "Content-Type": "application/json" };
            try {
                Object.assign(headers, JSON.parse(headersStr));
            } catch (e) {
                console.error("Invalid headers JSON", e);
            }

            if (data.authType === 'bearer') {
                headers['Authorization'] = `Bearer ${replaceVariables(data.authToken || "", context)}`;
            } else if (data.authType === 'apiKey') {
                const key = replaceVariables(data.authKey || "", context);
                const value = replaceVariables(data.authValue || "", context);
                if (key && value) headers[key] = value;
            } else if (data.authType === 'basic') {
                const username = replaceVariables(data.authUsername || "", context);
                const password = replaceVariables(data.authPassword || "", context);
                const encoded = btoa(`${username}:${password}`);
                headers['Authorization'] = `Basic ${encoded}`;
            }

            try {
                const response = await fetch(url, {
                    method,
                    headers,
                    body: (method !== 'GET' && method !== 'HEAD' && bodyStr) ? bodyStr : undefined
                });

                const contentType = response.headers.get("content-type");
                let responseData;
                if (contentType && contentType.includes("application/json")) {
                    responseData = await response.json();
                } else {
                    responseData = await response.text();
                }

                output = {
                    status: response.status,
                    statusText: response.statusText,
                    data: responseData,
                    headers: Object.fromEntries(response.headers.entries())
                };
            } catch (fetchError) {
                output = { status: 0, error: String(fetchError), message: "Request failed" };
            }

            // ---------------------------------------------------------------
            // ZAPIER WEBHOOK — always POST JSON to Zapier Catch Hook
            // ---------------------------------------------------------------
        } else if (type === 'zapierWebhook') {
            const webhookUrl = replaceVariables(data.webhookUrl || "", context);

            if (!webhookUrl) {
                return { success: false, error: "Zapier Webhook URL is required." };
            }

            // Build payload from key-value fields
            const payloadObj: Record<string, string> = {};
            if (Array.isArray(data.bodyFields)) {
                data.bodyFields.forEach((field: any) => {
                    if (field.key) {
                        payloadObj[field.key] = replaceVariables(field.value || "", context);
                    }
                });
            }

            try {
                const response = await fetch(webhookUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payloadObj),
                });

                const contentType = response.headers.get("content-type");
                let responseData;
                if (contentType && contentType.includes("application/json")) {
                    responseData = await response.json();
                } else {
                    responseData = await response.text();
                }

                output = {
                    status: response.status,
                    statusText: response.statusText,
                    data: responseData,
                    webhook_url: webhookUrl,
                    payload_sent: payloadObj,
                };
            } catch (fetchError) {
                output = { status: 0, error: String(fetchError), message: "Zapier webhook request failed" };
            }

            // ---------------------------------------------------------------
            // VIDEO EDITOR — json2video SDK
            // ---------------------------------------------------------------
        } else if (type === 'videoEditor') {
            const input = replaceVariables(data.content || "", context);
            const trimStart = data.trimStart || 0;
            const trimEnd = data.trimEnd || 0;

            if (process.env.JSON2VIDEO_API_KEY) {
                try {
                    // eslint-disable-next-line @typescript-eslint/no-var-requires
                    const SDK = require('json2video-sdk');
                    const Movie = SDK.Movie;

                    const movie = new Movie();
                    movie.setAPIKey(process.env.JSON2VIDEO_API_KEY);
                    movie.set("resolution", "1080");
                    movie.set("quality", "high");

                    const jsonConfig = data.jsonConfig ? replaceVariables(data.jsonConfig, context) : null;
                    let advancedConfigApplied = false;

                    if (jsonConfig) {
                        try {
                            const parsedConfig = typeof jsonConfig === 'string' ? JSON.parse(jsonConfig) : jsonConfig;
                            if (parsedConfig.scenes) {
                                parsedConfig.scenes.forEach((scene: any) => movie.addScene(scene));
                            }
                            if (parsedConfig.elements) {
                                parsedConfig.elements.forEach((element: any) => movie.addElement(element));
                            }
                            Object.keys(parsedConfig).forEach(key => {
                                if (key !== 'scenes' && key !== 'elements') movie.set(key, parsedConfig[key]);
                            });
                            advancedConfigApplied = true;
                        } catch (e) {
                            console.error("Invalid JSON Config:", e);
                            throw new Error("Invalid JSON Configuration provided.");
                        }
                    }

                    if (!advancedConfigApplied) {
                        const videoElement: any = { type: "video", src: input };
                        if (trimStart > 0) videoElement.trim_start = parseFloat(trimStart);
                        if (trimEnd > 0) videoElement.trim_end = parseFloat(trimEnd);
                        movie.addElement(videoElement);
                    }

                    const renderResponse = await movie.render();
                    if (!renderResponse || !renderResponse.success) {
                        throw new Error(renderResponse?.message || "Failed to start rendering");
                    }

                    const waitPromise = movie.waitToFinish();
                    const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve('timeout'), 50000));
                    const raceResult: any = await Promise.race([waitPromise, timeoutPromise]);

                    if (raceResult === 'timeout') {
                        output = {
                            status: "processing",
                            message: "Video is rendering. Check back later.",
                            project_id: renderResponse.project
                        };
                    } else if (raceResult && raceResult.movie) {
                        output = {
                            video_url: raceResult.movie.url,
                            thumbnail_url: raceResult.movie.thumbnail,
                            status: "success",
                            project_id: raceResult.project
                        };
                    } else {
                        throw new Error("Unknown error during rendering wait");
                    }
                } catch (err: any) {
                    console.error("JSON2Video Error:", err);
                    output = { status: "error", error: err.message || String(err) };
                }
            } else {
                output = {
                    video_url: input || "https://media.w3.org/2010/05/sintel/trailer.mp4",
                    status: "success",
                    info: "Mock Video Editor (Missing JSON2VIDEO_API_KEY)"
                };
            }

            // ---------------------------------------------------------------
            // WEBHOOK RESPONSE
            // ---------------------------------------------------------------
        } else if (type === 'webhookResponse') {
            let responseContent: any = data.output || "";

            if (data.bodyMode === 'fields' && Array.isArray(data.bodyFields)) {
                const responseObj: Record<string, any> = {};
                data.bodyFields.forEach((field: any) => {
                    if (field.key) {
                        responseObj[field.key] = replaceVariables(field.value || "", context);
                    }
                });
                responseContent = responseObj;
            } else {
                let processedResponse = replaceVariables(responseContent, context);
                try {
                    if (typeof processedResponse === 'string' && (processedResponse.trim().startsWith('{') || processedResponse.trim().startsWith('['))) {
                        processedResponse = JSON.parse(processedResponse);
                    }
                } catch (e) {
                    // keep as string
                }
                responseContent = processedResponse;
            }

            output = { response: responseContent, status: "success" };

            // ---------------------------------------------------------------
            // DEFAULT fallback
            // ---------------------------------------------------------------
        } else {
            output = { message: "Node executed successfully", echo: data };
        }

        return { success: true, output, generationId };

    } catch (error) {
        console.error("Node Execution Error:", error);
        return { success: false, error: String(error) };
    }
}

export async function executePipeline(nodes: any[], edges: any[], initialContext: any = {}) {
    const childrenIds = new Set(edges.map(e => e.target));
    const queue = nodes.filter(n =>
        !childrenIds.has(n.id) ||
        n.type === 'webhook' || n.data?.type === 'webhook' ||
        n.type === 'schedule' || n.data?.type === 'schedule'
    );

    let webhookResponse = null;
    const executed = new Set();
    const visited = new Set();
    const context = { ...initialContext };
    const nodeOutputs = new Map();

    console.log("Starting Pipeline Execution. Roots:", queue.map(n => n.id));

    while (queue.length > 0) {
        const node = queue.shift();
        if (executed.has(node.id)) continue;

        const nodeType = (node.type === 'pipelineNode' ? node.data?.type : node.type) || node.type;
        const parents = edges.filter(e => e.target === node.id).map(e => e.source);
        const allParentsExecuted = parents.every(pid => executed.has(pid));
        const isTrigger = nodeType === 'webhook' || nodeType === 'schedule';

        if (!allParentsExecuted && parents.length > 0 && !isTrigger) {
            if (!visited.has(node.id)) {
                visited.add(node.id);
                queue.push(node);
            }
            continue;
        }

        if (isTrigger) {
            executed.add(node.id);
            const labelKey = (node.data.label || nodeType).toLowerCase().replace(/\s+/g, '_');
            let triggerOutput;
            if (nodeType === 'webhook') {
                triggerOutput = node.data.output ? JSON.parse(node.data.output) : initialContext.webhook;
            } else if (nodeType === 'schedule') {
                triggerOutput = initialContext.schedule || { triggeredAt: new Date().toISOString() };
            }
            context[labelKey] = triggerOutput;
        } else {
            const result: any = await executeNode(node, context);

            if (result.success) {
                const labelKey = (node.data?.label || nodeType).toLowerCase().replace(/\s+/g, '_');
                context[labelKey] = result.output;
                nodeOutputs.set(node.id, result.output);

                if (nodeType === 'webhookResponse') {
                    webhookResponse = result.output.response;
                }
            } else {
                console.error(`Node ${node.id} failed:`, result.error);
            }
            executed.add(node.id);
        }

        const outgoers = edges.filter(e => e.source === node.id).map(e => nodes.find(n => n.id === e.target));
        outgoers.forEach(child => {
            if (child && !executed.has(child.id) && !queue.find(q => q.id === child.id)) {
                queue.push(child);
            }
        });

        if (executed.size === nodes.length) break;
    }

    return { success: true, context, webhookResponse };
}
