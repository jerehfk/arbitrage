interface Props {
  legend: string;
  options: string[];
  selected: number[];
  /** `checkbox`: mehrere wählbar (mindestens eines bleibt aktiv), `radio`: genau eines. */
  mode: 'checkbox' | 'radio';
  name: string;
  onChange: (selected: number[]) => void;
  class?: string;
}

/** Antippbare Felder zur Auswahl eines oder mehrerer Einträge. */
export function Chips({ legend, options, selected, mode, name, onChange, class: className }: Props) {
  return (
    <fieldset class={className ?? 'f-covers'}>
      <legend>{legend}</legend>
      <div class="chips">
        {options.map((label, k) => {
          const on = selected.includes(k);
          return (
            <label class={on ? 'chip on' : 'chip'} key={k}>
              <input
                type={mode as 'checkbox'}
                name={mode === 'radio' ? name : undefined}
                checked={on}
                onChange={() => {
                  if (mode === 'radio') return onChange([k]);
                  const next = on ? selected.filter((c) => c !== k) : [...selected, k].sort();
                  if (next.length > 0) onChange(next);
                }}
              />
              <span>{label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
