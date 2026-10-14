"use client";

import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, Coins, Globe2, LoaderCircle, RotateCcw } from "lucide-react";
import { CURRENCIES, formatCurrencyNumber } from "../lib/currency.js";
import { calculateTravelBudget } from "../lib/workspace.js";
import { requestConversion } from "../lib/conversion-client.js";

function TravelBudget({ conversion }) {
  const [days, setDays] = useState("7");
  const [fee, setFee] = useState("0");
  let budget;
  let error;
  try { budget = calculateTravelBudget(conversion.amount, conversion.rate, days, fee); }
  catch (failure) { error = failure.message; }

  return (
    <section className="travel-tool" aria-label="Travel budget planner">
      <div className="tool-heading">
        <div><p className="section-kicker">YOUR TRIP, IN {conversion.to}</p><h2>Daily spending plan</h2></div>
        <CalendarDays size={26} aria-hidden="true" />
      </div>
      <div className="planner-inputs">
        <label>Trip length (days)<input type="number" min="1" max="365" step="1" required value={days} onChange={event => setDays(event.target.value)} /></label>
        <label>Estimated exchange fee <span className="fee-value">{fee}%</span>
          <input type="range" min="0" max="20" step="0.1" value={fee} aria-label="Estimated exchange fee" aria-valuetext={`${fee} percent`} onChange={event => setFee(event.target.value)} />
        </label>
      </div>
      {error ? <p role="alert" aria-label="Budget error" className="error">{error}</p> : (
        <>
          <dl className="budget-metrics" aria-live="polite">
            <div className="daily-budget"><dt>Daily allowance</dt><dd data-testid="daily-allowance"><bdi>{formatCurrencyNumber(budget.daily)}</bdi> <small>{conversion.to}</small></dd></div>
            <div><dt>Net trip budget</dt><dd data-testid="net-budget"><bdi>{formatCurrencyNumber(budget.available)}</bdi> {conversion.to}</dd></div>
            <div><dt>Estimated fee</dt><dd data-testid="fee-cost"><bdi>{formatCurrencyNumber(budget.feeInSource)}</bdi> {conversion.from}</dd></div>
          </dl>
          <div className="budget-bar" role="img" aria-label={`${100 - Number(fee)} percent of budget retained, ${fee} percent fee`}>
            <span style={{ width: `${100 - Number(fee)}%` }} /><span style={{ width: `${fee}%` }} />
          </div>
          <p className="tool-note">Fee deducted from {formatCurrencyNumber(conversion.amount)} {conversion.from} before conversion. Reference-rate estimate.</p>
        </>
      )}
    </section>
  );
}

function ComparisonRow({ conversion, currency, index, onChange }) {
  const [entry, setEntry] = useState(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setEntry(null);
    setError("");
    if (currency === conversion.to) {
      setEntry(conversion);
    } else {
      requestConversion({ amount: conversion.amount, from: conversion.from, to: currency }, controller.signal)
        .then(data => { if (!controller.signal.aborted) setEntry(data); })
        .catch(failure => { if (!controller.signal.aborted) setError(failure.message); });
    }
    return () => controller.abort();
  }, [conversion, currency, retry]);
  const current = entry?.to === currency ? entry : null;
  return (
    <li className="comparison-row">
      <label className="comparison-currency">
        <span className="sr-only">Compare currency {index + 1}</span>
        <select value={currency} onChange={event => onChange(event.target.value)}>
          {CURRENCIES.map(([code, name]) => <option key={code} value={code}>{code} - {name}</option>)}
        </select>
      </label>
      <div className="comparison-value" role="status" aria-label={`Comparison ${index + 1}`}>
        {error ? <span className="error">Rate unavailable</span> : current ? (
          <><strong>{formatCurrencyNumber(current.result)} <small>{currency}</small></strong><span>{current.date || "Same currency"}</span></>
        ) : <span className="loading-rate"><LoaderCircle size={16} className="spin" aria-hidden="true" /> Loading rate</span>}
      </div>
      {error ? <button type="button" className="icon-button" title={`Retry ${currency} rate`} aria-label={`Retry ${currency} rate`} onClick={() => setRetry(value => value + 1)}><RotateCcw size={18} aria-hidden="true" /></button> : <ArrowRight size={16} className="comparison-arrow" aria-hidden="true" />}
    </li>
  );
}

function CurrencyComparison({ conversion }) {
  const [currencies, setCurrencies] = useState(() => [...new Set([conversion.to, "EUR", "GBP", "JPY", "AED"])].slice(0, 4));
  return (
    <section aria-label="Currency comparison">
      <div className="tool-heading"><div><p className="section-kicker">ONE AMOUNT, FOUR CURRENCIES</p><h2>{formatCurrencyNumber(conversion.amount)} {conversion.from}</h2></div><Globe2 size={26} aria-hidden="true" /></div>
      <ul className="comparison-list">
        {currencies.map((currency, index) => <ComparisonRow key={index} conversion={conversion} currency={currency} index={index} onChange={next => setCurrencies(values => values.map((value, i) => i === index ? next : value))} />)}
      </ul>
      <p className="tool-note">Daily reference rates from Frankfurter. Fees excluded.</p>
    </section>
  );
}

export default function ConversionTools({ conversion }) {
  const [tool, setTool] = useState("travel");
  const [compared, setCompared] = useState(false);
  return (
    <section className="result-tools" aria-label="Conversion tools">
      <div className="tool-switch" role="group" aria-label="Conversion tools view">
        <button type="button" aria-pressed={tool === "travel"} onClick={() => setTool("travel")}><Coins size={18} aria-hidden="true" />Travel budget</button>
        <button type="button" aria-pressed={tool === "compare"} onClick={() => { setCompared(true); setTool("compare"); }}><Globe2 size={18} aria-hidden="true" />Compare currencies</button>
      </div>
      <div hidden={tool !== "travel"}><TravelBudget conversion={conversion} /></div>
      <div hidden={tool !== "compare"}>{compared ? <CurrencyComparison conversion={conversion} /> : null}</div>
    </section>
  );
}
