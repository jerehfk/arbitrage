import { initialHedge, type HedgeState } from './hedgeModel';
import { emptyFields, type BetFields, type BetInput, type UiState } from './model';
import { defaultSettings, type UiSettings } from './settings';

const KEY = 'sportwetten-rechner:v1';
const BET_TYPES = ['normal', 'gratiswette', 'risikofrei', 'boost'];

export type Tab = 'absichern' | 'frei';

/** Was zwischen zwei Besuchen erhalten bleibt. */
export interface Saved {
  tab: Tab;
  /** Eingaben des Reiters "Frei"; fehlt beim ersten Besuch. */
  state?: UiState;
  /** Eingaben des Reiters "Absichern"; fehlt beim ersten Besuch. */
  hedge?: HedgeState;
  settings: UiSettings;
}

type Store = Pick<Storage, 'getItem' | 'setItem'>;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const text = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);

function readFields(v: Record<string, unknown>): BetFields {
  return {
    ...emptyFields(),
    type: BET_TYPES.includes(text(v.type)) ? (v.type as BetFields['type']) : 'normal',
    odds: text(v.odds),
    stake: text(v.stake),
    tax: v.tax === true,
    refundKind: v.refundKind === 'gratiswette' ? 'gratiswette' : 'bar',
    refundCap: text(v.refundCap),
    maxStake: text(v.maxStake),
  };
}

const indices = (v: unknown, count: number): number[] =>
  Array.isArray(v)
    ? [...new Set(v.filter((c): c is number => Number.isInteger(c) && c >= 0 && c < count))].sort()
    : [];

function readBet(v: unknown, outcomeCount: number): BetInput | undefined {
  if (!isObject(v)) return undefined;
  const covers = indices(v.covers, outcomeCount);
  return { ...readFields(v), covers: covers.length > 0 ? covers : [0] };
}

function readState(v: unknown): UiState | undefined {
  if (!isObject(v) || !Array.isArray(v.outcomes) || !Array.isArray(v.bets)) return undefined;
  if (v.outcomes.length < 2 || v.outcomes.length > 5 || v.outcomes.some((o) => typeof o !== 'string')) return undefined;
  if (v.bets.length < 1 || v.bets.length > 10) return undefined;
  const outcomes = v.outcomes as string[];
  const bets = v.bets.map((b) => readBet(b, outcomes.length));
  if (bets.some((b) => b === undefined)) return undefined;
  return { outcomes, bets: bets as BetInput[] };
}

function readHedge(v: unknown): HedgeState | undefined {
  if (!isObject(v)) return undefined;
  return {
    home: text(v.home),
    away: text(v.away),
    text: text(v.text),
  };
}

/** Liest den gespeicherten Stand; kaputte oder fehlende Daten ergeben den Standard. */
export function load(store: Store | undefined): Saved {
  const empty: Saved = { tab: 'absichern', settings: { ...defaultSettings } };
  try {
    const raw = store?.getItem(KEY);
    if (!raw) return empty;
    const data: unknown = JSON.parse(raw);
    if (!isObject(data)) return empty;
    const s = isObject(data.settings) ? data.settings : {};
    return {
      tab: data.tab === 'frei' ? 'frei' : 'absichern',
      state: readState(data.state),
      hedge: readHedge(data.hedge),
      settings: {
        taxPercent: text(s.taxPercent, defaultSettings.taxPercent),
        conversionPercent: text(s.conversionPercent, defaultSettings.conversionPercent),
        budget: text(s.budget, defaultSettings.budget),
      },
    };
  } catch {
    return empty;
  }
}

/** Speichert den Stand; ein Fehler (z. B. privates Fenster) ist egal. */
export function save(store: Store | undefined, saved: Saved): void {
  try {
    store?.setItem(KEY, JSON.stringify(saved));
  } catch {
    /* ohne Speicher läuft die Seite einfach ohne Merken weiter */
  }
}
