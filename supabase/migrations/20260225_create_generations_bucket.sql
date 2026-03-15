-- Create the public "generations" storage bucket for AI-generated images.
-- Run this once in the Supabase SQL Editor for your project.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'generations',
  'generations',
  true,          -- public: images served without auth token
  52428800,      -- 50 MB per file
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'video/mp4']
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Service role can read/write (used by the Next.js API routes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Service role full access to generations bucket'
  ) THEN
    CREATE POLICY "Service role full access to generations bucket"
      ON storage.objects FOR ALL TO service_role
      USING      (bucket_id = 'generations')
      WITH CHECK (bucket_id = 'generations');
  END IF;
END $$;

-- Anyone can read objects (public images)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Public read access for generations bucket'
  ) THEN
    CREATE POLICY "Public read access for generations bucket"
      ON storage.objects FOR SELECT TO public
      USING (bucket_id = 'generations');
  END IF;
END $$;
