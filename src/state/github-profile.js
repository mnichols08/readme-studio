const count = (value) =>
  Number.isSafeInteger(value) && value >= 0 ? value : null;
const string = (value) => (typeof value === "string" ? value.trim() : "");
export function githubUsername(input) {
  let username = String(input).trim().replace(/^@/, "");
  if (/^https?:\/\//i.test(username)) {
    const url = new URL(username);
    if (
      url.hostname !== "github.com" ||
      url.username ||
      url.password ||
      !/^\/[^/]+\/?$/.test(url.pathname)
    )
      throw new Error("Enter a GitHub username or profile URL.");
    username = url.pathname.replace(/^\/|\/$/g, "");
  }
  if (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(username))
    throw new Error("Enter a GitHub username or profile URL.");
  return username;
}
export function publicWebsite(value) {
  let url = string(value);
  if (!url) return "";
  if (!/^[a-z][\w+.-]*:/i.test(url)) url = `https://${url}`;
  try {
    const parsed = new URL(url);
    return ["https:", "http:"].includes(parsed.protocol) &&
      !parsed.username &&
      !parsed.password
      ? parsed.href
      : "";
  } catch {
    return "";
  }
}
async function json(path, fetcher, signal) {
  let response;
  try {
    response = await fetcher(`https://api.github.com${path}`, {
      headers: { Accept: "application/vnd.github+json" },
      signal,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error(
      "Could not reach GitHub. Check your connection and try again.",
    );
  }
  if (!response.ok)
    throw new Error(
      response.status === 404
        ? "GitHub profile not found. Check the username."
        : [403, 429].includes(response.status)
          ? "GitHub rate limit reached. Try again later."
          : `GitHub request failed (${response.status}).`,
    );
  return {
    data: await response.json(),
    next: /rel="next"/.test(response.headers?.get("link") || ""),
  };
}
export async function fetchGithubProfile(input, fetcher = fetch) {
  const username = githubUsername(input);
  const signal = AbortSignal.timeout(30000);
  try {
    const { data: u } = await json(`/users/${username}`, fetcher, signal);
    if (!u || typeof u.login !== "string")
      throw new Error("GitHub returned an invalid profile. Try again.");
    const login = githubUsername(u.login);
    const repositories = [];
    let complete = false;
    let warning = "";
    try {
      for (let page = 1; page <= 10; page++) {
        const { data, next } = await json(
          `/users/${login}/repos?type=owner&sort=updated&per_page=100&page=${page}`,
          fetcher,
          signal,
        );
        if (!Array.isArray(data))
          throw new Error("GitHub returned an invalid repository list.");
        repositories.push(
          ...data.filter(
            (r) =>
              r &&
              !r.private &&
              r.owner?.login?.toLowerCase() === login.toLowerCase(),
          ),
        );
        if (!next) {
          complete = true;
          break;
        }
      }
      if (!complete)
        warning =
          "Repository summary covers the first 1,000 recently updated repositories.";
    } catch (error) {
      warning = `Profile loaded, but repository data is incomplete. ${signal.aborted ? "The request timed out." : error.message}`;
    }
    const unique = [
      ...new Map(repositories.map((r) => [r.id ?? r.full_name, r])).values(),
    ];
    const originals = unique.filter((r) => !r.fork);
    const languages = new Map();
    originals.forEach((r) => {
      if (r.language)
        languages.set(r.language, (languages.get(r.language) || 0) + 1);
    });
    return {
      login,
      name: string(u.name) || login,
      bio: string(u.bio),
      company: string(u.company),
      location: string(u.location),
      website: publicWebsite(u.blog),
      avatar: publicWebsite(u.avatar_url),
      email: string(u.email),
      twitter: string(u.twitter_username),
      url: `https://github.com/${login}`,
      followers: count(u.followers),
      following: count(u.following),
      publicRepos: count(u.public_repos),
      publicGists: count(u.public_gists),
      joined: /^\d{4}-\d{2}-\d{2}T/.test(u.created_at || "")
        ? u.created_at.slice(0, 10)
        : "",
      fetchedAt: new Date().toISOString(),
      complete,
      warning,
      fetchedRepos: unique.length,
      stars: originals.reduce(
        (n, r) => n + (count(r.stargazers_count) || 0),
        0,
      ),
      forks: originals.reduce((n, r) => n + (count(r.forks_count) || 0), 0),
      languages: [...languages]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([name, repositories]) => ({ name, repositories })),
      projects: originals
        .filter(
          (r) => !r.archived && r.name?.toLowerCase() !== login.toLowerCase(),
        )
        .sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))
        .slice(0, 3)
        .map((r) => ({
          name: string(r.name),
          subtitle: string(r.description),
          github: `https://github.com/${login}/${encodeURIComponent(r.name)}`,
          demo: publicWebsite(r.homepage),
          stack: string(r.language),
          layout: "detailed",
        })),
    };
  } catch (error) {
    if (signal.aborted) throw new Error("GitHub timed out. Try again.");
    throw error;
  }
}
