import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";

export async function DELETE(
    _request: Request,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    if (!id) {
        return NextResponse.json({ error: "Missing ID" }, { status: 400 });
    }

    const admin = createAdminClient();
    const selection = await getCurrentWorkspaceSelection(admin, user);

    const { error } = await admin
        .from("generations")
        .delete()
        .eq("id", id)
        .eq("workspace_id", selection.current.workspace.id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}

export async function PATCH(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    if (!id) {
        return NextResponse.json({ error: "Missing ID" }, { status: 400 });
    }

    const payload = await request.json().catch(() => ({}));

    // Filter allowed fields to update
    const updates: Record<string, any> = {};
    if (typeof payload.favorited === "boolean") {
        updates.favorited = payload.favorited;
    }

    // Nothing to update
    if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const admin = createAdminClient();
    const selection = await getCurrentWorkspaceSelection(admin, user);

    // Security check: Make sure the generation belongs to the current workspace
    // We can do this implicitly by adding workspace_id to the query
    const { data, error } = await admin
        .from("generations")
        .update(updates)
        .eq("id", id)
        .eq("workspace_id", selection.current.workspace.id)
        .select(
            "id, type, prompt, title, status, aspect_ratio, duration, quality, style, favorited, output_url, created_at"
        )
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
}
