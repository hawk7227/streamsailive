import type { AssistantMode } from '@/lib/enforcement/types';

export type ResponseDensity = 'light' | 'medium' | 'heavy';

export type ResponseBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; text: string }
  | { type: 'bullet_list'; items: string[] }
  | { type: 'code_block'; code: string; language?: string };

export interface PresentedResponse {
  density: ResponseDensity;
  blocks: ResponseBlock[];
}

export function presentResponse(text: string, mode?: AssistantMode): PresentedResponse {
  const lineCount = text.split('\n').length;
  const hasCode = /```/.test(text);
  const isHeavyMode =
    mode === 'builder' ||
    mode === 'execution' ||
    mode === 'verification' ||
    mode === 'action';

  const density: ResponseDensity =
    isHeavyMode || hasCode || lineCount > 16
      ? 'heavy'
      : lineCount > 8
        ? 'medium'
        : 'light';

  return {
    density,
    blocks: parseBlocks(text),
  };
}

function parseBlocks(text: string): ResponseBlock[] {
  const lines = text.split('\n');
  const blocks: ResponseBlock[] = [];
  let paragraphBuffer: string[] = [];
  let bulletBuffer: string[] = [];
  let inCode = false;
  let codeLanguage = '';
  let codeBuffer: string[] = [];

  const flushParagraph = (): void => {
    if (paragraphBuffer.length === 0) return;
    const paragraph = paragraphBuffer.join(' ').trim();
    if (paragraph) blocks.push({ type: 'paragraph', text: paragraph });
    paragraphBuffer = [];
  };

  const flushBullets = (): void => {
    if (bulletBuffer.length === 0) return;
    blocks.push({ type: 'bullet_list', items: [...bulletBuffer] });
    bulletBuffer = [];
  };

  const flushCode = (): void => {
    if (codeBuffer.length === 0) return;
    blocks.push({
      type: 'code_block',
      code: codeBuffer.join('\n'),
      language: codeLanguage || undefined,
    });
    codeBuffer = [];
    codeLanguage = '';
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.trim().startsWith('```')) {
      flushParagraph();
      flushBullets();

      if (!inCode) {
        inCode = true;
        codeLanguage = line.trim().slice(3).trim();
      } else {
        inCode = false;
        flushCode();
      }
      continue;
    }

    if (inCode) {
      codeBuffer.push(rawLine);
      continue;
    }

    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushBullets();
      continue;
    }

    if (trimmed.startsWith('# ')) {
      flushParagraph();
      flushBullets();
      blocks.push({ type: 'heading', text: trimmed.slice(2).trim() });
      continue;
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      flushParagraph();
      bulletBuffer.push(trimmed.slice(2).trim());
      continue;
    }

    flushBullets();
    paragraphBuffer.push(trimmed);
  }

  flushParagraph();
  flushBullets();
  flushCode();

  return blocks;
}
