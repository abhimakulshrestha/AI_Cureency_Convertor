import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/convert/route.js";

const realFetch = globalThis.fetch;
const realKey = process.env.GEMINI_API_KEY;
const rate = { base: "USD", quote: "INR", rate: 95.19, date: "2026-10-14" };
const request = (body) => new Request("http://localhost/api/convert", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
});
beforeEach(() => { delete process.env.GEMINI_API_KEY; globalThis.fetch = async () => Response.json(rate); });
afterEach(() => {
  globalThis.fetch = realFetch;
  if (realKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = realKey;
});

test("uses a unit rate and calculates without premature rounding", async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://api.frankfurter.dev/v2/rate/USD/INR");
    assert.ok(options.signal);
    return Response.json(rate);
  };
  const response = await POST(request({ amount: "0.001", from: "usd", to: "inr" }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).result, 0.09519);
});

test("same-currency conversion needs no provider and invents no rate date", async () => {
  globalThis.fetch = () => { throw new Error("Must not fetch"); };
  const response = await POST(request({ amount: 0, from: "USD", to: "USD" }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { amount: 0, from: "USD", to: "USD", rate: 1, result: 0, date: null, source: "Same currency" });
});

for (const body of [null, [], {}, { amount: true, from: "USD", to: "INR" }, { amount: -1, from: "USD", to: "INR" }, { amount: 1e13, from: "USD", to: "INR" }, { amount: 1, from: "BTC", to: "INR" }, { query: "" }, { query: 10 }, { query: "a".repeat(501) }]) {
  test(`rejects invalid input ${JSON.stringify(body).slice(0, 75)}`, async () => {
    globalThis.fetch = () => { throw new Error("Must not fetch"); };
    assert.equal((await POST(request(body))).status, 400);
  });
}

test("rejects malformed JSON, wrong content type, and oversized body", async () => {
  assert.equal((await POST(new Request("http://localhost", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" }))).status, 400);
  assert.equal((await POST(new Request("http://localhost", { method: "POST", body: "{}" }))).status, 415);
  assert.equal((await POST(request({ query: "a".repeat(5000) }))).status, 413);
});

test("polite ISO request works without Gemini", async () => {
  const response = await POST(request({ query: "Can you convert 1,000 USD to INR?" }));
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.result, 95190);
  assert.equal(data.parser, "local");
});

test("missing Gemini configuration is actionable", async () => {
  const response = await POST(request({ query: "ten US dollars in Indian rupees" }));
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /manual converter/);
});

for (const mock of [async () => { throw new TypeError("fetch failed"); }, async () => new Response("down", { status: 503 }), async () => new Response("not json"), async () => Response.json({ ...rate, rate: 0 }), async () => Response.json({ ...rate, rate: "95" }), async () => Response.json({ ...rate, quote: "EUR" }), async () => Response.json({ ...rate, date: "bad" })]) {
  test("rate outage or corrupt response returns a safe 502", async () => {
    globalThis.fetch = mock;
    const response = await POST(request({ amount: 100, from: "USD", to: "INR" }));
    assert.equal(response.status, 502);
    assert.match((await response.json()).error, /Exchange rates are unavailable/);
  });
}

test("Gemini receives the key only in a header, then rates come from the provider", async () => {
  process.env.GEMINI_API_KEY = "test-secret";
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++;
    if (url.includes("googleapis")) {
      assert.ok(!url.includes("test-secret"));
      assert.equal(options.headers["x-goog-api-key"], "test-secret");
      assert.equal(options.cache, "no-store");
      return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ valid: true, amount: 10, from: "USD", to: "INR" }) }] } }] });
    }
    return Response.json(rate);
  };
  const response = await POST(request({ query: "ten US dollars in Indian rupees" }));
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.parser, "gemini");
  assert.equal(data.result, 951.9);
  assert.equal(calls, 2);
});

for (const status of [400, 403, 404, 429, 500]) {
  test(`Gemini HTTP ${status} is recoverable and never exposes its response`, async () => {
    process.env.GEMINI_API_KEY = "test-secret";
    globalThis.fetch = async () => new Response("sensitive upstream details", { status });
    const response = await POST(request({ query: "ten US dollars in Indian rupees" }));
    assert.equal(response.status, 503);
    assert.ok(!(await response.text()).includes("sensitive"));
  });
}

for (const output of ["bad json", JSON.stringify({ valid: false }), JSON.stringify({ valid: true, amount: -1, from: "USD", to: "INR" }), JSON.stringify({ valid: true, amount: true, from: "USD", to: "INR" })]) {
  test("invalid Gemini output is rejected", async () => {
    process.env.GEMINI_API_KEY = "test-secret";
    globalThis.fetch = async () => Response.json({ candidates: [{ content: { parts: [{ text: output }] } }] });
    assert.equal((await POST(request({ query: "ten US dollars in Indian rupees" }))).status, 422);
  });
}
