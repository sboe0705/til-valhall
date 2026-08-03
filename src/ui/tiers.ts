/**
 * Presentation data for the three ladders, keyed by `RankTier.key`.
 *
 * The keys are the model's stable persistence keys – that is exactly what the
 * README reserves them for. Display names, shares and order come from
 * `ranks.ts`; only colour, rune and rail abbreviation live here.
 *
 * Palette rules that must hold:
 *   - a tier colour is an accent (icon, ring, dot, 3–4px rail), never a card
 *     background and never a surface behind text
 *   - text is always --vh-050 on a dark surface with the tier colour beside it
 */

import type { Id } from '@/model/training';
import type { RankScope } from '@/model/ranks';

export const TIER_COLORS: Record<Id, string> = {
  // Week – Ständeleiter der Rígsþula
  drengr: '#B9AC94',
  karl: '#C08A2E',
  hersir: '#A63A2C',
  jarl: '#2F5D8C',
  konungr: '#E0B23C',

  // Month – Die Neun Welten
  niflheim: '#86A0AE',
  helheim: '#3F4A47',
  muspelheim: '#C8452B',
  jotunheim: '#7B6E5D',
  svartalfaheim: '#4B3A63',
  midgard: '#4E7A4A',
  alfheim: '#E6D9A8',
  vanaheim: '#2E8B84',
  asgard: '#E8B93C',

  // Year – Zwölf Asen nach Rang
  bragi: '#5E6B7A',
  forseti: '#5A7480',
  ullr: '#567D80',
  vidar: '#567F72',
  vali: '#628060',
  njord: '#7C8557',
  freyr: '#948652',
  heimdallr: '#AC8850',
  baldr: '#C08E4E',
  tyr: '#CE9645',
  thorr: '#DFA93A',
  odinn: '#F2C64B',
};

/**
 * Helheim sits at 3.1:1 against --vh-900 – fine as a 4px rail or an 8px dot,
 * too dark for a glyph. Glyphs use a lightened variant instead; every other
 * tier is already ≥ 4.5:1 and passes through unchanged.
 */
const GLYPH_OVERRIDES: Record<Id, string> = {
  helheim: '#7A8A85',
};

export const tierColor = (key: Id): string => TIER_COLORS[key] ?? 'var(--vh-400)';

export const tierGlyphColor = (key: Id): string => GLYPH_OVERRIDES[key] ?? tierColor(key);

/** Elder Futhark glyph per tier – rendered from Noto Sans Runic. */
export const TIER_RUNES: Record<Id, string> = {
  drengr: 'ᛞ',
  karl: 'ᚲ',
  hersir: 'ᚺ',
  jarl: 'ᛃ',
  konungr: 'ᚲ',

  niflheim: 'ᚾ',
  helheim: 'ᚺ',
  muspelheim: 'ᛗ',
  jotunheim: 'ᛃ',
  svartalfaheim: 'ᛊ',
  midgard: 'ᛗ',
  alfheim: 'ᚨ',
  vanaheim: 'ᚹ',
  asgard: 'ᚨ',

  bragi: 'ᛒ',
  forseti: 'ᚠ',
  ullr: 'ᚢ',
  vidar: 'ᚹ',
  vali: 'ᚹ',
  njord: 'ᚾ',
  freyr: 'ᚠ',
  heimdallr: 'ᚺ',
  baldr: 'ᛒ',
  tyr: 'ᛏ',
  thorr: 'ᚦ',
  odinn: 'ᛟ',
};

/** Abbreviation under the tier rail – 8px mono, must stay narrow. */
export const TIER_SHORT: Record<Id, string> = {
  drengr: 'Dre',
  karl: 'Karl',
  hersir: 'Her',
  jarl: 'Jarl',
  konungr: 'Kon',

  niflheim: 'Nifl',
  helheim: 'Hel',
  muspelheim: 'Mus',
  jotunheim: 'Jöt',
  svartalfaheim: 'Sva',
  midgard: 'Mid',
  alfheim: 'Alf',
  vanaheim: 'Van',
  asgard: 'Asg',

  bragi: 'Bra',
  forseti: 'For',
  ullr: 'Ull',
  vidar: 'Vid',
  vali: 'Val',
  njord: 'Njö',
  freyr: 'Fre',
  heimdallr: 'Hei',
  baldr: 'Bal',
  tyr: 'Týr',
  thorr: 'Thor',
  odinn: 'Odin',
};

export interface ScopeCopy {
  label: string;
  system: string;
  reset: string;
  record: string;
}

export const SCOPE_COPY: Record<RankScope, ScopeCopy> = {
  week: {
    label: 'Woche',
    system: 'Ständeleiter der Rígsþula',
    reset: 'Reset montags (ISO)',
    record: 'Beste Woche',
  },
  month: {
    label: 'Monat',
    system: 'Die Neun Welten',
    reset: 'Reset am 1.',
    record: 'Bester Monat',
  },
  year: {
    label: 'Jahr',
    system: 'Zwölf Asen nach Rang',
    reset: 'Reset am 1. Januar',
    record: 'Bestes Jahr',
  },
};

export const SCOPES: RankScope[] = ['week', 'month', 'year'];
