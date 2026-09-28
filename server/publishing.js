import { randomBytes } from "node:crypto";
import {
  target,
  writeInput,
  MAX_SOURCE_BYTES,
} from "../src/publishing/validation.js";
const random = () => randomBytes(32).toString("hex");
const fail = (status, message) => Object.assign(new Error(message), { status });
const cookieName = "__Host-readme-studio";
const encodedPath = (path) => path.split("/").map(encodeURIComponent).join("/");
// No persistent credentials, refresh-token storage, arbitrary proxy routes, or logging.
export function createPublishingService({
  origin,
  clientId,
  fetchImpl = fetch,
  now = Date.now,
} = {}) {
  if (
    !origin ||
    new URL(origin).origin !== origin ||
    !origin.startsWith("https://")
  )
    throw new Error("Configure an exact HTTPS PUBLISH_ORIGIN.");
  const sessions = new Map();
  async function remote(url, options = {}) {
    let response;
    try {
      response = await fetchImpl(url, {
        ...options,
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw fail(
        502,
        "GitHub could not be reached. Your local draft is safe. Check connectivity and retry.",
      );
    }
    if (!response.ok) {
      const messages = {
        401: "GitHub authorization expired. Disconnect and reconnect.",
        403: "GitHub denied access: check app permissions, rate limits, or branch protection. Download remains available.",
        404: "GitHub repository, branch, or file was not found.",
        409: "Remote content changed or the branch is unavailable. Reload and review before retrying.",
        422: "GitHub rejected the update. Check branch rules and reload the remote file.",
      };
      throw fail(
        response.status,
        messages[response.status] ||
          "GitHub could not complete this request. No automatic retry was made.",
      );
    }
    try {
      return await response.json();
    } catch {
      throw fail(502, "GitHub returned an unreadable response.");
    }
  }
  const github = (s, path, method = "GET", data) =>
    remote(`https://api.github.com${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${s.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        "User-Agent": "README-Studio",
      },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
  const oauth = (path, data) =>
    remote(`https://github.com/login/${path}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ client_id: clientId, ...data }),
    });
  async function pages(s, path, field) {
    const out = [];
    for (let page = 1; page <= 20; page++) {
      const data = await github(s, `${path}?per_page=100&page=${page}`),
        rows = field ? data[field] : data;
      if (!Array.isArray(rows))
        throw fail(502, "GitHub returned an unreadable repository list.");
      out.push(...rows);
      if (rows.length < 100) return out;
    }
    throw fail(
      413,
      "This account has too many installations or repositories for this picker. Download your README instead.",
    );
  }
  async function repositories(s) {
    const installations = await pages(
        s,
        "/user/installations",
        "installations",
      ),
      rows = new Map();
    for (const installation of installations) {
      const repos = await pages(
        s,
        `/user/installations/${Number(installation.id)}/repositories`,
        "repositories",
      );
      for (const repo of repos)
        rows.set(repo.full_name, {
          repository: repo.full_name,
          branch: repo.default_branch,
          visibility: repo.private ? "private" : "public",
          writable:
            !repo.archived &&
            repo.permissions?.push === true &&
            installation.permissions?.contents === "write",
        });
    }
    s.repositories = [...rows.values()];
    return s.repositories;
  }
  async function authorizeTarget(s, value, write = false) {
    const t = target(value);
    const repos = await repositories(s),
      repo = repos.find((r) => r.repository === t.repository);
    if (!repo || (write && !repo.writable))
      throw fail(
        403,
        "This repository is not writable with your current GitHub App access. Download remains available.",
      );
    return t;
  }
  async function read(s, t) {
    // Verify the branch first: a missing repository/branch must never look like a new README.
    const branch = await github(
      s,
      `/repos/${t.repository}/branches/${encodeURIComponent(t.branch)}`,
    );
    try {
      const file = await github(
        s,
        `/repos/${t.repository}/contents/${encodedPath(t.path)}?ref=${encodeURIComponent(t.branch)}`,
      );
      if (
        file.type !== "file" ||
        file.encoding !== "base64" ||
        file.size > MAX_SOURCE_BYTES ||
        !file.sha
      )
        throw fail(
          413,
          "Remote file is not a supported text file or exceeds 750 KB.",
        );
      return {
        ...t,
        sha: file.sha,
        content: Buffer.from(file.content, "base64").toString("utf8"),
        commitSha: branch.commit.sha,
      };
    } catch (e) {
      if (e.status !== 404) throw e;
      return { ...t, sha: null, content: "", commitSha: branch.commit.sha };
    }
  }
  return async function handle(request) {
    const headers = {
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "Content-Type": "application/json",
    };
    const reply = (value, status = 200) =>
      new Response(JSON.stringify(value), { status, headers });
    try {
      const url = new URL(request.url),
        operation = url.pathname.split("/").at(-1);
      if (url.origin !== origin || url.search)
        throw fail(400, "Invalid publishing request.");
      if (!clientId) return reply({ configured: false, connected: false });
      for (const [key, s] of sessions)
        if (s.expires <= now()) sessions.delete(key);
      const id = request.headers
        .get("cookie")
        ?.split(";")
        .map((v) => v.trim())
        .find((v) => v.startsWith(`${cookieName}=`))
        ?.slice(cookieName.length + 1);
      let s = sessions.get(id);
      if (request.method === "GET" && operation === "session") {
        if (!s) {
          if (sessions.size >= 1000)
            throw fail(503, "Publishing is busy. Please try later.");
          const next = random();
          s = { csrf: random(), expires: now() + 3600000 };
          sessions.set(next, s);
          headers["Set-Cookie"] =
            `${cookieName}=${next}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600`;
        }
        return reply({
          configured: true,
          connected: !!s.token,
          csrf: s.csrf,
          identity: s.identity || null,
        });
      }
      if (
        request.method !== "POST" ||
        request.headers.get("origin") !== origin ||
        !s ||
        request.headers.get("x-studio-csrf") !== s.csrf ||
        !request.headers.get("content-type")?.startsWith("application/json")
      )
        throw fail(
          403,
          "Session or request verification failed. Reopen publishing.",
        );
      const raw = await request.text();
      if (raw.length > MAX_SOURCE_BYTES * 2)
        throw fail(413, "Publishing request is too large.");
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        throw fail(400, "Invalid request data.");
      }
      if (operation === "disconnect") {
        sessions.delete(id);
        headers["Set-Cookie"] =
          `${cookieName}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
        return reply({ connected: false });
      }
      if (s.busy) throw fail(429, "A GitHub request is already in progress.");
      s.busy = true;
      try {
        if (operation === "connect") {
          if (s.token) throw fail(409, "Already connected. Disconnect first.");
          if (s.auth && s.auth.expires > now())
            return reply({
              code: s.auth.code,
              verificationUrl: "https://github.com/login/device",
              interval: s.auth.interval,
            });
          const auth = await oauth("device/code", {});
          if (!auth.device_code || !auth.user_code)
            throw fail(
              503,
              "Enable GitHub App device authorization on the publishing server.",
            );
          s.auth = {
            device: auth.device_code,
            code: auth.user_code,
            expires: now() + Math.min(auth.expires_in || 900, 900) * 1000,
            interval: Math.max(5, auth.interval || 5),
            next: now() + Math.max(5, auth.interval || 5) * 1000,
          };
          return reply({
            code: auth.user_code,
            verificationUrl: "https://github.com/login/device",
            interval: s.auth.interval,
          });
        }
        if (operation === "poll") {
          if (!s.auth || s.auth.expires <= now())
            throw fail(401, "Authorization expired. Connect again.");
          if (now() < s.auth.next) return reply({ pending: true });
          s.auth.next = now() + s.auth.interval * 1000;
          const auth = await oauth("oauth/access_token", {
            device_code: s.auth.device,
            grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          });
          if (auth.error === "slow_down") {
            s.auth.interval += 5;
            s.auth.next = now() + s.auth.interval * 1000;
            return reply({ pending: true });
          }
          if (auth.error === "authorization_pending")
            return reply({ pending: true });
          if (
            !auth.access_token ||
            !Number.isFinite(auth.expires_in) ||
            auth.expires_in <= 0
          ) {
            delete s.auth;
            throw fail(
              401,
              "Authorization declined, expired, or token expiration is disabled. Connect again after checking the GitHub App.",
            );
          }
          s.token = auth.access_token;
          s.expires = Math.min(s.expires, now() + auth.expires_in * 1000);
          delete s.auth;
          try {
            const user = await github(s, "/user");
            s.identity = {
              login: user.login,
              name: user.name || user.login,
              avatar: `https://avatars.githubusercontent.com/u/${Number(user.id)}`,
            };
          } catch (e) {
            delete s.token;
            throw e;
          }
          return reply({ connected: true, identity: s.identity });
        }
        if (!s.token) throw fail(401, "Connect GitHub first.");
        if (operation === "repositories")
          return reply({ repositories: await repositories(s) });
        if (operation === "read")
          return reply(await read(s, await authorizeTarget(s, data)));
        if (operation === "branch") {
          const t = await authorizeTarget(s, data, true);
          const next = target({ ...t, branch: data.newBranch });
          if (
            data.confirmed !== true ||
            next.branch === t.branch ||
            !/^[a-f0-9]{40,64}$/.test(data.commitSha || "")
          )
            throw fail(
              400,
              "Review the source branch SHA and confirm creation of a different branch.",
            );
          const current = await github(
            s,
            `/repos/${t.repository}/branches/${encodeURIComponent(t.branch)}`,
          );
          if (current.commit.sha !== data.commitSha)
            throw fail(
              409,
              "Source branch changed. Reload it before creating a branch.",
            );
          await github(s, `/repos/${t.repository}/git/refs`, "POST", {
            ref: `refs/heads/${next.branch}`,
            sha: data.commitSha,
          });
          return reply(next);
        }
        if (operation === "commit") {
          let input;
          try {
            input = writeInput(data);
          } catch (e) {
            throw fail(400, e.message);
          }
          const t = await authorizeTarget(s, input, true);
          const current = await read(s, t);
          if (current.sha !== input.sha)
            throw Object.assign(
              fail(
                409,
                "Remote README changed since you loaded it. Review the latest version.",
              ),
              { remote: current },
            );
          const result = await github(
            s,
            `/repos/${t.repository}/contents/${encodedPath(t.path)}`,
            "PUT",
            {
              message: input.message,
              content: Buffer.from(input.content, "utf8").toString("base64"),
              branch: t.branch,
              ...(input.sha ? { sha: input.sha } : {}),
            },
          );
          return reply({
            commitSha: result.commit.sha,
            sha: result.content.sha,
            previousCommitSha: current.commitSha,
            ...t,
          });
        }
        throw fail(404, "Unknown publishing operation.");
      } finally {
        s.busy = false;
      }
    } catch (e) {
      return reply(
        {
          error: e.status
            ? e.message
            : "Publishing could not complete. Your local draft is safe.",
          ...(e.remote ? { remote: e.remote } : {}),
        },
        Number.isInteger(e.status) && e.status >= 400 && e.status < 600
          ? e.status
          : 500,
      );
    }
  };
}
