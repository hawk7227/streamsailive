# STREAMS AI Assistant — Portable Drop-in

Self-contained AI assistant. **Zero external dependencies beyond React.**
Drop into any Next.js project in 3 steps.

---

## Install

### Step 1 — Copy files

```bash
# Copy component
cp AIAssistant.tsx src/components/AIAssistant.tsx

# Copy API route
mkdir -p src/app/api/ai-assistant
cp api/ai-assistant/route.ts src/app/api/ai-assistant/route.ts
```

### Step 2 — Set environment variables

Required (at minimum one of these):
```env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

Optional (for full tool access):
```env
GITHUB_TOKEN=ghp_...
VERCEL_TOKEN=...
VERCEL_PROJECT_ID=...
DO_API_TOKEN=...
DO_APP_ID=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### Step 3 — Use in your page

```tsx
import AIAssistant from "@/components/AIAssistant";

export default function MyPage() {
  return (
    <AIAssistant
      context={{
        type: "your-app",
        prompt: "current prompt here",
        settings: { key: "value" },
      }}
      onApplyPrompt={(prompt) => console.log("Apply:", prompt)}
    />
  );
}
```

---

## Features

| Feature | Status |
|---|---|
| OpenAI GPT-4o | ✅ |
| Anthropic Claude | ✅ |
| Provider toggle (per user) | ✅ |
| Image attachments (base64) | ✅ |
| Video attachments | ✅ |
| Document attachments (.pdf/.txt/.md/.json) | ✅ |
| Audio attachments | ✅ |
| URL analysis | ✅ |
| SSE streaming text | ✅ |
| Tool call cards (inline) | ✅ |
| Inline image rendering | ✅ |
| Inline video rendering | ✅ |
| Connected systems status | ✅ |
| Custom API key storage (localStorage) | ✅ |
| Action confirmation modal | ✅ |
| Memory via Supabase | ✅ (optional) |
| 16 tools (GitHub, Vercel, DO, Supabase, etc.) | ✅ |

---

## Tools available

The assistant can (with correct env vars):

- `fetch_url` — read any URL
- `generate_image` / `generate_video` — trigger your generation APIs
- `run_pipeline` / `run_step` — trigger your pipeline
- `modify_prompt` — update prompts programmatically
- `fetch_github_file` / `push_github_file` — read/write GitHub repos
- `read_supabase_table` / `write_supabase_row` — query/write your DB
- `read_memory` / `write_memory` — persistent memory across sessions
- `deploy_vercel` — trigger Vercel deployment
- `deploy_do_app` — trigger DigitalOcean deployment

---

## Action callbacks (all optional)

```tsx
<AIAssistant
  context={...}
  onGenerateImage={(conceptId, prompt) => ...}
  onGenerateVideo={(conceptId, prompt) => ...}
  onRunPipeline={() => ...}
  onRunStep={(stepId, data) => ...}
  onSelectConcept={(conceptId) => ...}
  onApproveOutput={(type, url) => ...}
  onOpenStepConfig={(stepId) => ...}
  onSetNiche={(nicheId) => ...}
  onUpdateImagePrompt={(value) => ...}
  onUpdateVideoPrompt={(value) => ...}
  onUpdateStrategyPrompt={(value) => ...}
  onUpdateCopyPrompt={(value) => ...}
  onUpdateI2VPrompt={(value) => ...}
  onUpdateQAInstruction={(value) => ...}
/>
```

---

## Supabase (optional — for memory)

Run this migration once:

```sql
create table if not exists assistant_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text default 'New conversation',
  created_at timestamptz default now()
);
create table if not exists assistant_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references assistant_conversations(id) on delete cascade,
  role text, content text, provider text, created_at timestamptz default now()
);
create table if not exists assistant_tool_calls (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references assistant_conversations(id) on delete cascade,
  tool_name text, input jsonb, result jsonb, duration_ms integer, created_at timestamptz default now()
);
create table if not exists assistant_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  memory_type text, key text, value jsonb, tags text[], updated_at timestamptz default now(),
  unique(user_id, key)
);
alter table assistant_conversations enable row level security;
alter table assistant_messages enable row level security;
alter table assistant_tool_calls enable row level security;
alter table assistant_memory enable row level security;
create policy "own" on assistant_conversations for all using (auth.uid() = user_id);
create policy "own" on assistant_messages for all using (conversation_id in (select id from assistant_conversations where user_id = auth.uid()));
create policy "own" on assistant_tool_calls for all using (conversation_id in (select id from assistant_conversations where user_id = auth.uid()));
create policy "own" on assistant_memory for all using (auth.uid() = user_id);
```

Without Supabase, the assistant still works — memory features are skipped silently.
