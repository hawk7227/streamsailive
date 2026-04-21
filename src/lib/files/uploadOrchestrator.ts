import crypto from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { uploadFileWithHash } from '@/lib/supabase/storage';
import { parseByType } from '@/lib/files/parserRouter';
import { chunkAndIndexFile } from '@/lib/files/chunker';
import { parseImportPaths } from '@/lib/files/importParser';
import { indexFileImports } from '@/lib/files/importIndexer';
import { enqueueJob } from '@/lib/jobs/queue';
import { buildFilePreviewManifest } from '@/lib/files/preview';

export interface UploadOrchestrationInput {
  workspaceId: string;
  userId: string;
  file: File;
  source?: 'chat' | 'operator' | 'api';
  purpose?: 'assistant_context' | 'voice_dataset' | 'knowledge_base';
}

export async function orchestrateFileUpload(input: UploadOrchestrationInput) {
  const admin = createAdminClient();
  const buffer = Buffer.from(await input.file.arrayBuffer());
  const filename = `${crypto.randomUUID()}-${input.file.name}`;
  const parsed = await parseByType(buffer, input.file.name, input.file.type);

  const effectiveIngestType = input.purpose === 'voice_dataset'
    ? 'voice_dataset'
    : parsed.classification.kind === 'audio' || parsed.classification.kind === 'video' || parsed.classification.kind === 'image'
      ? 'asset'
      : parsed.classification.ingestType;

  const upload = await uploadFileWithHash(buffer, {
    workspaceId: input.workspaceId,
    userId: input.userId,
    filename,
    mimeType: input.file.type,
    bucket: effectiveIngestType === 'asset' ? 'media-assets' : effectiveIngestType === 'voice_dataset' ? 'voice-datasets' : 'files',
    isTemp: false,
  });

  const { data: fileRecord, error } = await admin
    .from('files')
    .insert({
      workspace_id: input.workspaceId,
      user_id: input.userId,
      name: input.file.name,
      mime_type: input.file.type,
      size: input.file.size,
      hash: createHash(buffer),
      bucket: upload.bucket,
      storage_path: upload.storagePath,
      public_url: upload.url,
      is_temp: false,
      extracted_text: parsed.text.slice(0, 500000) || null,
      metadata: {
        ...parsed.metadata,
        source: input.source ?? 'chat',
        ingestType: effectiveIngestType,
        uploadPurpose: input.purpose ?? 'assistant_context',
      },
    })
    .select('*')
    .single();

  if (error || !fileRecord) throw new Error(error?.message ?? 'Failed to create file record');

  if (parsed.text) {
    await chunkAndIndexFile(fileRecord.id, parsed.text, input.file.name);

    // Parse and index import edges for cross-file retrieval augmentation.
    // Only runs for code files — returns empty array for all others.
    const importBasenames = parseImportPaths(parsed.text, input.file.name);
    if (importBasenames.length > 0) {
      // Non-fatal — import indexing failure does not block the upload.
      await indexFileImports(fileRecord.id as string, input.workspaceId, importBasenames)
        .catch((err: unknown) => {
          console.error(JSON.stringify({
            level: 'error',
            event: 'IMPORT_INDEX_FAILED',
            fileId: fileRecord.id,
            reason: err instanceof Error ? err.message : String(err),
          }));
        });
    }
  }

  if (effectiveIngestType === 'voice_dataset') {
    await enqueueJob('voice_dataset_process', { fileId: fileRecord.id }, { workspaceId: input.workspaceId, userId: input.userId, priority: 3 });
  }

  const preview = buildFilePreviewManifest({
    fileName: input.file.name,
    mimeType: input.file.type,
    sourceUrl: upload.url,
    parsed: { text: parsed.text, metadata: parsed.metadata },
    classification: parsed.classification,
    fileId: fileRecord.id,
  });

  return {
    file: fileRecord,
    classification: parsed.classification,
    preview,
    isDuplicate: upload.isDuplicate,
  };
}

function createHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
