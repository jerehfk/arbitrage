import type { BetInfo } from './hedge';
import {
  and,
  bttsMarket,
  goalsMarket,
  halfMarket,
  handicapMarket,
  marginMarket,
  resultMarket,
  type Market,
  type Names,
  type Res,
} from './match';

export interface Parsed {
  /** Die ganze Wette; fehlt, wenn nichts oder nicht alles verstanden wurde. */
  market?: Market;
  /** Beschriftung der verstandenen Teile (auch wenn andere Teile fehlen). */
  understood: string;
  info: BetInfo;
  /** Teile des Textes, die nicht verstanden wurden. */
  unknown: string[];
  empty: boolean;
}

const strip = (s: string) =>
  s
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const FILLER = new Set(
  (
    'tore tor goals goal im in am zu spiel das der die den dem des ein eine einem von fur auf wette wetten bei nach 90 min ' +
    'minuten team teams mannschaft mannschaften endergebnis ergebnis spielergebnis spielausgang ausgang doppelte chance dc ' +
    'doppelchance tipp tippe handicap match ft regulare spielzeit regelzeit gesamt insgesamt mit ist sind wird werden dass ' +
    'ich setze 1x2 dreiweg dann auch wenn es zum zur ende spielende endstand'
  ).split(' '),
);
const WIN = new Set(['gewinnt', 'gewinnen', 'siegt', 'sieg', 'win', 'wins', 'sieger', 'gewinner']);
const LOSE = new Set(['verliert', 'verlieren', 'niederlage', 'unterliegt']);
const NOT = new Set(['nicht', 'kein', 'keinen', 'keine', 'ohne', 'not']);
const DRAW = new Set(['remis', 'unentschieden', 'draw', 'x', 'unent', 'unentsch']);
const CODES: Record<string, Res[]> = { '1': ['H'], '2': ['A'], '1x': ['H', 'D'], x2: ['D', 'A'], '12': ['H', 'A'] };

function teamPatterns(own: string, other: string): string[] {
  const a = strip(own).trim();
  if (a.length < 2) return [];
  const otherWords = new Set(strip(other).split(/\s+/));
  const words = a.split(/\s+/).filter((w) => w.length >= 4 && !otherWords.has(w));
  return [a, ...words];
}

