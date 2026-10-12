/**
 * Spielmodell für das Absichern: Ein Spiel ist ein Torverlauf (Tore je Team je Halbzeit, je 0 bis CAP,
 * CAP steht für "CAP oder mehr"). Jede Wette ist eine Bedingung auf diesen Verläufen ("Markt").
 */
export const CAP = 8;
const SIDE = CAP + 1;
export const CELL_COUNT = SIDE ** 4;

interface Cell {
  h1: number;
  a1: number;
  h2: number;
  a2: number;
}

const cells: Cell[] = [];
for (let h1 = 0; h1 < SIDE; h1++)
  for (let a1 = 0; a1 < SIDE; a1++)
    for (let h2 = 0; h2 < SIDE; h2++) for (let a2 = 0; a2 < SIDE; a2++) cells.push({ h1, a1, h2, a2 });

/** Grobe Annahme zum Gewichten: durchschnittliches Spiel, 45 % der Tore in Halbzeit 1. Keine Wettprognose. */
const PRIOR = { home: 1.5, away: 1.2, firstHalf: 0.45 };

function poissonBuckets(lambda: number): number[] {
  const p: number[] = [];
  let sum = 0;
  for (let k = 0; k < CAP; k++) {
    const v = (Math.exp(-lambda) * lambda ** k) / factorial(k);
    p.push(v);
    sum += v;
  }
  p.push(1 - sum);
  return p;
}

function factorial(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

/** Wahrscheinlichkeit jedes Torverlaufs unter der groben Annahme. */
export const cellProb: Float64Array = (() => {
  const h1 = poissonBuckets(PRIOR.home * PRIOR.firstHalf);
  const a1 = poissonBuckets(PRIOR.away * PRIOR.firstHalf);
  const h2 = poissonBuckets(PRIOR.home * (1 - PRIOR.firstHalf));
  const a2 = poissonBuckets(PRIOR.away * (1 - PRIOR.firstHalf));
  return Float64Array.from(cells, (c) => h1[c.h1] * a1[c.a1] * h2[c.h2] * a2[c.a2]);
})();

export type Res = 'H' | 'D' | 'A';
export interface Names {
  home: string;
  away: string;
}

export interface Market {
  key: string;
  label: string;
  /** 1 an den Torverläufen, bei denen die Wette gewinnt. */
  mask: Uint8Array;
  /** Anzahl der verknüpften Bedingungen; über 1 ist eine Kombi-Wette. */
  parts: number;
  /** Beschriftung darf in Kombis mit kleinem Anfangsbuchstaben stehen ("& über 2,5 Tore"). */
  lowerable: boolean;
}

export const isCombo = (m: Market) => m.parts > 1;
export const count = (m: Market) => m.mask.reduce((s, v) => s + v, 0);

const make = (key: string, label: string, test: (c: Cell) => boolean, lowerable = false): Market => ({
  key,
  label,
  mask: Uint8Array.from(cells, (c) => (test(c) ? 1 : 0)),
  parts: 1,
  lowerable,
});

const homeName = (n: Names) => n.home.trim() || 'Heim';
const awayName = (n: Names) => n.away.trim() || 'Auswärts';
export const fmt = (n: number) => String(n).replace('.', ',');
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const order: Res[] = ['H', 'D', 'A'];
const sortSet = (set: Res[]) => order.filter((r) => set.includes(r));

const resOf = (h: number, a: number): Res => (h > a ? 'H' : h === a ? 'D' : 'A');
const full = (c: Cell) => ({ h: c.h1 + c.h2, a: c.a1 + c.a2 });

export function resultLabel(set: Res[], n: Names): string {
  const s = sortSet(set).join('');
  switch (s) {
    case 'H':
      return `${homeName(n)} gewinnt`;
    case 'D':
      return 'Remis';
    case 'A':
      return `${awayName(n)} gewinnt`;
    case 'HD':
      return `${homeName(n)} oder Remis`;
    case 'DA':
      return `Remis oder ${awayName(n)}`;
    default:
      return `${homeName(n)} oder ${awayName(n)}`;
  }
}

export function resultMarket(set: Res[], n: Names): Market {
  const s = sortSet(set);
  return make(`R:${s.join('')}`, resultLabel(s, n), (c) => {
    const f = full(c);
    return s.includes(resOf(f.h, f.a));
  });
}

export function goalsMarket(over: boolean, line: number): Market {
  return make(
    `G:${over ? 'o' : 'u'}${line}`,
    `${over ? 'Über' : 'Unter'} ${fmt(line)} Tore`,
    (c) => {
      const f = full(c);
      return over ? f.h + f.a > line : f.h + f.a < line;
    },
    true,
  );
}

export function bttsMarket(yes: boolean): Market {
  return make(
    `B:${yes ? 'j' : 'n'}`,
    yes ? 'Beide Teams treffen' : 'Nicht beide Teams treffen',
    (c) => {
      const f = full(c);
      return (f.h > 0 && f.a > 0) === yes;
    },
    true,
  );
}

/** Ergebnis in einer oder beiden Halbzeiten (bei beiden muss es in jeder Halbzeit gelten). */
export function halfMarket(halves: (1 | 2)[], set: Res[], n: Names): Market {
  const s = sortSet(set);
  const where = halves.length === 2 ? 'beiden Halbzeiten' : `Halbzeit ${halves[0]}`;
  const single = s.length === 1 && s[0] !== 'D';
  const label = single
    ? `${s[0] === 'H' ? homeName(n) : awayName(n)} gewinnt ${halves.length === 2 ? 'beide Halbzeiten' : `Halbzeit ${halves[0]}`}`
    : `${resultLabel(s, n)} in ${where}`;
  return make(`T:${halves.join('')}:${s.join('')}`, label, (c) =>
    halves.every((h) => s.includes(h === 1 ? resOf(c.h1, c.a1) : resOf(c.h2, c.a2))),
  );
}

/** Sieg mit genau `n` Toren Unterschied oder (`atLeast`) mit mindestens `n`. */
export function marginMarket(team: 'H' | 'A', n: number, atLeast: boolean, names: Names): Market {
  const name = team === 'H' ? homeName(names) : awayName(names);
  return make(
    `M:${team}${atLeast ? '>=' : '='}${n}`,
    `${name} gewinnt mit ${atLeast ? 'mindestens' : 'genau'} ${n} ${n === 1 ? 'Tor' : 'Toren'} Unterschied`,
    (c) => {
      const f = full(c);
      const d = team === 'H' ? f.h - f.a : f.a - f.h;
      return atLeast ? d >= n : d === n;
    },
  );
}

/** Handicap mit halber Linie, z. B. -1,5: Team gewinnt mit mindestens 2 Toren Unterschied. */
export function handicapMarket(team: 'H' | 'A', value: number, names: Names): Market {
  const name = team === 'H' ? homeName(names) : awayName(names);
  const sign = value > 0 ? '+' : '−';
  return make(`C:${team}${value}`, `${name} Handicap ${sign}${fmt(Math.abs(value))}`, (c) => {
    const f = full(c);
    const d = team === 'H' ? f.h - f.a : f.a - f.h;
    return d + value > 0;
  });
}

/** Beide Bedingungen zugleich. */
export function and(a: Market, b: Market): Market {
  return {
    key: `${a.key}&${b.key}`,
    label: `${a.label} & ${b.lowerable ? lowerFirst(b.label) : b.label}`,
    mask: Uint8Array.from(a.mask, (v, i) => (v && b.mask[i] ? 1 : 0)),
    parts: a.parts + b.parts,
    lowerable: false,
  };
}
