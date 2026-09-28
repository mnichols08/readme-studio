// @vitest-environment node
import { it, expect, vi } from "vitest";
import { createPublishingService } from "../server/publishing.js";
const origin = "https://studio.example",
  sha = "a".repeat(40),
  newSha = "b".repeat(40);
function harness({
  permission = true,
  exists = true,
  commitStatus = 200,
} = {}) {
  let clock = 1000,
    cookie,
    csrf;
  const upstream = vi.fn(async (url, options) => {
    if (url.endsWith("/device/code"))
      return Response.json({
        device_code: "PRIVATE_DEVICE",
        user_code: "ABCD-EFGH",
        expires_in: 900,
        interval: 5,
      });
    if (url.endsWith("/oauth/access_token"))
      return Response.json({
        access_token: "PRIVATE_ACCESS",
        refresh_token: "PRIVATE_REFRESH",
        expires_in: 28800,
      });
    if (url.endsWith("/user"))
      return Response.json({ login: "octocat", name: "Octo", id: 1 });
    if (url.includes("/user/installations?"))
      return Response.json({
        installations: [
          { id: 1, permissions: { contents: permission ? "write" : "read" } },
        ],
      });
    if (url.includes("/user/installations/1/repositories?"))
      return Response.json({
        repositories: [
          {
            full_name: "octocat/octocat",
            default_branch: "main",
            permissions: { push: true },
          },
        ],
      });
    if (url.includes("/branches/")) return Response.json({ commit: { sha } });
    if (url.endsWith("/git/refs"))
      return Response.json({ ref: "refs/heads/readme-studio/update" });
    if (options.method === "PUT")
      return Response.json(
        commitStatus === 200
          ? { commit: { sha: newSha }, content: { sha: newSha } }
          : { message: "PRIVATE_ACCESS" },
        { status: commitStatus },
      );
    if (url.includes("/contents/"))
      return Response.json(
        exists
          ? {
              type: "file",
              encoding: "base64",
              size: 6,
              sha,
              content: Buffer.from("# Old").toString("base64"),
            }
          : {},
        { status: exists ? 200 : 404 },
      );
    throw new Error("Unexpected mock route");
  });
  const service = createPublishingService({
    origin,
    clientId: "APP_ID",
    fetchImpl: upstream,
    now: () => clock,
  });
  async function request(op, body, headers = {}) {
    const response = await service(
      new Request(`${origin}/api/publishing/${op}`, {
        method: body ? "POST" : "GET",
        headers: {
          cookie: cookie || "",
          origin,
          "content-type": "application/json",
          "x-studio-csrf": csrf || "",
          ...headers,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
    );
    if (response.headers.get("set-cookie"))
      cookie = response.headers.get("set-cookie").split(";")[0];
    const value = await response.json();
    if (value.csrf) csrf = value.csrf;
    return { response, value };
  }
  async function connect() {
    await request("session");
    await request("connect", {});
    clock += 6000;
    return request("poll", {});
  }
  return { request, connect, upstream };
}
it("isolates tokens in server memory and disconnects the session", async () => {
  const h = harness();
  const session = await h.request("session");
  expect(session.response.headers.get("set-cookie")).toMatch(
    /HttpOnly; Secure; SameSite=Lax/,
  );
  const connected = await h.connect();
  expect(connected.value.identity.login).toBe("octocat");
  expect(JSON.stringify(connected.value)).not.toMatch(/PRIVATE_/);
  expect(
    (await h.request("repositories", {})).value.repositories[0].writable,
  ).toBe(true);
  await h.request("disconnect", {});
  expect((await h.request("repositories", {})).response.status).toBe(403);
});
it("rejects cross-origin, CSRF, arbitrary proxy and unconfirmed writes", async () => {
  const h = harness();
  await h.connect();
  expect(
    (await h.request("commit", {}, { origin: "https://evil.example" })).response
      .status,
  ).toBe(403);
  expect(
    (await h.request("commit", {}, { "x-studio-csrf": "wrong" })).response
      .status,
  ).toBe(403);
  expect((await h.request("delete", {})).response.status).toBe(404);
  expect(
    (
      await h.request("commit", {
        repository: "octocat/octocat",
        branch: "main",
        path: "README.md",
        sha: null,
        content: "# New",
        message: "update",
      })
    ).response.status,
  ).toBe(400);
  expect(h.upstream.mock.calls.some(([, o]) => o.method === "PUT")).toBe(false);
});
it.each([true, false])(
  "loads and commits an existing=%s README without changing UTF-8 source",
  async (exists) => {
    const h = harness({ exists });
    await h.connect();
    const t = {
      repository: "octocat/octocat",
      branch: "main",
      path: "README.md",
    };
    const baseline = (await h.request("read", t)).value;
    expect(baseline.sha).toBe(exists ? sha : null);
    const result = await h.request("commit", {
      ...t,
      sha: baseline.sha,
      content: "# 🦀\r\n",
      message: "My commit",
      confirmed: true,
    });
    expect(result.value.commitSha).toBe(newSha);
    const body = JSON.parse(
      h.upstream.mock.calls.find(([, o]) => o.method === "PUT")[1].body,
    );
    expect(Buffer.from(body.content, "base64").toString("utf8")).toBe(
      "# 🦀\r\n",
    );
    expect(body.sha).toBe(exists ? sha : undefined);
  },
);
it("rejects read-only repositories and redacts GitHub error bodies", async () => {
  const t = {
    repository: "octocat/octocat",
    branch: "main",
    path: "README.md",
    sha,
    content: "New",
    message: "update",
    confirmed: true,
  };
  const h = harness({ permission: false });
  await h.connect();
  expect((await h.request("commit", t)).response.status).toBe(403);
  expect(h.upstream.mock.calls.some(([, o]) => o.method === "PUT")).toBe(false);
  const denied = harness({ commitStatus: 403 });
  await denied.connect();
  const result = await denied.request("commit", t);
  expect(result.value.error).toContain("branch protection");
  expect(JSON.stringify(result.value)).not.toContain("PRIVATE");
});
it("leaves static deployments unconfigured and uses HTTPS only", async () => {
  expect(() =>
    createPublishingService({ origin: "http://example.com" }),
  ).toThrow("HTTPS");
  const service = createPublishingService({ origin });
  expect(
    await (
      await service(new Request(origin + "/api/publishing/session"))
    ).json(),
  ).toEqual({ configured: false, connected: false });
});
it("stops stale writes on the server before PUT and returns a reviewable remote baseline", async () => {
  const h = harness();
  await h.connect();
  const result = await h.request("commit", {
    repository: "octocat/octocat",
    branch: "main",
    path: "README.md",
    sha: newSha,
    content: "New",
    message: "update",
    confirmed: true,
  });
  expect(result.response.status).toBe(409);
  expect(result.value.remote.content).toBe("# Old");
  expect(h.upstream.mock.calls.some(([, o]) => o.method === "PUT")).toBe(false);
});
it("creates only explicitly confirmed branches at an unchanged source commit", async () => {
  const h = harness();
  await h.connect();
  const input = {
    repository: "octocat/octocat",
    branch: "main",
    path: "README.md",
    commitSha: sha,
    newBranch: "readme-studio/update",
  };
  expect((await h.request("branch", input)).response.status).toBe(400);
  expect(
    (
      await h.request("branch", {
        ...input,
        confirmed: true,
        commitSha: newSha,
      })
    ).response.status,
  ).toBe(409);
  expect(
    (await h.request("branch", { ...input, confirmed: true })).value.branch,
  ).toBe("readme-studio/update");
  const write = h.upstream.mock.calls.filter(([url]) =>
    url.endsWith("/git/refs"),
  );
  expect(write).toHaveLength(1);
  expect(JSON.parse(write[0][1].body)).toEqual({
    ref: "refs/heads/readme-studio/update",
    sha,
  });
});
it("redacts network failures and does not retry a write", async () => {
  const h = harness();
  await h.connect();
  h.upstream.mockRejectedValueOnce(new Error("PRIVATE_ACCESS network error"));
  const result = await h.request("repositories", {});
  expect(result.response.status).toBe(502);
  expect(result.value.error).toContain("local draft is safe");
  expect(JSON.stringify(result.value)).not.toContain("PRIVATE_ACCESS");
  expect(h.upstream.mock.calls.some(([, o]) => o.method === "PUT")).toBe(false);
});