/** Kleinbuchstaben ohne Umlaute, Teamnamen als `hteam`/`ateam`, Vorzeichen-Handicaps als `hcvalp1.5`/`hcvalm1.5`. */
function prepare(raw: string, names: Names): string {
  let t = strip(raw).replace(/[−–—]/g, '-');
  const reps: [string, string][] = [
    ...teamPatterns(names.home, names.away).map((p): [string, string] => [p, 'hteam']),
    ...teamPatterns(names.away, names.home).map((p): [string, string] => [p, 'ateam']),
  ].sort((x, y) => y[0].length - x[0].length);
  for (const [p, tok] of reps) t = t.replace(new RegExp(`(?<![a-z0-9])${esc(p)}(?![a-z0-9])`, 'g'), ` ${tok} `);
  t = t
    .replace(/\b(?:heimteam|heimmannschaft|gastgeber|heim)\b/g, ' hteam ')
    .replace(/\b(?:gastteam|gastmannschaft|auswartsteam|auswarts|gast)\b/g, ' ateam ');
  const sign = (s: string, n: string) => ` hcval${s === '+' ? 'p' : 'm'}${n} `;
  t = t
    .replace(/\b(?:handicap|hcp|hc|ah)\s*([+-])\s*(\d+(?:\.\d+)?)/g, (_, s, n) => sign(s, n))
    .replace(/\b(hteam|ateam)\s*([+-])\s*(\d+(?:\.\d+)?)/g, (_, tm, s, n) => `${tm}${sign(s, n)}`)
    .replace(/\//g, ' oder ')
    .replace(/[()"'!?:]/g, ' ')
    .replace(/(?<!\d)\.|\.(?!\d)/g, ' ')
    .replace(/-/g, ' ');
  return t;
}

const OVER = ['uber', 'mehr als', 'over', 'mindestens', 'mind', 'o'];
const STRICT = ['uber', 'mehr als', 'over', 'o', 'unter', 'weniger als', 'under', 'u'];

function parseClause(raw: string, names: Names): { market: Market; info: BetInfo } | undefined {
  const info: BetInfo = { lines: [], halves: false, margin: false };
  let s = prepare(raw, names);
  const take = (re: RegExp): RegExpMatchArray | null => {
    const m = s.match(re);
    if (m) s = s.replace(re, ' ');
    return m;
  };
  const pickTeam = (): 'H' | 'A' | undefined => {
    const h = /\bhteam\b/.test(s);
    const a = /\bateam\b/.test(s);
    if (h === a) return undefined;
    s = s.replace(/\b[ha]team\b/g, ' ');
    return h ? 'H' : 'A';
  };

  const others: Market[] = [];

  const hc = take(/\bhcval([pm])(\d+(?:\.\d+)?)\b/);
  if (hc) {
    const v = (hc[1] === 'p' ? 1 : -1) * Number(hc[2]);
    const team = pickTeam();
    if (!team || Math.abs(v % 1) !== 0.5) return undefined;
    others.push(handicapMarket(team, v, names));
    info.margin = true;
  }

  const mg = take(/\b(?:(mindestens|mind|genau|exakt|mehr als)\s+)?(\d+)\s*(?:tor\w*\s+)?(?:unterschied|vorsprung|differenz|abstand)\b/);
  if (mg) {
    const team = pickTeam();
    const n = Number(mg[2]) + (mg[1] === 'mehr als' ? 1 : 0);
    if (!team || n < 1 || n > 4) return undefined;
    others.push(marginMarket(team, n, ['mindestens', 'mind', 'mehr als'].includes(mg[1] ?? ''), names));
    info.margin = true;
  }

  let halves: (1 | 2)[] | undefined;
  if (take(/\bbeide[nr]?\s+(?:halbzeit\w*|hz)\b/)) halves = [1, 2];
  else if (take(/\b(?:1|erste[nrms]?)\s*(?:halbzeit\w*|hz|halfte)\b|\b(?:halbzeit|hz)\s*1\b|\bhz1\b|\b1hz\b/)) halves = [1];
  else if (take(/\b(?:2|zweite[nrms]?)\s*(?:halbzeit\w*|hz|halfte)\b|\b(?:halbzeit|hz)\s*2\b|\bhz2\b|\b2hz\b/)) halves = [2];
  else if (take(/\b(?:zur\s+)?halbzeit\w*\b/)) halves = [1];

  const bt = take(
    /\b(nicht\s+)?(?:beide(?:\s+(?:teams?|mannschaften))?\s+(?:treffen|erzielen(?:\s+ein\s+tor)?|schiessen(?:\s+ein\s+tor)?|scoren)|btts|gg)\b(?:\s+(ja|nein|yes|no))?/,
  );
  if (bt) {
    const neg = !!bt[1] !== ['nein', 'no'].includes(bt[2] ?? '');
    others.push(bttsMarket(!neg));
  }

  for (let m = take(/\b(uber|unter|mehr als|weniger als|over|under|mindestens|mind|maximal|max|hochstens|o|u)\s*(\d+(?:\.\d+)?)(?:\s*(?:tore|tor|goals?))?\b/); m; m = take(/\b(uber|unter|mehr als|weniger als|over|under|mindestens|mind|maximal|max|hochstens|o|u)\s*(\d+(?:\.\d+)?)(?:\s*(?:tore|tor|goals?))?\b/)) {
    const over = OVER.includes(m[1]);
    const strict = STRICT.includes(m[1]);
    const n = Number(m[2]);
    let line: number;
    if (n % 1 === 0.5) line = n;
    else if (n % 1 === 0) line = over ? (strict ? n + 0.5 : n - 0.5) : strict ? n - 0.5 : n + 0.5;
    else return undefined;
    if (line < 0.5 || line > 7.5) return undefined;
    others.push(goalsMarket(over, line));
    info.lines.push(line);
  }

  // Rest: Ergebnis (Mannschaften, Remis, Codes, "verliert nicht" ...).
  const teams = new Set<'H' | 'A'>();
  const set = new Set<Res>();
  let win = false;
  let lose = false;
  let negate = false;
  let draw = false;
  const unknownToken: string[] = [];
  for (const t of s.split(/\s+/).filter(Boolean)) {
    if (t === 'gegen' || t === 'vs' || t === 'against' || t === 'v') break;
    if (FILLER.has(t) || t === 'oder' || t === 'or') continue;
    if (t === 'hteam') teams.add('H');
    else if (t === 'ateam') teams.add('A');
    else if (DRAW.has(t)) draw = true;
    else if (CODES[t]) CODES[t].forEach((r) => set.add(r));
    else if (WIN.has(t)) win = true;
    else if (LOSE.has(t)) lose = true;
    else if (NOT.has(t)) negate = true;
    else unknownToken.push(t);
  }
  if (unknownToken.length) return undefined;
  for (const tm of teams) {
    const me: Res = tm;
    const opp: Res = tm === 'H' ? 'A' : 'H';
    if (lose) (negate ? [me, 'D'] : [opp]).forEach((r) => set.add(r as Res));
    else if (win && negate) ['D', opp].forEach((r) => set.add(r as Res));
    else set.add(me);
  }
  if (draw) {
    if (negate && teams.size === 0) (['H', 'A'] as Res[]).forEach((r) => set.add(r));
    else set.add('D');
  }
  const result = [...set];
  if (result.length === 3) return undefined;

  const parts: Market[] = [];
  if (halves) {
    if (result.length === 0 || others.length > 0) return undefined;
    info.halves = true;
    parts.push(halfMarket(halves, result, names));
  } else if (result.length > 0) parts.push(resultMarket(result, names));
  parts.push(...others);
  if (parts.length === 0) return undefined;
  return { market: parts.reduce((a, b) => and(a, b)), info };
}

const SPLIT = /\s*(?:&|;|,|\+(?!\d)|\b(?:und|plus|sowie)\b)\s*/i;
const PRIORITY: Record<string, number> = { R: 0, T: 0, M: 1, C: 1, B: 2, G: 3 };

export function parseBet(text: string, names: Names): Parsed {
  const info: BetInfo = { lines: [], halves: false, margin: false };
  const clauses = text
    .replace(/(\d),(\d)/g, '$1.$2')
    .split(SPLIT)
    .map((c) => c.trim())
    .filter(Boolean);
  if (clauses.length === 0) return { understood: '', info, unknown: [], empty: true };

  const found: Market[] = [];
  const unknown: string[] = [];
  for (const c of clauses) {
    const r = parseClause(c, names);
    if (!r) {
      unknown.push(c);
      continue;
    }
    // Kombi-Teile aus einem Satz getrennt halten, damit die Reihenfolge stimmt.
    found.push(r.market);
    info.lines.push(...r.info.lines);
    info.halves ||= r.info.halves;
    info.margin ||= r.info.margin;
  }
  const unique = found.filter((m, i) => found.findIndex((o) => o.key === m.key) === i);
  const ordered = unique
    .map((m, i) => ({ m, i }))
    .sort((a, b) => (PRIORITY[a.m.key[0]] ?? 4) - (PRIORITY[b.m.key[0]] ?? 4) || a.i - b.i)
    .map((x) => x.m);
  const combined = ordered.length ? ordered.reduce((a, b) => and(a, b)) : undefined;
  return {
    market: unknown.length === 0 ? combined : undefined,
    understood: combined?.label ?? '',
    info,
    unknown,
    empty: false,
  };
}
