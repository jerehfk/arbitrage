import { useMemo } from 'preact/hooks';
import type { Goals } from '../core/hedge';
import { Chips } from './Chips';
import { calculateHedge, type HedgeState } from './hedgeModel';

const GOALS: Goals[] = ['egal', 'ueber', 'unter'];

interface Props {
  state: HedgeState;
  setState: (update: (s: HedgeState) => HedgeState) => void;
}

/** Reiter "Absichern": eigene Wette wählen, passende Absicherungen als Tabelle sehen. */
export function HedgeTab({ state, setState }: Props) {
  const calc = useMemo(() => calculateHedge(state), [state]);
  const set = (patch: Partial<HedgeState>) => setState((s) => ({ ...s, ...patch }));

  const home = state.home.trim() || 'Heim';
  const away = state.away.trim() || 'Auswärts';
  const line = state.line.trim() || '2,5';

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
              <label>
                <span>Torlinie</span>
                <input inputMode="decimal" value={state.line} onInput={(e) => set({ line: e.currentTarget.value })} />
              </label>
            </div>
            <Chips
              legend="Gewinnt bei (Ergebnis)"
              name="results"
              mode="checkbox"
              options={[home, 'Remis', away]}
              selected={state.results}
              onChange={(results) => set({ results })}
            />
            <Chips
              legend="Tore"
              name="goals"
              mode="radio"
              options={['Egal', `Über ${line}`, `Unter ${line}`]}
              selected={[GOALS.indexOf(state.goals)]}
              onChange={([g]) => set({ goals: GOALS[g] })}
            />
          </div>
          {calc.boostLabel && <p class="note">Deine Wette: {calc.boostLabel}</p>}
        </section>
      </div>

      <div class="side">
        <section class="hedges" aria-labelledby="h-hedges">
          <h2 id="h-hedges">Absicherungen</h2>
          {calc.hint ? (
            <p class="hint">{calc.hint}</p>
          ) : (
            <>
              <table class="options">
                <thead>
                  <tr>
                    <th scope="col">Wetten</th>
                    <th scope="col">Absicherung</th>
                  </tr>
                </thead>
                <tbody>
                  {calc.options.map((option) => (
                    <tr key={option.id}>
                      <td>{option.legs.length}</td>
                      <td>
                        <ul>
                          {option.legs.map((leg) => (
                            <li key={leg.label}>
                              {leg.label}
                              {leg.combo && <span class="badge">Kombi</span>}
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p class="note">
                Wenige Wetten zuerst. Ungeprüft: ob es diese Märkte beim Anbieter oder an der Börse gibt, weiß die App
                nicht.
              </p>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
