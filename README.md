# AI Currency Converter

A Next.js frontend and server API for 30 currencies, with daily reference rates, optional Gemini text parsing, a travel budget planner, currency comparisons, and local conversion history.

## Currency workspace

- **Travel budget:** after a conversion, choose 1 to 365 days and an estimated percentage exchange fee. The planner deducts the fee from the source amount before conversion, then divides the net budget into a daily allowance. The fee is your estimate, not a quoted provider charge.
- **Compare currencies:** view the same source amount in four selectable currencies. Rates load independently; failed rows can be retried. Changes to the main conversion discard the previous comparison so old and new amounts cannot mix.
- **Recent conversions:** the latest six distinct amount/currency combinations are saved in this browser's local storage. Reusing one requests a fresh rate. Clear history with the trash button. Text prompts and rate results are not stored; if storage is blocked, history remains available for the current session.

Planner settings and comparison selections persist while switching between tools for the current conversion. These tools appear after a successful conversion.

## Run locally

Use Node.js 20.9 or newer (tested on Node.js 24).

```powershell
npm ci
npm run dev -- --hostname 127.0.0.1 --port 3001
```

Open http://127.0.0.1:3001. If that port is occupied, choose another port.

The root `.env` is loaded by Next.js. Set `GEMINI_API_KEY` there and use `GEMINI_MODEL=gemini-3.5-flash-lite`. Restart the server after editing environment variables. `.env.example` is the shareable blank template; `.env` and local overrides are ignored by Git. Never prefix the key with `NEXT_PUBLIC_`.

Manual conversions and explicit requests such as `100 USD to INR` work without Gemini. Other wording requires a working Gemini key and available quota. The text is sent to Google for extraction; exchange rates always come from Frankfurter. Failed AI requests show an error and leave manual conversion available.

## Verification

```powershell
npm run check
npm run build
npx playwright install chromium firefox webkit
npm run test:e2e
```

The browser suite starts the production app on port 3107 and stops it afterward. It covers Chromium desktop/mobile, Firefox, and WebKit: live conversions, text/manual switching, validation, failures, retries, keyboard access, pending requests, 320-pixel layouts, and the configured Gemini integration. WebKit tests the Safari browser engine, not a physical Apple device. Internet access and a valid Gemini key with quota are required for the live integration test. Unit/API tests mock external services, including service failures, and need no key.

For production locally: `npm run build`, then `npm run start -- --hostname 127.0.0.1 --port 3001`.

## Rates and limits

Rates use [Frankfurter v2](https://frankfurter.dev/), with the provider's actual rate date displayed. These are daily reference rates, not executable bank quotes; fees are excluded. Same-currency conversion needs no external service. Amounts must be numeric, nonnegative, and at most 1 trillion. Calculations use JavaScript numbers and display up to 12 significant digits, using scientific notation when a number would otherwise be too long to read. This is an estimate tool, not an accounting ledger.

The app is configured for local use. Before exposing the Gemini-backed endpoint publicly, add authentication or a hosting-level rate limit and configure Google API quotas to control usage.
