import { test, expect } from "@playwright/test";

test("live manual conversion, swap, zero, and same currency", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "AI Currency Converter" })).toBeVisible();
  await page.getByRole("button", { name: "Convert USD to INR", exact: true }).click();
  await expect(page.getByRole("status", { name: "Conversion result" })).toContainText("Rate date:");
  await expect(page.locator(".result strong")).toContainText("INR");
  await page.getByRole("button", { name: "Swap currencies" }).click();
  await expect(page.locator(".result")).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "From", exact: true })).toHaveValue("INR");
  await page.getByRole("button", { name: "Convert INR to USD", exact: true }).click();
  await expect(page.locator(".result strong")).toContainText("USD");
  await page.getByLabel("Amount", { exact: true }).fill("0");
  await page.getByRole("combobox", { name: "To", exact: true }).selectOption("INR");
  await page.getByRole("button", { name: "Convert INR to INR", exact: true }).click();
  await expect(page.locator(".result strong")).toHaveText("0 INR");
  await expect(page.getByRole("status", { name: "Conversion result" })).toContainText("No exchange needed");
  expect(errors).toEqual([]);
});

test("text conversion does not override subsequent manual edits", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Text request", exact: true }).click();
  await page.getByLabel("Ask naturally").fill("Can you convert 1,000.25 USD to INR?");
  await page.getByRole("button", { name: "Convert request", exact: true }).click();
  await expect(page.getByRole("status", { name: "Conversion result" })).toContainText("1,000.25 USD equals");
  await page.getByRole("button", { name: "Manual", exact: true }).click();
  await page.getByLabel("Amount", { exact: true }).fill("12.345");
  await page.getByRole("combobox", { name: "To", exact: true }).selectOption("USD");
  await page.getByRole("button", { name: "Convert USD to USD", exact: true }).click();
  await expect(page.locator(".result strong")).toHaveText("12.345 USD");
});

test("network and non-JSON failures recover, and retry succeeds", async ({ page }) => {
  await page.goto("/");
  await page.route("**/api/convert", route => route.abort());
  const submit = page.getByRole("button", { name: "Convert USD to INR", exact: true });
  await submit.click();
  await expect(page.getByRole("alert", { name: "Conversion error" })).toContainText("Check your connection");
  await expect(submit).toBeEnabled();
  await page.unroute("**/api/convert");
  await page.route("**/api/convert", route => route.fulfill({ status: 502, contentType: "text/html", body: "Unavailable" }));
  await submit.click();
  await expect(page.getByRole("alert", { name: "Conversion error" })).toBeVisible();
  await expect(submit).toBeEnabled();
  await page.unroute("**/api/convert");
  await submit.click();
  await expect(page.getByRole("status", { name: "Conversion result" })).toContainText("Rate date:");
  await expect(page.getByRole("alert", { name: "Conversion error" })).toHaveCount(0);
});

test("validation and accessible server errors", async ({ page }) => {
  await page.goto("/");
  const amount = page.getByLabel("Amount", { exact: true });
  await amount.fill("-10");
  await page.getByRole("button", { name: "Convert USD to INR", exact: true }).click();
  expect(await amount.evaluate(input => input.validity.rangeUnderflow)).toBe(true);
  await amount.fill("");
  expect(await amount.evaluate(input => input.validity.valueMissing)).toBe(true);
  await amount.fill("100");
  await page.route("**/api/convert", route => route.fulfill({ status: 502, json: { error: "Exchange rates are unavailable right now. Please try again." } }));
  await page.getByRole("button", { name: "Convert USD to INR", exact: true }).click();
  await expect(page.getByRole("alert", { name: "Conversion error" })).toContainText("Exchange rates are unavailable");
  await expect(amount).toBeEnabled();
});

