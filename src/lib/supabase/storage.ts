import { createAdminClient } from "./admin";

const BUCKET = "generations";

/**
 * Uploads an image to Supabase Storage and returns the permanent public URL.
 *
 * Accepts either:
 *  - A remote URL (e.g. from DALL-E / Kling) → fetched and re-uploaded
 *  - A data URI (e.g. `data:image/png;base64,...`) → decoded and uploaded
 *
 * @param imageSource  Remote URL or base64 data URI of the image
 * @param workspaceId  Used as path prefix inside the bucket for organisation
 * @param filename     Optional filename without extension (a UUID is generated if omitted)
 * @returns            Permanent public URL in Supabase Storage
 */
export async function uploadImageToSupabase(
    imageSource: string,
    workspaceId: string,
    filename?: string
): Promise<string> {
    const admin = createAdminClient();

    let buffer: Buffer;
    let mimeType = "image/png";

    if (imageSource.startsWith("data:")) {
        // ── Base64 data URI ────────────────────────────────────────────────
        const [header, base64Data] = imageSource.split(",");
        const mimeMatch = header.match(/data:([^;]+);base64/);
        if (mimeMatch) mimeType = mimeMatch[1];
        buffer = Buffer.from(base64Data, "base64");
    } else {
        // ── Remote URL ────────────────────────────────────────────────────
        const res = await fetch(imageSource);
        if (!res.ok) {
            throw new Error(`Failed to download image from provider: ${res.statusText}`);
        }
        const contentType = res.headers.get("content-type");
        if (contentType) mimeType = contentType.split(";")[0].trim();
        buffer = Buffer.from(await res.arrayBuffer());
    }

    const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
    const name = filename ?? crypto.randomUUID();
    const storagePath = `${workspaceId}/${name}.${ext}`;

    const { error } = await admin.storage
        .from(BUCKET)
        .upload(storagePath, buffer, {
            contentType: mimeType,
            upsert: false,
        });

    if (error) {
        throw new Error(`Supabase Storage upload failed: ${error.message}`);
    }

    const { data } = admin.storage.from(BUCKET).getPublicUrl(storagePath);
    return data.publicUrl;
}
