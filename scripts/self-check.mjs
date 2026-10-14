import assert from "node:assert/strict";
import {
  calculateConversion,
  formatCurrencyNumber,
  normalizeAmount,
  normalizeCurrency,
  parseCurrencyQuery
} from "../lib/currency.js";

assert.equal(calculateConversion(10, 83.12345), 831.2345);
assert.equal(calculateConversion(0.01, 0.000056), 0.00000056);
assert.equal(formatCurrencyNumber(1e12), "1,000,000,000,000");
assert.equal(formatCurrencyNumber(0.00000056), "0.00000056");
assert.equal(formatCurrencyNumber(1e-100), "1E-100");
assert.equal(formatCurrencyNumber(1e16), "1E16");
assert.equal(formatCurrencyNumber(1e17), "1E17");
assert.deepEqual(parseCurrencyQuery("convert 250 usd to inr"), {
  amount: 250,
  from: "USD",
  to: "INR"
});
assert.equal(normalizeCurrency("eur"), "EUR");
assert.throws(() => normalizeCurrency("BTC"), /supported currency/);
assert.equal(normalizeAmount(0), 0);
for (const value of [true, false, null, [], [10], {}, "", " ", "0x10", -1, Infinity, NaN, 1e13]) {
  assert.throws(() => normalizeAmount(value));
}
assert.deepEqual(parseCurrencyQuery("Can you convert 1,000.25 usd to inr?"), { amount: 1000.25, from: "USD", to: "INR" });
for (const query of ["-10 USD to INR", "1,00 USD to INR", "100 USD to INR and 200 EUR to GBP", "100 USD to BTC"]) {
  assert.throws(() => parseCurrencyQuery(query));
}

console.log("Self-checks passed.");
