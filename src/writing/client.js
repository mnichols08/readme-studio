import { writingMessages, OUTPUT_LIMIT } from "./model.js";

export function connection(config) {
  let url;
  try {
    url = new URL(config.endpoint);
  } catch {
    throw Error("Enter the full chat/completions endpoint URL.");
  }
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      ))
  )
    throw Error(
      "Use HTTPS, or HTTP on localhost, without URL credentials, query or fragment.",
    );
  if (!url.pathname.endsWith("/chat/completions"))
    throw Error("Use an endpoint ending in /chat/completions.");
  if (
    typeof config.model !== "string" ||
    !config.model.trim() ||
    config.model.length > 200 ||
    /[\x00-\x1f]/.test(config.model)
  )
    throw Error("Enter a valid model identifier from your provider.");
  const key = config.key || "";
  if (
    typeof key !== "string" ||
    key.length > 4096 ||
    /[\x00-\x20\x7f]/.test(key)
  )
    throw Error("The API key contains invalid characters.");
  return { endpoint: url.href, model: config.model.trim(), key };
}

async function boundedJson(response) {
  const limit = 512_000;
  if (Number(response.headers.get("content-length")) > limit) {
    await response.body?.cancel();
    throw Error("Provider response is too large.");
  }
  const reader = response.body?.getReader();
  if (!reader) throw Error("Provider returned no readable response.");
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) throw Error("Provider response is too large.");
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let at = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, at);
      at += chunk.byteLength;
    }
    try {
      return JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      );
    } catch {
      throw Error("Provider returned invalid JSON.");
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function generateWriting(
  config,
  input,
  { signal, fetcher = fetch, timeout = 60_000 } = {},
) {
  const settings = connection(config);
  const messages = writingMessages(
    input.action,
    input.original,
    input.notes,
    input.context,
  );
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    abort();
  }, timeout);
  try {
    const response = await fetcher(settings.endpoint, {
      method: "POST",
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(settings.key ? { Authorization: `Bearer ${settings.key}` } : {}),
      },
      body: JSON.stringify({
        model: settings.model,
        messages,
        stream: false,
        store: false,
        max_completion_tokens: 8192,
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw Error(
        {
          401: "Authentication failed. Check your provider key.",
          403: "The provider denied access to this model or endpoint.",
          429: "Provider rate or usage limit reached. Retry later.",
          404: "Endpoint or model not found. Check the provider configuration.",
        }[response.status] ||
          `Provider request failed (HTTP ${response.status}). Try again later.`,
      );
    }
    const data = await boundedJson(response);
    const choice = data?.choices?.[0],
      message = choice?.message;
    if (
      message?.refusal ||
      message?.tool_calls?.length ||
      choice?.finish_reason !== "stop"
    )
      throw Error(
        "Provider did not return a complete text proposal. Try a smaller selection or another model.",
      );
    if (
      typeof message?.content !== "string" ||
      !message.content.trim() ||
      message.content.length > OUTPUT_LIMIT
    )
      throw Error("Provider returned empty or oversized Markdown.");
    if (controller.signal.aborted) throw Error("Cancelled.");
    return message.content;
  } catch (error) {
    if (controller.signal.aborted)
      throw Error(
        timedOut
          ? "Writing request timed out. Your draft is unchanged."
          : "Writing request cancelled. Your draft is unchanged.",
      );
    if (error instanceof TypeError)
      throw Error(
        "Could not reach the provider. Check network access and its browser CORS settings.",
      );
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