test("layout fits viewport with a large result", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByLabel("Amount", { exact: true }).fill("1000000000000");
  await page.getByRole("combobox", { name: "To", exact: true }).selectOption("USD");
  await page.getByRole("button", { name: "Convert USD to USD", exact: true }).click();
  await expect(page.locator(".result strong")).toHaveText("1,000,000,000,000 USD");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("converter.png"), fullPage: true });
});

test("live AED, SAR, and Gemini integration", async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "One live provider integration check is sufficient.");
  for (const to of ["AED", "SAR"]) {
    const response = await request.post("/api/convert", { data: { amount: 100, from: "USD", to } });
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.result).toBeGreaterThan(0);
    expect(data.to).toBe(to);
  }
  const response = await request.post("/api/convert", { data: { query: "How much are twenty-five US dollars worth in Indian rupees?" } });
  const data = await response.json();
  expect(response.status(), JSON.stringify(data)).toBe(200);
  expect(data.parser).toBe("gemini");
  expect(data.amount).toBe(25);
  expect(data.from).toBe("USD");
  expect(data.to).toBe("INR");
  expect(data.result).toBeGreaterThan(0);
});

test("keyboard-only text conversion", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Manual", exact: true })).toBeEnabled();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Manual", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Text request", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Ask naturally")).toBeFocused();
  await page.keyboard.type("42.5 USD to USD");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status", { name: "Conversion result" })).toContainText("42.5 USD equals");
  await expect(page.locator(".result strong")).toHaveText("42.5 USD");
});

test("pending requests lock controls until completion", async ({ page }) => {
  let pendingRoute;
  let onRequest;
  const requested = new Promise(resolve => { onRequest = resolve; });
  await page.route("**/api/convert", route => { pendingRoute = route; onRequest(); });
  await page.goto("/");
  await page.getByRole("button", { name: "Convert USD to INR", exact: true }).click();
  await requested;
  await expect(page.getByLabel("Amount", { exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Swap currencies" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Text request", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Converting...", exact: true })).toBeDisabled();
  await pendingRoute.fulfill({ json: { amount: 100, from: "USD", to: "INR", rate: 95, result: 9500, date: "2026-10-14", source: "Test fixture" } });
  await expect(page.locator(".result strong")).toHaveText("9,500 INR");
  await expect(page.getByLabel("Amount", { exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Convert USD to INR", exact: true })).toBeEnabled();
});

test("320-pixel screen keeps large results and controls inside the page", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/");
  await page.getByLabel("Amount", { exact: true }).fill("1000000000000");
  await page.getByRole("combobox", { name: "To", exact: true }).selectOption("USD");
  await page.getByRole("button", { name: "Convert USD to USD", exact: true }).click();
  await expect(page.locator(".result strong")).toHaveText("1,000,000,000,000 USD");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const control of await page.locator("input, select, button, .result strong, .result bdi").all()) {
    const box = await control.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(320);
  }
  await page.screenshot({ path: testInfo.outputPath("narrow-screen.png"), fullPage: true });
  await page.getByLabel("Amount", { exact: true }).fill("1e-100");
  await page.getByRole("button", { name: "Convert USD to USD", exact: true }).click();
  await expect(page.locator(".result strong")).toHaveText("1E-100 USD");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("controls wait for hydration and preserve the first edit", async ({ page }) => {
  let releaseScripts;
  const scriptsReady = new Promise(resolve => { releaseScripts = resolve; });
  await page.route("**/_next/**/*.js", async route => { await scriptsReady; await route.continue(); });
  await page.goto("/", { waitUntil: "commit" });
  const amount = page.getByLabel("Amount", { exact: true });
  await expect(amount).toBeVisible();
  await expect(amount).toBeDisabled();
  releaseScripts();
  await expect(amount).toBeEnabled();
  await amount.fill("123.45");
  await page.getByRole("combobox", { name: "To", exact: true }).selectOption("USD");
  await page.getByRole("button", { name: "Convert USD to USD", exact: true }).click();
  await expect(page.locator(".result strong")).toHaveText("123.45 USD");
});
