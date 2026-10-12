import { emptyBet, type BetInput, type UiState } from './model';
import { defaultSettings, type UiSettings } from './settings';

const KEY = 'sportwetten-rechner:v1';
const BET_TYPES = ['normal', 'gratiswette', 'risikofrei', 'boost'];

/** Was zwischen zwei Besuchen erhalten bleibt. */
export interface Saved {
  /** Letzte Eingaben; fehlt beim ersten Besuch. */
  state?: UiState;
  settings: UiSettings;
  /** Steuer-Schalter je Anbieter, Schlüssel siehe `providerKey`. */
  taxByProvider: Record<string, boolean>;
}

type Store = Pick<Storage, 'getItem' | 'setItem'>;

export const providerKey = (name: string) => name.trim().toLowerCase();

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const text = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);

function readBet(v: unknown, outcomeCount: number): BetInput | undefined {
  if (!isObject(v)) return undefined;
  const covers = Array.isArray(v.covers)
    ? v.covers.filter((c): c is number => Number.isInteger(c) && c >= 0 && c < outcomeCount)
    : [];
  return {
    ...emptyBet(0),
    provider: text(v.provider),
    type: BET_TYPES.includes(text(v.type)) ? (v.type as BetInput['type']) : 'normal',
    odds: text(v.odds),
    stake: text(v.stake),
    covers: covers.length > 0 ? [...new Set(covers)].sort() : [0],
    tax: v.tax === true,
    refundKind: v.refundKind === 'gratiswette' ? 'gratiswette' : 'bar',
    refundCap: text(v.refundCap),
    maxStake: text(v.maxStake),
  };
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

/** Liest den gespeicherten Stand; kaputte oder fehlende Daten ergeben den Standard. */
export function load(store: Store | undefined): Saved {
  const empty: Saved = { settings: { ...defaultSettings }, taxByProvider: {} };
  try {
    const raw = store?.getItem(KEY);
    if (!raw) return empty;
    const data: unknown = JSON.parse(raw);
    if (!isObject(data)) return empty;
    const s = isObject(data.settings) ? data.settings : {};
    const taxByProvider: Record<string, boolean> = {};
    if (isObject(data.taxByProvider)) {
      for (const [k, val] of Object.entries(data.taxByProvider)) if (typeof val === 'boolean') taxByProvider[k] = val;
    }
    return {
      state: readState(data.state),
      settings: {
        taxPercent: text(s.taxPercent, defaultSettings.taxPercent),
        conversionPercent: text(s.conversionPercent, defaultSettings.conversionPercent),
        budget: text(s.budget, defaultSettings.budget),
      },
      taxByProvider,
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

/** Setzt den Anbieternamen und übernimmt den gemerkten Steuer-Schalter, falls es einen gibt. */
export function withProvider(bet: BetInput, name: string, taxByProvider: Record<string, boolean>): BetInput {
  const remembered = taxByProvider[providerKey(name)];
  return { ...bet, provider: name, tax: remembered ?? bet.tax };
}

/** Merkt den Steuer-Schalter für den Anbieter der Wette (ohne Namen passiert nichts). */
export function rememberTax(
  taxByProvider: Record<string, boolean>,
  provider: string,
  tax: boolean,
): Record<string, boolean> {
  const key = providerKey(provider);
  return key === '' ? taxByProvider : { ...taxByProvider, [key]: tax };
}
