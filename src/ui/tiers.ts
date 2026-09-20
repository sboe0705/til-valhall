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
 *   - text is always --vh-050 on the card with the tier colour beside it
 *   - every tier clears 4.5:1 on --vh-800, the mid grey the ladders are drawn
 *     on. That is what sets the *level* of this table: the ladders keep their
 *     hue journeys, but a grey card leaves no room below it, so the dark tiers
 *     are as deep as they can be rather than as deep as their myth wants
 */

import type { Id } from '@/model/training';
import type { RankScope } from '@/model/ranks';

export const TIER_COLORS: Record<Id, string> = {
  /*
   * Week – Ständeleiter der Rígsþula. The five steps are the shield itself:
   * silver rim, bronze, red quarter, blue quarter, gold boss.
   */
  drengr: '#C6CED6',
  karl: '#D99C65',
  hersir: '#E59685',
  jarl: '#78ADE4',
  konungr: '#E6CB4F',

  // Month – Die Neun Welten
  niflheim: '#95ACB8',
  helheim: '#9EADA9',
  muspelheim: '#E59484',
  jotunheim: '#B2A799',
  svartalfaheim: '#B3A3C9',
  midgard: '#87B483',
  alfheim: '#E6D9A8',
  vanaheim: '#3EBBB1',
  asgard: '#E8B93C',

  /*
   * Year – Zwölf Asen nach Rang. One long ramp from the shield's cold quarter
   * to its boss: blue → teal → green → gold. The handoff ramps grey → gold,
   * which lost its lower half against the blue-slate surfaces.
   */
  bragi: '#8FACD6',
  forseti: '#80ADD6',
  ullr: '#77B2C5',
  vidar: '#66B6B1',
  vali: '#6DB894',
  njord: '#83B67B',
  freyr: '#9BB262',
  heimdallr: '#B9AA4D',
  baldr: '#CBA34D',
  tyr: '#D2A73F',
  thorr: '#DFB63A',
  odinn: '#F2C64B',
};

/**
 * There is no glyph variant any more. The handoff needed one because `helheim`
 * sat at 3.1:1 – fine as a rail, too dark for a rune – but every tier in the
 * table above is tuned to 4.5:1 on the card it is drawn on, so a rail, a dot
 * and a rune can all share one value.
 */
export const tierColor = (key: Id): string => TIER_COLORS[key] ?? 'var(--vh-400)';

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

/**
 * One sentence of mythological background per tier, shown in the info dialog
 * behind the current rank.
 *
 * German and therefore presentation, not model: `RankTier.gloss` stays the
 * English one-liner the model documents itself with – it is not rendered
 * anywhere. Keep these to a single sentence; the dialog is sized for ~30 words.
 */
export const TIER_LORE: Record<Id, string> = {
  drengr:
    'Der junge, tapfere Krieger – in den Sagas ein Lob für aufrechten Mut: Er muss sich erst beweisen, hat aber schon den richtigen Charakter.',
  karl: 'Der freie Bauer: eigener Hof, eigenes Land, eigene Stimme auf dem Thing – das Rückgrat der Wikingergesellschaft.',
  hersir:
    'Lokaler Häuptling und Anführer eines Kriegertrupps; er stellt Schiff und Mannschaft und untersteht direkt dem Jarl.',
  jarl: 'Hoher Adliger unter dem König, der ganze Landstriche verwaltet; laut Rígsþula stammt sein Geschlecht vom Gott Ríg selbst.',
  konungr:
    'Der König – aus den Jarlen gewählt oder erkämpft, Herr über Land, Flotte und Gefolgschaft: die höchste weltliche Stufe.',

  niflheim:
    'Die Urwelt aus Nebel und Eis; aus ihrem Frost und Muspelheims Feuer entstand über der Leere Ginnungagap alles Leben.',
  helheim:
    'Das Totenreich der Göttin Hel, tief unter den Wurzeln Yggdrasils; hierher kommt, wer nicht im Kampf gefallen ist.',
  muspelheim:
    'Die Feuerwelt im Süden, bewacht vom Riesen Surt, dessen flammendes Schwert bei Ragnarök die Welt verbrennt.',
  jotunheim:
    'Das raue Land der Riesen jenseits von Midgard – Heimat von Thors Gegnern und zugleich vieler Göttergemahlinnen.',
  svartalfaheim:
    'Die unterirdische Welt der Schwarzalben und Zwerge; hier schmiedeten Meisterhandwerker Thors Hammer und Odins Speer.',
  midgard:
    'Die Welt der Menschen, aus dem Leib des Urriesen Ymir geformt und von der Midgardschlange umschlungen.',
  alfheim:
    'Die lichte Welt der Elben, von den Göttern dem Fruchtbarkeitsgott Freyr als Zahngeschenk überlassen.',
  vanaheim:
    'Heimat der Vanen, der älteren Göttersippe um Njörd, Freyr und Freya – Götter der Fruchtbarkeit, des Meeres und der Magie.',
  asgard:
    'Die Burg der Asen, über Bifröst mit Midgard verbunden; hier liegt Walhall, Odins Halle der gefallenen Krieger.',

  bragi:
    'Gott der Dicht- und Skaldenkunst, langbärtig und wortgewandt; er begrüßt die gefallenen Krieger in Walhall.',
  forseti:
    'Gott des Rechts, Sohn Baldrs; in seiner goldenen Halle Glitnir schlichtet er jeden Streit, der vor ihn kommt.',
  ullr: 'Meisterschütze und Skiläufer, Gott des Winters und des Zweikampfs – auf seinen Ring wurden Eide geschworen.',
  vidar:
    'Der schweigsame Gott von unbändiger Kraft; bei Ragnarök rächt er Odin, indem er den Wolf Fenrir tötet.',
  vali: 'An einem einzigen Tag herangewachsen, um Baldrs Tod zu rächen; er überlebt Ragnarök und sieht die neue Welt.',
  njord:
    'Gott des Meeres, des Windes und des Reichtums; Schutzherr der Seefahrer und Vater von Freyr und Freya.',
  freyr:
    'Gott der Fruchtbarkeit, des Friedens und guter Ernten; ihm gehören das Schiff Skidbladnir und der Eber Gullinborsti.',
  heimdallr:
    'Der wachsame Wächter der Regenbogenbrücke Bifröst; er hört das Gras wachsen und bläst bei Ragnarök ins Gjallarhorn.',
  baldr:
    'Der strahlende, von allen geliebte Gott; sein durch Lokis List verschuldeter Tod leitet den Untergang der Götter ein.',
  tyr: 'Gott des Kampfes und der Rechtsordnung; er opferte seine Hand, damit die Götter den Wolf Fenrir fesseln konnten.',
  thorr:
    'Der Donnergott mit dem Hammer Mjölnir, stärkster der Asen und Schutzherr Midgards gegen die Riesen.',
  odinn:
    'Allvater, Herr über Walhall, Krieg und Weisheit; er gab ein Auge für den Trunk aus Mimirs Brunnen.',
};

export const tierLore = (key: Id): string => TIER_LORE[key] ?? '';

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
