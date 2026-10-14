import { calculateConversion, normalizeAmount, normalizeCurrency } from "./currency.js";

export const HISTORY_KEY = "currency-converter.recent.v1";

export function calculateTravelBudget(amount, rate, days, feePercent) {
  amount = normalizeAmount(amount);
  days = normalizeAmount(days);
  feePercent = normalizeAmount(feePercent);
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    throw new Error("Trip length must be a whole number from 1 to 365 days.");
  }
  if (feePercent > 20) throw new Error("Estimated fee must be between 0% and 20%.");
  const feeInSource = Number((amount * feePercent / 100).toPrecision(15));
  const feeInTarget = calculateConversion(feeInSource, rate);
  const available = calculateConversion(amount - feeInSource, rate);
  return { feeInSource, feeInTarget, available, daily: Number((available / days).toPrecision(12)) };
}

export function rememberConversion(history, input) {
  const entry = { amount: normalizeAmount(input.amount), from: normalizeCurrency(input.from), to: normalizeCurrency(input.to) };
  return [entry, ...history.filter(item => item.amount !== entry.amount || item.from !== entry.from || item.to !== entry.to)].slice(0, 6);
}

export function parseRecentConversions(raw) {
  if (typeof raw !== "string" || raw.length > 10000) return [];
  try {
    const entries = JSON.parse(raw);
    if (!Array.isArray(entries)) return [];
    return entries.slice(0, 6).reduceRight((history, entry) => {
      try { return rememberConversion(history, entry); }
      catch { return history; }
    }, []);
  } catch { return []; }
}
