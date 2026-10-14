"use client";

import { useEffect, useState } from "react";
import { ArrowLeftRight, ArrowUpRight, Coins, History, Trash2 } from "lucide-react";
import { CURRENCIES, formatCurrencyNumber } from "../lib/currency.js";
import { HISTORY_KEY, parseRecentConversions, rememberConversion } from "../lib/workspace.js";
import { requestConversion } from "../lib/conversion-client.js";
import ConversionTools from "./conversion-tools.js";

export default function Home() {
  const [ready, setReady] = useState(false);
  const [amount, setAmount] = useState("100");
  const [from, setFrom] = useState("USD");
  const [to, setTo] = useState("INR");
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("manual");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState([]);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const resultText = result ? formatCurrencyNumber(result.result) : "";

  // Prevent edits before hydration, and treat saved browser data as untrusted input.
  useEffect(() => {
    try { setRecent(parseRecentConversions(localStorage.getItem(HISTORY_KEY))); }
    catch { setStorageUnavailable(true); }
    setReady(true);
  }, []);

  function saveHistory(entries) {
    setRecent(entries);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
      setStorageUnavailable(false);
    } catch { setStorageUnavailable(true); }
  }

  function clearResult() {
    setResult(null);
    setError("");
  }

  async function runConversion(input) {
    if (loading || !ready) return;
    setLoading(true);
    clearResult();
    try {
      const data = await requestConversion(input);
      setAmount(String(data.amount));
      setFrom(data.from);
      setTo(data.to);
      setResult(data);
      saveHistory(rememberConversion(recent, data));
    } catch (failure) {
      setError(failure.message);
    } finally {
      setLoading(false);
    }
  }

  function convert(event) {
    event.preventDefault();
    runConversion(mode === "text" ? { query: query.trim() } : { amount, from, to });
  }

  function reuse(entry) {
    setMode("manual");
    setQuery("");
    setAmount(String(entry.amount));
    setFrom(entry.from);
    setTo(entry.to);
    runConversion(entry);
  }

  return (
    <main className="shell">
      <div className="panel">
        <header className="intro">
          <div className="brand-line"><Coins size={22} aria-hidden="true" /><p className="eyebrow">Daily exchange rates</p></div>
          <h1>AI Currency Converter</h1>
        </header>

        <form className="converter" onSubmit={convert}>
          <fieldset className="controls" disabled={!ready || loading}>
            <div className="modes" role="group" aria-label="Conversion mode">
              <button type="button" aria-pressed={mode === "manual"} onClick={() => { setMode("manual"); clearResult(); }}>Manual</button>
              <button type="button" aria-pressed={mode === "text"} onClick={() => { setMode("text"); clearResult(); }}>Text request</button>
            </div>
            {mode === "text" ? (
              <label className="wide">Ask naturally
                <input value={query} required maxLength={500} onChange={event => { setQuery(event.target.value); clearResult(); }} placeholder="Convert 250 USD to INR" />
              </label>
            ) : (
              <div className="fieldRow">
                <label>Amount
                  <input min="0" max="1000000000000" step="any" required type="number" value={amount} onChange={event => { setAmount(event.target.value); clearResult(); }} />
                </label>
                <label>From
                  <select value={from} onChange={event => { setFrom(event.target.value); clearResult(); }}>
                    {CURRENCIES.map(([code, name]) => <option key={code} value={code}>{code} - {name}</option>)}
                  </select>
                </label>
                <button type="button" className="swap" title="Swap currencies" aria-label="Swap currencies" onClick={() => { setFrom(to); setTo(from); clearResult(); }}>
                  <ArrowLeftRight size={20} aria-hidden="true" />
                </button>
                <label>To
                  <select value={to} onChange={event => { setTo(event.target.value); clearResult(); }}>
                    {CURRENCIES.map(([code, name]) => <option key={code} value={code}>{code} - {name}</option>)}
                  </select>
                </label>
              </div>
            )}
            <button className="primary" disabled={loading}>
              {loading ? "Converting..." : mode === "text" ? "Convert request" : `Convert ${from} to ${to}`}
            </button>
          </fieldset>
        </form>

        {error ? <p className="message error" role="alert" aria-label="Conversion error">{error}</p> : null}

        <div className={result ? "result-layout" : ""}>
          <div role="status" aria-label="Conversion result" aria-live="polite" aria-atomic="true" aria-busy={loading}>
            {result ? (
              <section className="result">
                <p className="label">{formatCurrencyNumber(result.amount)} {result.from} equals</p>
                <strong className={resultText.length > 14 ? "long-result" : undefined}><bdi>{resultText}</bdi>{" "}{result.to}</strong>
                <p>1 {result.from} = {formatCurrencyNumber(result.rate)} {result.to}</p>
                <span>{result.date ? `Rate date: ${result.date} · Source: ${result.source}` : "Same currency · No exchange needed"}</span>
                {result.date ? <p className="rate-note">Reference rate. Bank and transfer fees are not included.</p> : null}
              </section>
            ) : null}
          </div>
          {result ? <ConversionTools key={`${result.amount}-${result.from}-${result.to}`} conversion={result} /> : null}
        </div>

        <section className="recent-section" aria-label="Recent conversions">
          <div className="section-heading">
            <div><History size={20} aria-hidden="true" /><h2>Recent conversions</h2><span className="device-label">On this device</span></div>
            <button type="button" className="icon-button" title="Clear recent conversions" aria-label="Clear recent conversions" disabled={!ready || loading || recent.length === 0} onClick={() => saveHistory([])}><Trash2 size={18} aria-hidden="true" /></button>
          </div>
          {recent.length ? (
            <ul className="history-list">
              {recent.map(entry => (
                <li key={`${entry.amount}-${entry.from}-${entry.to}`}>
                  <button type="button" disabled={!ready || loading} title="Convert again at the latest rate" aria-label={`Reuse ${entry.amount} ${entry.from} to ${entry.to}`} onClick={() => reuse(entry)}>
                    <span><strong>{formatCurrencyNumber(entry.amount)} {entry.from}</strong><span>to {entry.to}</span></span><ArrowUpRight size={18} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="empty-history">No recent conversions yet.</p>}
          {storageUnavailable ? <p className="tool-note" role="status" aria-label="History storage">History is available for this session only.</p> : null}
        </section>
      </div>
    </main>
  );
}
