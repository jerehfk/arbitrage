import { useMemo } from 'preact/hooks';
import type { Goals } from '../core/hedge';
import type { Settings } from '../core/optimizer';
import { BetEditor } from './BetEditor';
import { Chips } from './Chips';
import { formatEuro, formatPlain } from './format';
import { calculateHedge, type HedgeOption, type HedgeState } from './hedgeModel';
import { ResultPanel } from './ResultPanel';

const GOALS: Goals[] = ['egal', 'ueber', 'unter'];

interface Props {
  state: HedgeState;
  setState: (update: (s: HedgeState) => HedgeState) => void;
  settings: Settings;
  budget: number;
}

/** Mindestquote immer aufrunden, damit eine knapp zu niedrige Quote nicht als ausreichend gilt. */
const roundUp = (n: number) => formatPlain(Math.ceil(n * 100 - 1e-9) / 100);

function breakEvenText(option: HedgeOption): string {
  if (option.breakEven === undefined) return 'Trage die Quote deiner Wette ein, dann steht hier die Mindestquote.';
  if (option.breakEven === null) return 'Mit diesen Angaben ist kein sicherer Gewinn möglich.';
  return option.legs.length === 1
    ? `Mindestquote für einen sicheren Gewinn: ${roundUp(option.breakEven)}`
    : `Mindestquote bei gleicher Quote für alle: ${roundUp(option.breakEven)}`;
}

/** Reiter "Absichern": eine Wette eingeben, passende Absicherungen sehen. */
export function HedgeTab({ state, setState, settings, budget }: Props) {
  const calc = useMemo(() => calculateHedge(state, settings, budget), [state, settings, budget]);
  const selected = calc.options.find((o) => o.id === calc.selectedId);
  const plan = selected?.plan;

  const set = (patch: Partial<HedgeState>) => setState((s) => ({ ...s, ...patch }));
  const setHedge = (key: string, patch: Partial<{ odds: string; tax: boolean }>) =>
    setState((s) => ({ ...s, hedges: { ...s.hedges, [key]: { ...(s.hedges[key] ?? { odds: '', tax: false }), ...patch } } }));

  const home = state.home.trim() || 'Heim';
  const away = state.away.trim() || 'Auswärts';
  const goalLabels = ['Egal', `Über ${state.line.trim() || '2,5'}`, `Unter ${state.line.trim() || '2,5'}`];

  let hint = calc.hint;
  if (!hint && !plan) {
    if (selected?.unbounded || calc.options.some((o) => o.unbounded)) {
      hint = 'Lege bei deiner Wette einen Einsatz oder Max-Einsatz fest.';
    } else if (calc.options.every((o) => o.breakEven === undefined)) {
      hint = 'Trage die Quote deiner Wette ein.';
    } else {
      hint = 'Trage bei einem Vorschlag die Quoten ein, dann siehst du Einsätze und Gewinn.';
    }
  }

  return (
    <main class="layout">
      <div class="inputs">
        <section aria-labelledby="h-game">
          <h2 id="h-game">Spiel</h2>
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
        </section>

        <section aria-labelledby="h-mine">
          <h2 id="h-mine">Deine Wette</h2>
          <div class="bet">
            <BetEditor
              fields={state.boost}
              errors={calc.errors}
              onChange={(patch) => set({ boost: { ...state.boost, ...patch } })}
            >
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
                options={goalLabels}
                selected={[GOALS.indexOf(state.goals)]}
                onChange={([g]) => set({ goals: GOALS[g] })}
              />
            </BetEditor>
          </div>
          {calc.boostLabel && <p class="note">Deine Wette: {calc.boostLabel}</p>}
        </section>
      </div>

      <div class="side">
        <ResultPanel
          rows={plan ? plan.outcomes.map((o, k) => ({ ...o, name: calc.cellNames[k] })) : undefined}
          minValue={plan?.minValue}
          equal={plan?.equal}
          totalStake={plan?.totalStake}
          conversionRate={settings.conversionRate}
          note={
            plan && calc.assumedBudget !== undefined
              ? `Kein Einsatz festgelegt, gerechnet mit ${formatEuro(calc.assumedBudget)} Gesamteinsatz.`
              : undefined
          }
          hint={hint}
        />

        {calc.options.length > 0 && (
          <section class="hedges" aria-labelledby="h-hedges">
            <h2 id="h-hedges">Absicherungen</h2>
            <p class="note">
              Wenige Wetten zuerst. Ungeprüft: ob es diese Märkte beim Anbieter oder an der Börse gibt, weiß die App
              nicht.
            </p>
            <ul class="options">
              {calc.options.map((option) => {
                const on = option.id === calc.selectedId;
                return (
                  <li class={on ? 'option on' : 'option'} key={option.id}>
                    <label class="option-head">
                      <input
                        type="radio"
                        name="hedge-option"
                        checked={on}
                        disabled={!option.plan}
                        onChange={() => set({ selected: option.id })}
                      />
                      <span>{option.legs.length === 1 ? '1 Wette' : `${option.legs.length} Wetten`}</span>
                    </label>
                    {option.legs.map((leg, i) => (
                      <div class="leg" key={leg.key}>
                        <p class="leg-name">
                          {leg.label}
                          {leg.combo && <span class="badge">Kombi</span>}
                        </p>
                        <div class="leg-fields">
                          <label>
                            <span>Quote</span>
                            <input
                              inputMode="decimal"
                              aria-invalid={leg.error ? 'true' : undefined}
                              value={state.hedges[leg.key]?.odds ?? ''}
                              onInput={(e) => setHedge(leg.key, { odds: e.currentTarget.value })}
                            />
                          </label>
                          <label class="tax">
                            <input
                              type="checkbox"
                              role="switch"
                              checked={state.hedges[leg.key]?.tax ?? false}
                              onChange={(e) => setHedge(leg.key, { tax: e.currentTarget.checked })}
                            />
                            <span>Steuer</span>
                          </label>
                          {option.stakes && (
                            <p class="leg-stake">
                              <span>Einsatz</span>
                              <strong>{formatEuro(option.stakes[i + 1])}</strong>
                            </p>
                          )}
                        </div>
                        {leg.error && <em class="error">{leg.error}</em>}
                      </div>
                    ))}
                    <p class="note">{breakEvenText(option)}</p>
                    {option.stakes && (
                      <p class="note">Deine Wette: {formatEuro(option.stakes[0])} Einsatz</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
