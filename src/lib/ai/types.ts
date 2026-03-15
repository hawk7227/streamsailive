export type GenerationType = "script" | "image" | "video" | "voice";

export interface GenerationOptions {
    prompt: string;
    aspectRatio?: string;
    duration?: string;
    quality?: string;
    style?: string;
}

export interface GenerationResult {
    status: "completed" | "pending" | "failed";
    outputUrl?: string | null;
    externalId?: string | null;
    responseText?: string | null;
}

export interface AIProvider {
    generate(type: GenerationType, options: GenerationOptions): Promise<GenerationResult>;
}
