import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const filesToCheck = [
  "src/components/streams/tabs/ChatTab.tsx",
  "src/components/streams/UnifiedChatPanel.tsx",
  "src/components/streams/StreamsChatSurface.tsx",
  "src/components/assistant/ActivityConversation.tsx",
  "src/components/streams/ActivityGenerationCard.tsx",
].filter((file) => fs.existsSync(path.join(root, file)));

const blockedPatterns = [
  {
    label: "Old AI assistant empty-state header",
    pattern: /AI assistant/g,
  },
  {
    label: "Old generic assistant subtitle",
    pattern: /Generate images,\s*videos,\s*voice and code directly from conversation\./g,
  },
  {
    label: "Old Chat/Image/Video/Build composer chips",
    pattern:
      /Chat['"`]?\s*,\s*['"`]?#3b82f6|Image['"`]?\s*,\s*['"`]?#7C3AED|Video['"`]?\s*,\s*['"`]?#ef4444|Build['"`]?\s*,\s*['"`]?#10b981/g,
  },
  {
    label: "Old build activity card copy",
    pattern:
      /Building your code|Work steps|Preparing artifact|Preparing the implementation and output/g,
  },
  {
    label: "Old avatar components",
    pattern: /UserAvatar|StreamsAvatar/g,
  },
  {
    label: "Old activity card rendered in chat",
    pattern: /<ActivityGenerationCard/g,
  },
];

let failed = false;

for (const relativeFile of filesToCheck) {
  const absoluteFile = path.join(root, relativeFile);
  const content = fs.readFileSync(absoluteFile, "utf8");

  for (const rule of blockedPatterns) {
    const matches = [...content.matchAll(rule.pattern)];

    if (!matches.length) continue;

    failed = true;
    console.error(`\nCHAT UI VIOLATION: ${rule.label}`);
    console.error(`File: ${relativeFile}`);

    for (const match of matches.slice(0, 5)) {
      const before = content.slice(0, match.index ?? 0);
      const line = before.split(/\r?\n/).length;
      console.error(`Line ${line}: ${match[0]}`);
    }
  }
}

if (failed) {
  console.error("\nCOMMIT BLOCKED — remove the old chat UI behavior above.");
  process.exit(1);
}

console.log("Chat UI audit passed.");
