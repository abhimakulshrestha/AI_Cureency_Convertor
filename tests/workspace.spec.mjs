import { test, expect } from "@playwright/test";

const rates = { USD: 1, INR: 95, EUR: 0.9, GBP: 0.75, JPY: 150, AED: 3.67 };
async function mockRates(page, handler) {
  await page.route("**/api/convert", async route => {
    const input = route.request().postDataJSON();
    if (handler && await handler(route, input)) return;
    const rate = rates[input.to] / rates[input.from];
    await route.fulfill({ json: { ...input, amount: Number(input.amount), rate, result: Number(input.amount) * rate, date: "2026-10-15", source: "Test fixture" } });
  });
}

async function convert(page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Convert USD to INR", exact: true }).click();
  await expect(page.getByRole("status", { name: "Conversion result" })).toContainText("9,500 INR");
}

test("travel budget recalculates, rejects invalid days, and survives switching tools", async ({ page }, testInfo) => {
  await mockRates(page);
  await convert(page);
  await page.getByLabel("Trip length (days)").fill("5");
  const fee = page.getByRole("slider", { name: "Estimated exchange fee" });
  await fee.focus();
  await fee.press("Home");
  for (let i = 0; i < 20; i++) await fee.press("ArrowRight");
  await expect(fee).toHaveValue("2");
  await expect(page.getByTestId("fee-cost")).toHaveText("2 USD");
  await expect(page.getByTestId("net-budget")).toHaveText("9,310 INR");
  await expect(page.getByTestId("daily-allowance")).toHaveText("1,862 INR");
  await page.getByRole("button", { name: "Compare currencies", exact: true }).click();
  await expect(page.getByRole("region", { name: "Currency comparison" })).toBeVisible();
  await page.getByRole("button", { name: "Travel budget", exact: true }).click();
  await expect(page.getByLabel("Trip length (days)")).toHaveValue("5");
  await expect(fee).toHaveValue("2");
  await page.screenshot({ path: testInfo.outputPath("travel-budget.png"), fullPage: true });
  await page.getByLabel("Trip length (days)").fill("0");
  await expect(page.getByRole("alert", { name: "Budget error" })).toContainText("whole number");
  await expect(page.getByTestId("daily-allowance")).toHaveCount(0);
  await page.getByLabel("Trip length (days)").fill("1");
  await expect(page.getByTestId("daily-allowance")).toHaveText("9,310 INR");
});

test("comparison isolates provider failures, retries, and changes currency", async ({ page }, testInfo) => {
  let failGBP = true;
  await mockRates(page, async (route, input) => {
    if (input.to !== "GBP" || !failGBP) return false;
    await route.fulfill({ status: 502, json: { error: "Provider unavailable" } });
    return true;
  });
  await convert(page);
  await page.getByRole("button", { name: "Compare currencies", exact: true }).click();
  await expect(page.getByRole("status", { name: "Comparison 1", exact: true })).toContainText("9,500 INR");
  await expect(page.getByRole("status", { name: "Comparison 2", exact: true })).toContainText("90 EUR");
  await expect(page.getByRole("status", { name: "Comparison 3", exact: true })).toContainText("Rate unavailable");
  await expect(page.getByRole("status", { name: "Comparison 4", exact: true })).toContainText("15,000 JPY");
  failGBP = false;
  await page.getByRole("button", { name: "Retry GBP rate" }).click();
  await expect(page.getByRole("status", { name: "Comparison 3", exact: true })).toContainText("75 GBP");
  await page.getByRole("combobox", { name: "Compare currency 2", exact: true }).selectOption("AED");
  await expect(page.getByRole("status", { name: "Comparison 2", exact: true })).toContainText("367 AED");
  await page.screenshot({ path: testInfo.outputPath("comparison.png"), fullPage: true });
  await page.getByRole("button", { name: "Travel budget", exact: true }).click();
  await page.getByRole("button", { name: "Compare currencies", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Compare currency 2", exact: true })).toHaveValue("AED");
});

test("recent conversions persist, deduplicate, fetch fresh rates, and clear", async ({ page }) => {
  let rate = 95;
  let requests = 0;
  await mockRates(page, async (route, input) => {
    requests++;
    await route.fulfill({ json: { ...input, amount: Number(input.amount), rate, result: Number(input.amount) * rate, date: "2026-10-15", source: "Test fixture" } });
    return true;
  });
  await convert(page);
  const history = page.getByRole("region", { name: "Recent conversions" });
  await expect(history.getByRole("button", { name: "Reuse 100 USD to INR" })).toBeVisible();
  await page.reload();
  await expect(history.getByRole("button", { name: "Reuse 100 USD to INR" })).toBeVisible();
  rate = 96;
  await history.getByRole("button", { name: "Reuse 100 USD to INR" }).click();
  await expect(page.getByRole("status", { name: "Conversion result" })).toContainText("9,600 INR");
  expect(requests).toBe(2);
  await expect(history.getByRole("listitem")).toHaveCount(1);
  await history.getByRole("button", { name: "Clear recent conversions" }).click();
  await expect(history.getByRole("listitem")).toHaveCount(0);
  await page.reload();
  await expect(history).toContainText("No recent conversions yet");
});

test("corrupt and blocked browser storage do not prevent conversions", async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem("currency-converter.recent.v1", "{broken"); });
  await mockRates(page);
  await convert(page);
  await expect(page.getByRole("button", { name: "Reuse 100 USD to INR" })).toBeVisible();
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException("Blocked", "SecurityError"); }; });
  await page.getByLabel("Amount", { exact: true }).fill("200");
  await page.getByRole("button", { name: "Convert USD to INR", exact: true }).click();
  await expect(page.getByRole("status", { name: "Conversion result" })).toContainText("19,000 INR");
  await expect(page.getByRole("status", { name: "History storage" })).toContainText("session only");
});

test("new tools fit a 320-pixel screen with a large budget", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await mockRates(page);
  await page.goto("/");
  await page.getByLabel("Amount", { exact: true }).fill("1000000000000");
  await page.getByRole("button", { name: "Convert USD to INR", exact: true }).click();
  await expect(page.getByTestId("net-budget")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Compare currencies", exact: true }).click();
  await expect(page.getByRole("status", { name: "Comparison 2", exact: true })).toContainText("EUR");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
