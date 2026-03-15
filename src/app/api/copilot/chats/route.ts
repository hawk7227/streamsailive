import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentWorkspaceSelection } from '@/lib/team-server';

export async function GET(request: Request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();
    try {
        const selection = await getCurrentWorkspaceSelection(admin, user);
        const workspaceId = selection.current.workspace.id;

        const { data: chats, error } = await admin
            .from('copilot_chats')
            .select('id, title, created_at, updated_at, messages')
            .eq('workspace_id', workspaceId)
            .order('updated_at', { ascending: false });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const formattedChats = chats.map((chat: any) => {
            const messages = chat.messages || [];
            const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
            // Get a preview from the last message or empty string
            let preview = '';
            if (lastMessage && typeof lastMessage.content === 'string') {
                preview = lastMessage.content.substring(0, 100);
            } else if (messages.length > 0) {
                preview = '...';
            }

            // Format date (simple ISO string, client handles display)
            // Using created_at for 'date' field to match existing UI mock logic if needed, 
            // but updated_at is better for sorting.
            // The UI expects 'date' string.
            const updatedDate = new Date(chat.updated_at);
            const now = new Date();
            let dateString = updatedDate.toLocaleDateString();

            // Simple "Today/Yesterday" logic
            if (updatedDate.toDateString() === now.toDateString()) {
                dateString = 'Today';
            } else {
                const yesterday = new Date(now);
                yesterday.setDate(now.getDate() - 1);
                if (updatedDate.toDateString() === yesterday.toDateString()) {
                    dateString = 'Yesterday';
                }
            }

            return {
                id: chat.id,
                title: chat.title || 'New Chat',
                date: dateString,
                preview: preview,
                updatedAt: chat.updated_at,
            };
        });

        return NextResponse.json({ data: formattedChats });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
