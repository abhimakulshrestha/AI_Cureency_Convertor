import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateTravelBudget, rememberConversion, parseRecentConversions } from "../lib/workspace.js";

test("travel budget deducts the source fee before conversion and daily allocation", () => {
  assert.deepEqual(calculateTravelBudget(100, 95, "5", "2"), { feeInSource: 2, available: 9310, daily: 1862 });
  assert.deepEqual(calculateTravelBudget(0, 95, 7, 0), { feeInSource: 0, available: 0, daily: 0 });
  assert.equal(calculateTravelBudget(100, 1, 1, 20).daily, 80);
});

test("planner rejects invalid days, fees, amounts, and rates", () => {
  for (const days of [0, -1, 1.5, 366, "", true, null]) assert.throws(() => calculateTravelBudget(100, 95, days, 0));
  for (const fee of [-1, 21, "", true, Infinity]) assert.throws(() => calculateTravelBudget(100, 95, 7, fee));
  assert.throws(() => calculateTravelBudget(100, 0, 7, 0));
  assert.throws(() => calculateTravelBudget(-1, 95, 7, 0));
});

test("history stores only validated inputs, deduplicates, and keeps six entries", () => {
  let history = [];
  for (let amount = 1; amount <= 8; amount++) history = rememberConversion(history, { amount, from: "USD", to: "INR", query: "private text", rate: 95 });
  assert.equal(history.length, 6);
  assert.deepEqual(history.map(item => item.amount), [8, 7, 6, 5, 4, 3]);
  history = rememberConversion(history, { amount: 5, from: "usd", to: "inr" });
  assert.deepEqual(history[0], { amount: 5, from: "USD", to: "INR" });
  assert.equal(history.length, 6);
  assert.equal(JSON.stringify(history).includes("private text"), false);
});

test("corrupt, excessive, or unsupported saved history cannot break the app", () => {
  for (const value of [null, "bad json", "{}", "null", "[]", "x".repeat(10001)]) assert.deepEqual(parseRecentConversions(value), []);
  assert.deepEqual(parseRecentConversions(JSON.stringify([null, { amount: -1, from: "USD", to: "INR" }, { amount: 2, from: "BTC", to: "USD" }, { amount: 0, from: "USD", to: "INR" }])), [{ amount: 0, from: "USD", to: "INR" }]);
});
