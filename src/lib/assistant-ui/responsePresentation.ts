import type { AssistantMode } from '@/lib/enforcement/types';

export type ResponseDensity = 'light' | 'medium' | 'heavy';
export type RenderBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'bullet'; text: string; ordered?: string }
  | { kind: 'heading'; level: 1 | 2 | 3; text: string }
  | { kind: 'spacer' }
  | { kind: 'code'; language?: string; code: string };

export interface PresentationPlan {
  density: ResponseDensity;
  allowHeadings: boolean;
  allowBullets: boolean;
  collapseLogs: boolean;
}

export function createPresentationPlan(text: string, mode?: AssistantMode): PresentationPlan {
  const lineCount = text.split('\n').length;
  const hasCode = /```/.test(text);
  const isHeavyMode = mode === 'build' || mode === 'verification';
  const density: ResponseDensity = isHeavyMode || hasCode || lineCount > 16 ? 'heavy' : lineCount > 8 ? 'medium' : 'light';

  return {
    density,
    allowHeadings: density !== 'light',
    allowBullets: density !== 'light',
    collapseLogs: density === 'heavy',
  };
}

export function splitRenderBlocks(text: string, mode?: AssistantMode): RenderBlock[] {
  const plan = createPresentationPlan(text, mode);
  const blocks: RenderBlock[] = [];
  const codeFenceRegex = /```([a-zA-Z0-9_-]+)?\n([\s\S]*?)```/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = codeFenceRegex.exec(text))) {
    const before = text.slice(cursor, match.index);
    blocks.push(...splitTextBlocks(before, plan));
    blocks.push({ kind: 'code', language: match[1], code: match[2].trimEnd() });
    cursor = codeFenceRegex.lastIndex;
  }

  if (cursor < text.length) {
    blocks.push(...splitTextBlocks(text.slice(cursor), plan));
  }

  return blocks.length > 0 ? blocks : [{ kind: 'paragraph', text }];
}

function splitTextBlocks(text: string, plan: PresentationPlan): RenderBlock[] {
  const lines = text.split('\n');
  const blocks: RenderBlock[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      blocks.push({ kind: 'spacer' });
      continue;
    }

    if (plan.allowHeadings) {
      if (line.startsWith('### ')) {
        blocks.push({ kind: 'heading', level: 3, text: line.slice(4) });
        continue;
      }
      if (line.startsWith('## ')) {
        blocks.push({ kind: 'heading', level: 2, text: line.slice(3) });
        continue;
      }
      if (line.startsWith('# ')) {
        blocks.push({ kind: 'heading', level: 1, text: line.slice(2) });
        continue;
      }
    }

    if (plan.allowBullets) {
      if (/^[-*] /.test(line)) {
        blocks.push({ kind: 'bullet', text: line.slice(2) });
        continue;
      }
      const orderedMatch = line.match(/^(\d+)\.\s+(.+)/);
      if (orderedMatch) {
        blocks.push({ kind: 'bullet', ordered: orderedMatch[1], text: orderedMatch[2] });
        continue;
      }
    }

    blocks.push({ kind: 'paragraph', text: line });
  }

  return mergeParagraphs(blocks);
}

function mergeParagraphs(blocks: RenderBlock[]): RenderBlock[] {
  const merged: RenderBlock[] = [];
  for (const block of blocks) {
    const previous = merged[merged.length - 1];
    if (block.kind === 'paragraph' && previous?.kind === 'paragraph') {
      previous.text = `${previous.text} ${block.text}`.trim();
      continue;
    }
    merged.push(block);
  }
  return merged;
}
