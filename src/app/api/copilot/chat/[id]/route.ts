import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentWorkspaceSelection } from '@/lib/team-server';

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    if (!id) {
        return NextResponse.json({ error: 'Chat ID required' }, { status: 400 });
    }

    const admin = createAdminClient();
    try {
        const selection = await getCurrentWorkspaceSelection(admin, user);
        const workspaceId = selection.current.workspace.id;

        const { data: chat, error } = await admin
            .from('copilot_chats')
            .select('*')
            .eq('id', id)
            .eq('workspace_id', workspaceId)
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (!chat) {
            return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
        }

        // Fetch associated landing page to get the latest HTML
        const { data: landingPage } = await admin
            .from('landing_pages')
            .select('html_content, version')
            .eq('copilot_chat_id', chat.id)
            .single();

        return NextResponse.json({
            data: {
                ...chat,
                landingPage // Include landing page data
            }
        });

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const { id } = params;

    if (!id) {
        return NextResponse.json({ error: 'Chat ID required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();

    try {
        const selection = await getCurrentWorkspaceSelection(admin, user);
        const workspaceId = selection.current.workspace.id;

        const { error } = await admin
            .from('copilot_chats')
            .delete()
            .eq('id', id)
            .eq('workspace_id', workspaceId);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
