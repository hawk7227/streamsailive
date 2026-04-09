
import 'server-only'
import type { CopyVariant } from '@/lib/pipeline/qc/deterministicChecks'

export interface CompositeAssetParams {
  variant: CopyVariant;
  width: number;
  height: number;
  backgroundUrl?: string;
  fontFamily?: string;
}

export interface SpellCheckResult {
  passed: boolean;
  issues: string[];
}

const KNOWN_TYPOS: Record<string, string> = {
  thier: 'their',
  guarenteed: 'guaranteed',
  recieve: 'receive',
  seperate: 'separate',
  definately: 'definitely',
  occured: 'occurred',
  accomodate: 'accommodate',
};

const BRAND_TERMS: Record<string, string> = {
  medazon: 'Medazon',
  'fnp-c': 'FNP-C',
};

function checkString(field: string, value: string): string[] {
  const issues: string[] = [];
  const lower = value.toLowerCase();
  for (const [typo, correct] of Object.entries(KNOWN_TYPOS)) {
    if (lower.includes(typo)) {
      issues.push(`${field}: found "${typo}", should be "${correct}"`);
    }
  }
  for (const [term, correct] of Object.entries(BRAND_TERMS)) {
    const regex = new RegExp(`(?<![A-Z])${term}(?![-]?C\\b)`, 'i');
    if (term === 'fnp-c' ? lower.includes(term) && !value.includes('FNP-C') : regex.test(value) && !value.includes(correct)) {
      issues.push(`${field}: "${term}" should be "${correct}"`);
    }
  }
  return issues;
}

export function spellCheckTextStrings(variant: CopyVariant): SpellCheckResult {
  const issues: string[] = [];
  issues.push(...checkString('headline', variant.headline));
  issues.push(...checkString('subheadline', variant.subheadline));
  issues.push(...checkString('cta', variant.cta));
  if (variant.microcopy) issues.push(...checkString('microcopy', variant.microcopy));
  if (variant.disclaimer) issues.push(...checkString('disclaimer', variant.disclaimer));
  variant.bullets.forEach((bullet, i) => {
    issues.push(...checkString(`bullet[${i}]`, bullet));
  });
  return { passed: issues.length === 0, issues };
}

export async function compositeAsset() {
  return {}
}
