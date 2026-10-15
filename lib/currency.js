export const CURRENCIES = [
  ["USD", "US Dollar"],
  ["EUR", "Euro"],
  ["INR", "Indian Rupee"],
  ["GBP", "British Pound"],
  ["JPY", "Japanese Yen"],
  ["AUD", "Australian Dollar"],
  ["CAD", "Canadian Dollar"],
  ["CHF", "Swiss Franc"],
  ["CNY", "Chinese Yuan"],
  ["SGD", "Singapore Dollar"],
  ["AED", "UAE Dirham"],
  ["SAR", "Saudi Riyal"],
  ["NZD", "New Zealand Dollar"],
  ["HKD", "Hong Kong Dollar"],
  ["SEK", "Swedish Krona"],
  ["NOK", "Norwegian Krone"],
  ["DKK", "Danish Krone"],
  ["ZAR", "South African Rand"],
  ["BRL", "Brazilian Real"],
  ["MXN", "Mexican Peso"],
  ["KRW", "South Korean Won"],
  ["THB", "Thai Baht"],
  ["MYR", "Malaysian Ringgit"],
  ["IDR", "Indonesian Rupiah"],
  ["PHP", "Philippine Peso"],
  ["TRY", "Turkish Lira"],
  ["PLN", "Polish Zloty"],
  ["CZK", "Czech Koruna"],
  ["HUF", "Hungarian Forint"],
  ["ILS", "Israeli Shekel"]
];

export const CURRENCY_CODES = new Set(CURRENCIES.map(([code]) => code));

const numberFormatter = new Intl.NumberFormat("en-US", { maximumSignificantDigits: 12 });
const scientificFormatter = new Intl.NumberFormat("en-US", { maximumSignificantDigits: 12, notation: "scientific" });

export function formatCurrencyNumber(value) {
  const formatted = numberFormatter.format(value);
  return formatted.length > 20 ? scientificFormatter.format(value) : formatted;
}

export function normalizeCurrency(value) {
  const code = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!CURRENCY_CODES.has(code)) {
    throw new Error("Select a supported currency.");
  }
  return code;
}

export function normalizeAmount(value) {
  if (typeof value !== "number" && (typeof value !== "string" || !/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim()))) {
    throw new Error("Enter a valid amount.");
  }
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 1e12) {
    throw new Error("Amount must be between 0 and 1,000,000,000,000.");
  }
  return amount;
}

export function normalizeConversion(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Enter an amount and two currencies.");
  }
  return { amount: normalizeAmount(input.amount), from: normalizeCurrency(input.from), to: normalizeCurrency(input.to) };
}

export function calculateConversion(amount, rate) {
  const result = amount * rate;
  if (!Number.isFinite(rate) || rate <= 0 || !Number.isFinite(result)) {
    throw new Error("Invalid exchange rate.");
  }
  return Number(result.toPrecision(15));
}

export function parseCurrencyQuery(query) {
  const text = typeof query === "string" ? query.trim() : "";
  // Only parse an unambiguous single conversion locally; other wording goes to Gemini.
  const match = text.match(/^(?:(?:can|could|would) you\s+)?(?:please\s+)?(?:(?:convert|change|exchange|try)\s+)?((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|\.\d+)\s*([a-z]{3})\s+(?:to|in|into)\s+([a-z]{3})(?:\s+please)?[?.!]?$/i);
  if (!match) {
    throw new Error("Try a query like: convert 100 USD to INR.");
  }

  return normalizeConversion({ amount: match[1].replaceAll(",", ""), from: match[2], to: match[3] });
}
