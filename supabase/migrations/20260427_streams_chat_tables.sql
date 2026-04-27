-- Phase 10: Chat Tables with Persistence, Reactions, and Editing
-- Created: 2026-04-27

-- 1. Chat Sessions (conversation grouping)
CREATE TABLE IF NOT EXISTS streams_chat_sessions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  project_id TEXT,
  topic TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  message_count INTEGER NOT NULL DEFAULT 0,
  deleted BOOLEAN NOT NULL DEFAULT false
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON streams_chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at ON streams_chat_sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_project_id ON streams_chat_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_updated ON streams_chat_sessions(user_id, updated_at DESC);

-- 2. Chat Messages (user + assistant messages)
CREATE TABLE IF NOT EXISTS streams_chat_messages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  session_id TEXT NOT NULL REFERENCES streams_chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  model_used TEXT,
  route_reasons TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited BOOLEAN NOT NULL DEFAULT false,
  deleted BOOLEAN NOT NULL DEFAULT false,
  branch_id TEXT -- For message branching (Phase 11)
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON streams_chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON streams_chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_not_deleted ON streams_chat_messages(session_id) WHERE NOT deleted;
CREATE INDEX IF NOT EXISTS idx_chat_messages_search ON streams_chat_messages USING gin(to_tsvector('english', content));

-- 3. Chat Artifacts (code, components, etc.)
CREATE TABLE IF NOT EXISTS streams_chat_artifacts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  message_id TEXT NOT NULL REFERENCES streams_chat_messages(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  language TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('react', 'html', 'svg', 'code')),
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_chat_artifacts_message_id ON streams_chat_artifacts(message_id);

-- 4. Async Content (images, videos, progress)
CREATE TABLE IF NOT EXISTS streams_chat_async_content (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  artifact_id TEXT NOT NULL REFERENCES streams_chat_artifacts(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('image', 'video', 'none')),
  url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'loading', 'complete', 'error')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_async_content_artifact_id ON streams_chat_async_content(artifact_id);
CREATE INDEX IF NOT EXISTS idx_async_content_status ON streams_chat_async_content(status);

-- 5. Message Reactions (👍👎)
CREATE TABLE IF NOT EXISTS streams_message_reactions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  message_id TEXT NOT NULL REFERENCES streams_chat_messages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  reaction TEXT NOT NULL CHECK (reaction IN ('👍', '👎')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, reaction)
);

CREATE INDEX IF NOT EXISTS idx_reactions_message_id ON streams_message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user_id ON streams_message_reactions(user_id);

-- 6. RLS Policies (Row Level Security)

-- Enable RLS on all tables
ALTER TABLE streams_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE streams_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE streams_chat_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE streams_chat_async_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE streams_message_reactions ENABLE ROW LEVEL SECURITY;

-- Sessions: users can only see their own
CREATE POLICY "sessions_select" ON streams_chat_sessions
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "sessions_insert" ON streams_chat_sessions
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "sessions_update" ON streams_chat_sessions
  FOR UPDATE USING (auth.uid()::text = user_id);

-- Messages: inherit from session access
CREATE POLICY "messages_select" ON streams_chat_messages
  FOR SELECT USING (
    session_id IN (
      SELECT id FROM streams_chat_sessions WHERE user_id = auth.uid()::text
    )
  );

CREATE POLICY "messages_insert" ON streams_chat_messages
  FOR INSERT WITH CHECK (
    session_id IN (
      SELECT id FROM streams_chat_sessions WHERE user_id = auth.uid()::text
    )
  );

CREATE POLICY "messages_update" ON streams_chat_messages
  FOR UPDATE USING (
    session_id IN (
      SELECT id FROM streams_chat_sessions WHERE user_id = auth.uid()::text
    )
  );

-- Artifacts: inherit from message access
CREATE POLICY "artifacts_select" ON streams_chat_artifacts
  FOR SELECT USING (
    message_id IN (
      SELECT id FROM streams_chat_messages 
      WHERE session_id IN (
        SELECT id FROM streams_chat_sessions WHERE user_id = auth.uid()::text
      )
    )
  );

CREATE POLICY "artifacts_insert" ON streams_chat_artifacts
  FOR INSERT WITH CHECK (
    message_id IN (
      SELECT id FROM streams_chat_messages 
      WHERE session_id IN (
        SELECT id FROM streams_chat_sessions WHERE user_id = auth.uid()::text
      )
    )
  );

-- Async content: inherit from artifact access
CREATE POLICY "async_content_select" ON streams_chat_async_content
  FOR SELECT USING (
    artifact_id IN (
      SELECT id FROM streams_chat_artifacts
      WHERE message_id IN (
        SELECT id FROM streams_chat_messages 
        WHERE session_id IN (
          SELECT id FROM streams_chat_sessions WHERE user_id = auth.uid()::text
        )
      )
    )
  );

CREATE POLICY "async_content_insert" ON streams_chat_async_content
  FOR INSERT WITH CHECK (
    artifact_id IN (
      SELECT id FROM streams_chat_artifacts
      WHERE message_id IN (
        SELECT id FROM streams_chat_messages 
        WHERE session_id IN (
          SELECT id FROM streams_chat_sessions WHERE user_id = auth.uid()::text
        )
      )
    )
  );

CREATE POLICY "async_content_update" ON streams_chat_async_content
  FOR UPDATE USING (
    artifact_id IN (
      SELECT id FROM streams_chat_artifacts
      WHERE message_id IN (
        SELECT id FROM streams_chat_messages 
        WHERE session_id IN (
          SELECT id FROM streams_chat_sessions WHERE user_id = auth.uid()::text
        )
      )
    )
  );

-- Reactions: users can see all reactions on messages they have access to
CREATE POLICY "reactions_select" ON streams_message_reactions
  FOR SELECT USING (
    message_id IN (
      SELECT id FROM streams_chat_messages 
      WHERE session_id IN (
        SELECT id FROM streams_chat_sessions WHERE user_id = auth.uid()::text
      )
    )
  );

CREATE POLICY "reactions_insert" ON streams_message_reactions
  FOR INSERT WITH CHECK (
    auth.uid()::text = user_id AND
    message_id IN (
      SELECT id FROM streams_chat_messages 
      WHERE session_id IN (
        SELECT id FROM streams_chat_sessions WHERE user_id = auth.uid()::text
      )
    )
  );

CREATE POLICY "reactions_delete" ON streams_message_reactions
  FOR DELETE USING (auth.uid()::text = user_id);

-- 7. Triggers for updated_at

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sessions_updated_at
  BEFORE UPDATE ON streams_chat_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_messages_updated_at
  BEFORE UPDATE ON streams_chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Done!
