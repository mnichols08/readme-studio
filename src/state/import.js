export async function importGithub(input, fetcher = fetch) {
  const parts = input.trim().split("/");
  if (
    parts.length > 2 ||
    !parts.every((p) => /^[\w.-]+$/.test(p)) ||
    parts.some((p) => p === "." || p === "..")
  )
    throw new Error("Enter a username or owner/repository.");
  const [owner, repo = owner] = parts;
  const response = await fetcher(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/readme`,
    {
      headers: { Accept: "application/vnd.github.raw+json" },
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!response.ok)
    throw new Error(
      response.status === 404
        ? "No public root README found. Check the repository name."
        : response.status === 403 || response.status === 429
          ? "GitHub rate limit reached. Try again later or import a file."
          : `GitHub import failed (${response.status}).`,
    );
  const markdown = await response.text();
  if (markdown.length > 2_000_000)
    throw new Error("This README exceeds the 2 MB import limit.");
  return { markdown, repository: `${owner}/${repo}` };
}
