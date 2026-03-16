import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/cron/check-videos
export async function GET(request: Request) {
    // You can secure this route by taking a secret cron key
    // const authHeader = request.headers.get("authorization");
    // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) { return new Response('Unauthorized', { status: 401 }); }

    const admin = createAdminClient();

    const { data: pendingVideos, error } = await admin
        .from("generations")
        .select("*")
        .eq("type", "video")
        .eq("status", "pending")
        .not("external_id", "is", null);

    if (error || !pendingVideos) {
        return NextResponse.json({ error: "Failed to fetch pending videos from database" }, { status: 500 });
    }

    const results = [];

    for (const video of pendingVideos) {
        try {
            const response = await fetch(`https://api.openai.com/v1/videos/${video.external_id}`, {
                headers: {
                    Authorization: `Bearer ${process.env.OPENAI_API_KEY_SORA}`,
                },
            });

            if (!response.ok) {
                console.warn(`Sora poll failed for ${video.external_id}`, response.status);
                continue;
            }

            const result = await response.json();

            if (result.status === "completed") {
                // Fetch the compiled mp4 content stream from Sora API
                const contentRes = await fetch(`https://api.openai.com/v1/videos/${video.external_id}/content`, {
                    headers: {
                        Authorization: `Bearer ${process.env.OPENAI_API_KEY_SORA}`,
                    },
                });

                if (contentRes.ok) {
                    const blob = await contentRes.blob();
                    const arrayBuffer = await blob.arrayBuffer();
                    const buffer = Buffer.from(arrayBuffer);

                    const fileName = `${video.workspace_id}/${video.id}.mp4`;

                    // Use Supabase Admin to push to storage
                    const { error: uploadError } = await admin.storage
                        .from("generations")
                        .upload(fileName, buffer, {
                            contentType: "video/mp4",
                            upsert: true
                        });

                    if (!uploadError) {
                        const { data: publicUrlData } = admin.storage.from("generations").getPublicUrl(fileName);

                        await admin.from("generations").update({
                            status: "completed",
                            output_url: publicUrlData.publicUrl
                        }).eq("id", video.id);

                        results.push({ id: video.id, status: "completed", url: publicUrlData.publicUrl });
                    } else {
                        console.error(`Failed to upload to generation storage for ${video.id}`, uploadError);
                    }
                } else {
                    console.warn(`Failed to fetch content stream for ${video.external_id}`);
                }
            } else if (result.status === "failed") {
                await admin.from("generations").update({ status: "failed" }).eq("id", video.id);
                results.push({ id: video.id, status: "failed" });
            } else {
                // still generating/queued
                results.push({ id: video.id, ...result });
                if (result.progress !== undefined) {
                    await admin.from("generations").update({ progress: result.progress }).eq("id", video.id);
                }
            }
        } catch (err) {
            console.error(`Error processing video pending update ${video.id}`, err);
        }
    }

    return NextResponse.json({ processed: results.length, details: results });
}
