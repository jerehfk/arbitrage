import { useMemo } from 'preact/hooks';
import { BetEditor } from './BetEditor';
import { formatEuro, formatGain } from './format';
import { calculateHedge, type HedgeLeg, type HedgeState } from './hedgeModel';
import { ResultPanel } from './ResultPanel';
import type { BetFields } from './model';
import type { ResolvedSettings } from './settings';

interface Props {
  state: HedgeState;
  setState: (update: (s: HedgeState) => HedgeState) => void;
  resolved: ResolvedSettings;
}

const percent = (n: number) => `${Math.round(n * 100)} %`;

/** Reiter "Absichern": eigene Wette als Text eingeben, die beste Absicherung als Tabelle sehen; optional mit Bonus und Quoten. */
export function HedgeTab({ state, setState, resolved }: Props) {
  const calc = useMemo(() => calculateHedge(state, resolved), [state, resolved]);
  const set = (patch: Partial<HedgeState>) => setState((s) => ({ ...s, ...patch }));
  const setOwn = (patch: Partial<BetFields>) => setState((s) => ({ ...s, own: { ...s.own, ...patch } }));
  const setQuote = (key: string, patch: Partial<{ odds: string; tax: boolean }>) =>
    setState((s) => ({ ...s, quotes: { ...s.quotes, [key]: { ...(s.quotes[key] ?? { odds: '', tax: false }), ...patch } } }));
  const namesMissing = calc.unknown.length > 0 && (!state.home.trim() || !state.away.trim());
  const money = calc.money;
  const showStakes = money !== undefined;
  const bonus = state.own.type === 'gratiswette' || state.own.type === 'risikofrei';

  const rateNote =
    money?.rate !== undefined && !money.hint
      ? `Umwandlung: ${percent(money.rate)} ${state.own.type === 'gratiswette' ? 'der Gratiswette' : 'des Einsatzes'}.`
      : undefined;
  const note = [rateNote, money?.note].filter(Boolean).join(' ') || undefined;

  const legRow = (leg: HedgeLeg) => (
    <tr key={leg.key}>
      <td>
        {leg.label}
        {leg.combo && <span class="badge">Kombi</span>}
      </td>
      <td class="q">
        <input
          inputMode="decimal"
          aria-label={`Quote für ${leg.label}`}
          placeholder="Quote"
          value={state.quotes[leg.key]?.odds ?? ''}
          onInput={(e) => setQuote(leg.key, { odds: e.currentTarget.value })}
        />
        <label class="tax">
          <input
            type="checkbox"
            role="switch"
            checked={state.quotes[leg.key]?.tax ?? false}
            onChange={(e) => setQuote(leg.key, { tax: e.currentTarget.checked })}
          />
          <span>Steuer</span>
        </label>
      </td>
      {showStakes && <td class="num">{leg.stake !== undefined ? formatEuro(leg.stake) : ''}</td>}
    </tr>
  );

  return (
    <main class="layout">
      <div class="inputs">
        <section aria-labelledby="h-mine">
          <h2 id="h-mine">Deine Wette</h2>
          <div class="bet">
            <div class="game">
              <label>
                <span>Heim</span>
                <input value={state.home} placeholder="Heim" onInput={(e) => set({ home: e.currentTarget.value })} />
              </label>
              <label>
                <span>Auswärts</span>
                <input value={state.away} placeholder="Auswärts" onInput={(e) => set({ away: e.currentTarget.value })} />
              </label>
            </div>
            <label class="wide">
              <span>Wette oder Kombi-Wette</span>
              <input
                value={state.text}
                placeholder="z. B. Atlético gewinnt & über 2,5 Tore"
                autoComplete="off"
                onInput={(e) => set({ text: e.currentTarget.value })}
              />
            </label>
          </div>
          {calc.understood && (
            <p class="note">
              Verstanden als: <strong>{calc.understood}</strong>
            </p>
          )}
          {namesMissing && <p class="note">Tipp: Trage oben die Teamnamen ein, dann erkennt die App sie im Text.</p>}
        </section>

        <section aria-labelledby="h-bonus">
          <h2 id="h-bonus">Art und Quote (optional)</h2>
          <div class="bet">
            <BetEditor fields={state.own} errors={calc.ownErrors} stakeHint={money?.ownStake} onChange={setOwn} />
          </div>
          <p class="note">
            {bonus
              ? 'Mit Quote und Gratiswette bzw. Einsatz berechnet die App Einsätze und Gewinn. Gib dazu bei den Absicherungen rechts die Quoten ein.'
              : 'Mit Quoten zeigt die App zusätzlich Einsätze und Gewinn.'}
          </p>
        </section>
      </div>

      <div class="side">
        <section class="hedges" aria-labelledby="h-hedges">
          <h2 id="h-hedges">Beste Absicherung</h2>
          {calc.best ? (
            <>
              <table class="options">
                <thead>
                  <tr>
                    <th scope="col">
                      {calc.best.legs.length === 1 ? 'Setze zusätzlich auf' : `Setze zusätzlich auf diese ${calc.best.legs.length} Wetten`}
                    </th>
                    <th scope="col">Quote</th>
                    {showStakes && <th scope="col">Einsatz</th>}
                  </tr>
                </thead>
                <tbody>{calc.best.legs.map(legRow)}</tbody>
              </table>
              {calc.quoteHint && <p class="note">{calc.quoteHint}</p>}
              <p class="note">
                Wenige Wetten, wenig doppelt abgedeckte Fälle, möglichst wenige Kombi-Wetten. Ungeprüft: ob es diese
                Märkte beim Anbieter oder an der Börse gibt, weiß die App nicht. Grobe Annahme: höchstens 8 Tore pro Team
                und Halbzeit.
              </p>
              {calc.table && (
                <>
                  <h3>Was bringt dein Bonus bei welcher Quote?</h3>
                  <table class="options small">
                    <thead>
                      <tr>
                        <th scope="col">Quote</th>
                        <th scope="col">Gewinn</th>
                        <th scope="col">Umwandlung</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calc.table.map((r) => (
                        <tr key={r.odds}>
                          <td>{String(r.odds).replace('.', ',')}</td>
                          <td class="num">{formatGain(r.profit)}</td>
                          <td class="num">{percent(r.rate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p class="note">
                    Höhere Quote bringt mehr, braucht aber mehr Guthaben für die Gegenwette. Annahme: Die Gegenseite hat
                    keinen Aufschlag, nur {String(Math.round(resolved.commission * 1000) / 10).replace('.', ',')} % Provision.
                  </p>
                </>
              )}
            </>
          ) : (
            <p class="hint">{calc.hint}</p>
          )}
        </section>
        {money && (
          <ResultPanel
            rows={money.hint ? undefined : money.rows}
            minValue={money.minValue}
            equal={money.equal}
            totalStake={money.totalStake}
            conversionRate={resolved.settings.conversionRate}
            note={note}
            hint={money.hint}
          />
        )}
      </div>
    </main>
  );
}
