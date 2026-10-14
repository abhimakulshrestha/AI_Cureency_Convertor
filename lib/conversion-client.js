export async function requestConversion(input, signal) {
  let response;
  let data;
  try {
    response = await fetch("/api/convert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(35000)]) : AbortSignal.timeout(35000)
    });
    data = await response.json();
  } catch {
    throw new Error("Could not reach the converter. Check your connection and try again.");
  }
  if (!response.ok) throw new Error(data.error || "Could not convert that amount.");
  if (!data || typeof data.result !== "number" || !Number.isFinite(data.result) || typeof data.rate !== "number" || !Number.isFinite(data.rate) || data.rate <= 0) {
    throw new Error("The converter returned an invalid result. Please try again.");
  }
  return data;
}
