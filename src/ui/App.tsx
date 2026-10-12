import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { FreeTab, initialFree } from './FreeTab';
import { HedgeTab } from './HedgeTab';
import { initialHedge, type HedgeState } from './hedgeModel';
import type { UiState } from './model';
import { defaultSettings, resolveSettings, type UiSettings } from './settings';
import { load, save, type Tab } from './storage';

function getStore(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function App() {
  const [saved] = useState(() => load(getStore()));
  const [tab, setTab] = useState<Tab>(saved.tab);
  const [free, setFree] = useState<UiState>(saved.state ?? initialFree);
  const [hedge, setHedge] = useState<HedgeState>(saved.hedge ?? initialHedge);
  const [ui, setUi] = useState<UiSettings>(saved.settings);
  const [showSettings, setShowSettings] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const resolved = useMemo(() => resolveSettings(ui), [ui]);

  const resetInputs = () => {
    setFree(initialFree);
    setHedge(initialHedge);
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (showSettings && !dialog.open) dialog.showModal();
    if (!showSettings && dialog.open) dialog.close();
  }, [showSettings]);

  useEffect(() => {
    save(getStore(), { tab, state: free, hedge, settings: ui });
  }, [tab, free, hedge, ui]);

  return (
    <div class="page">
      <header class="top">
        <h1>Sportwetten-Rechner</h1>
        <button class="icon gear" aria-label="Einstellungen" aria-haspopup="dialog" onClick={() => setShowSettings(true)}>
          {'\u2699\uFE0E'}
        </button>
      </header>

      <div class="tabs" role="tablist" aria-label="Ansicht">
        <button role="tab" aria-selected={tab === 'absichern'} class={tab === 'absichern' ? 'on' : ''} onClick={() => setTab('absichern')}>
          Absichern
        </button>
        <button role="tab" aria-selected={tab === 'frei'} class={tab === 'frei' ? 'on' : ''} onClick={() => setTab('frei')}>
          Frei
        </button>
      </div>

      <dialog
        ref={dialogRef}
        class="settings"
        aria-labelledby="h-settings"
        onClose={() => setShowSettings(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setShowSettings(false);
        }}
      >
        <div class="sheet">
          <div class="sheet-head">
            <h2 id="h-settings">Einstellungen</h2>
            <button class="icon" aria-label="Einstellungen schließen" onClick={() => setShowSettings(false)}>
              ×
            </button>
          </div>
          <div class="fields">
            <label>
              <span>Wettsteuer in %</span>
              <input
                inputMode="decimal"
                aria-invalid={resolved.errors.taxPercent ? 'true' : undefined}
                value={ui.taxPercent}
                onInput={(e) => setUi({ ...ui, taxPercent: e.currentTarget.value })}
              />
              {resolved.errors.taxPercent && <em class="error">{resolved.errors.taxPercent}</em>}
            </label>
            <label>
              <span>Wert einer Gratiswette in %</span>
              <input
                inputMode="decimal"
                aria-invalid={resolved.errors.conversionPercent ? 'true' : undefined}
                value={ui.conversionPercent}
                onInput={(e) => setUi({ ...ui, conversionPercent: e.currentTarget.value })}
              />
              {resolved.errors.conversionPercent && <em class="error">{resolved.errors.conversionPercent}</em>}
            </label>
            <label>
              <span>Start-Gesamteinsatz in €</span>
              <input
                inputMode="decimal"
                aria-invalid={resolved.errors.budget ? 'true' : undefined}
                value={ui.budget}
                onInput={(e) => setUi({ ...ui, budget: e.currentTarget.value })}
              />
              {resolved.errors.budget && <em class="error">{resolved.errors.budget}</em>}
            </label>
            <label>
              <span>Provision der Gegenseite in %</span>
              <input
                inputMode="decimal"
                aria-invalid={resolved.errors.commissionPercent ? 'true' : undefined}
                value={ui.commissionPercent}
                onInput={(e) => setUi({ ...ui, commissionPercent: e.currentTarget.value })}
              />
              {resolved.errors.commissionPercent && <em class="error">{resolved.errors.commissionPercent}</em>}
            </label>
          </div>
          <div class="actions">
            <button class="add" onClick={() => setUi({ ...defaultSettings })}>
              Einstellungen zurücksetzen
            </button>
            <button class="add" onClick={resetInputs}>
              Eingaben zurücksetzen
            </button>
          </div>
        </div>
      </dialog>

      {tab === 'absichern' ? (
        <HedgeTab state={hedge} setState={setHedge} resolved={resolved} />
      ) : (
        <FreeTab state={free} setState={setFree} settings={resolved.settings} budget={resolved.budget} />
      )}
    </div>
  );
}
