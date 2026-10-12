import type { Settings } from '../core/optimizer';
import { parseNumber } from './format';
import { DEFAULT_BUDGET } from './model';

/** Einstellungen als Eingabetexte, so wie sie in den Feldern stehen. */
export interface UiSettings {
  /** Wettsteuer in Prozent. */
  taxPercent: string;
  /** Wert einer Gratiswette in Prozent ihres Betrags. */
  conversionPercent: string;
  /** Gesamteinsatz, wenn kein Einsatz fest ist, in Euro. */
  budget: string;
  /** Provision der Gegenseite (Börse) in Prozent, nur für die Quoten-Übersicht beim Bonus. */
  commissionPercent: string;
}

export const defaultSettings: UiSettings = {
  taxPercent: '5,3',
  conversionPercent: '60',
  budget: String(DEFAULT_BUDGET),
  commissionPercent: '3',
};

export interface ResolvedSettings {
  settings: Settings;
  budget: number;
  /** Provision der Gegenseite als Anteil (0,03 = 3 %). */
  commission: number;
  errors: Partial<Record<keyof UiSettings, string>>;
}

function percent(text: string, fallback: number): { value: number; error?: string } {
  const n = parseNumber(text);
  if (n === null || n < 0 || n > 100) return { value: fallback, error: 'Gib eine Zahl von 0 bis 100 ein.' };
  return { value: n / 100 };
}

/** Wandelt die Eingabetexte in Zahlen um; ungültige Felder fallen auf den Standard zurück. */
export function resolveSettings(ui: UiSettings): ResolvedSettings {
  const errors: ResolvedSettings['errors'] = {};
  const tax = percent(ui.taxPercent, 0.053);
  if (tax.error) errors.taxPercent = tax.error;
  const conversion = percent(ui.conversionPercent, 0.6);
  if (conversion.error) errors.conversionPercent = conversion.error;
  const commission = percent(ui.commissionPercent, 0.03);
  if (commission.error) errors.commissionPercent = commission.error;
  const budget = parseNumber(ui.budget);
  if (budget === null || budget <= 0) errors.budget = 'Der Gesamteinsatz muss größer als 0 sein.';
  return {
    settings: { taxRate: tax.value, conversionRate: conversion.value },
    budget: budget !== null && budget > 0 ? budget : DEFAULT_BUDGET,
    commission: commission.value,
    errors,
  };
}
