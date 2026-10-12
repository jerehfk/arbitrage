import { useMemo } from 'preact/hooks';
import { calculateHedge, type HedgeState } from './hedgeModel';

interface Props {
  state: HedgeState;
  setState: (update: (s: HedgeState) => HedgeState) => void;
}

/** Reiter "Absichern": eigene Wette als Text eingeben, die beste Absicherung als Tabelle sehen. */
export function HedgeTab({ state, setState }: Props) {
  const calc = useMemo(() => calculateHedge(state), [state]);
  const set = (patch: Partial<HedgeState>) => setState((s) => ({ ...s, ...patch }));
  const namesMissing = calc.unknown.length > 0 && (!state.home.trim() || !state.away.trim());

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
                  </tr>
                </thead>
                <tbody>
                  {calc.best.legs.map((leg) => (
                    <tr key={leg.label}>
                      <td>
                        {leg.label}
                        {leg.combo && <span class="badge">Kombi</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p class="note">
                Wenige Wetten, wenig doppelt abgedeckte Fälle, möglichst wenige Kombi-Wetten. Ungeprüft: ob es diese
                Märkte beim Anbieter oder an der Börse gibt, weiß die App nicht. Grobe Annahme: höchstens 5 Tore pro Team
                und Halbzeit.
              </p>
            </>
          ) : (
            <p class="hint">{calc.hint}</p>
          )}
        </section>
      </div>
    </main>
  );
}
