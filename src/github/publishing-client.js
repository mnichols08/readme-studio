export class PublishingClient {
  // Injection points for tests; defaults use the browser's fetch and online state.
  constructor({
    fetchImpl = (...args) => fetch(...args),
    online = () => navigator.onLine,
  } = {}) {
    this.fetchImpl = fetchImpl;
    this.online = online;
  }
  async request(operation, body) {
    if (!this.online())
      throw new Error(
        "You are offline. Download your README or reconnect to publish.",
      );
    let response;
    try {
      response = await this.fetchImpl(`/api/publishing/${operation}`, {
        method: body ? "POST" : "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: body
          ? {
              "Content-Type": "application/json",
              "X-Studio-CSRF": this.csrf || "",
            }
          : {},
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(25000),
      });
    } catch {
      throw new Error(
        "Publishing service unavailable. Your local draft and download are safe.",
      );
    }
    let value;
    try {
      value = await response.json();
    } catch {
      throw new Error(
        "Publishing is not configured on this static deployment. Use Download README.",
      );
    }
    if (!response.ok)
      throw Object.assign(
        new Error(
          value.error || "Publishing failed. Download remains available.",
        ),
        { status: response.status, remote: value.remote },
      );
    if (value.csrf) this.csrf = value.csrf;
    return value;
  }
}
