import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";
import { executeNode } from "@/lib/pipeline-execution";
import { buildImageToVideoMotionPlan, type PipelineNiche,
  type OutputMode,
  type AutomationMode,
} from "@/lib/pipeline/imageToVideoGovernance";

// Map pipeline node types to generation table types
const NODE_TYPE_TO_GENERATION_TYPE: Record<string, string> = {
    scriptWriter: "script",
    imageGenerator: "image",
    videoGenerator: "video",
    voiceGenerator: "voice",
};

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { type, data, context } = body;

        // Execute the node
        const result = await executeNode({ type, data }, context);

        if (!result.success) {
            return NextResponse.json({ success: false, error: result.error }, { status: 500 });
        }

        // If this is an AI generation node, save to the generations table
        const generationType = NODE_TYPE_TO_GENERATION_TYPE[type];
        if (generationType && result.output) {
            try {
                const admin = createAdminClient();
                const selection = await getCurrentWorkspaceSelection(admin, user);

                const output = result.output;

                // Determine output URL and external ID from node output
                const outputUrl =
                    output.image_url ||
                    output.video_url ||
                    output.audio_url ||
                    null;

                const externalId = output.external_id || null;

                // Map generation status
                const status =
                    output.status === "error" ? "failed" :
                        output.status === "processing" ? "pending" :
                            output.external_id ? "pending" :
                                "completed";

                // Prompt used: prefer the processed prompt, fallback to raw content
                const prompt = output.prompt_used || output.text_spoken || data?.content || "";

                // For scripts, save the generated text as prompt (same as generations/route.ts)
                const savedPrompt = output.script ? output.script : prompt;

                await admin.from("generations").insert({
                    user_id: user.id,
                    workspace_id: selection.current.workspace.id,
                    type: generationType,
                    prompt: savedPrompt,
                    title: data?.label || null,
                    status,
                    aspect_ratio: output.aspect_ratio || data?.aspectRatio || null,
                    duration: output.duration || data?.duration || null,
                    quality: output.quality || data?.quality || null,
                    style: data?.style || null,
                    output_url: outputUrl,
                    external_id: externalId,
                });

                console.log(`[Pipeline] Saved ${generationType} generation to DB`);
            } catch (dbErr) {
                // Don't fail the node execution if DB insert fails — just log it
                console.error("[Pipeline] Failed to save generation to DB:", dbErr);
            }
        }

        return NextResponse.json(result);

    } catch (error) {
        console.error("Node Execution Error:", error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
