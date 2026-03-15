import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentWorkspaceSelection } from '@/lib/team-server';

export async function POST(request: Request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string; // 'asset' | 'knowledge'

    if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (type !== 'asset' && type !== 'knowledge') {
        return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }

    const admin = createAdminClient();
    let workspaceId: string;
    try {
        const selection = await getCurrentWorkspaceSelection(admin, user);
        workspaceId = selection.current.workspace.id;
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }

    const fileExt = file.name.split('.').pop()?.toLowerCase();
    const fileName = `${crypto.randomUUID()}-${file.name}`;
    const bucketName = type === 'asset' ? 'copilot-assets' : 'copilot-knowledge';

    // Convert File to Buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await admin
        .storage
        .from(bucketName)
        .upload(`${workspaceId}/${fileName}`, buffer, {
            contentType: file.type,
            upsert: false
        });

    if (uploadError) {
        return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    let publicUrl = null;
    if (type === 'asset') {
        const { data: urlData } = admin.storage.from(bucketName).getPublicUrl(`${workspaceId}/${fileName}`);
        publicUrl = urlData.publicUrl;
    }

    let extractedContent = null;
    if (type === 'knowledge') {
        try {
            if (['txt', 'md', 'json', 'csv', 'js', 'ts', 'jsx', 'tsx', 'py'].includes(fileExt || '')) {
                extractedContent = buffer.toString('utf-8');
            } else if (fileExt === 'pdf') {
                // PDF extraction temporarily disabled due to dependency issues
                extractedContent = "[PDF content extraction unavailable]";
            }
        } catch (err) {
            console.error('Error extracting text:', err);
            // Don't fail the upload if extraction fails
        }
    }

    // Insert record into DB
    const { data: fileRecord, error: dbError } = await admin
        .from('workspace_files')
        .insert({
            workspace_id: workspaceId,
            user_id: user.id,
            name: file.name,
            type: type,
            file_path: `${workspaceId}/${fileName}`,
            public_url: publicUrl,
            extracted_content: extractedContent,
            mime_type: file.type,
            size: file.size,
        })
        .select()
        .single();

    if (dbError) {
        return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ data: fileRecord });
}
