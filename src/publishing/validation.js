export const MAX_SOURCE_BYTES = 750_000;
export function target(value) {
  const { repository, branch, path } = value || {};
  if (
    typeof repository !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9_.-]{1,100}$/.test(
      repository,
    ) ||
    repository.split("/").some((p) => p === "." || p === "..")
  )
    throw new Error("Choose a valid owner/repository.");
  if (
    typeof branch !== "string" ||
    branch.length > 200 ||
    !branch ||
    /[\s\x00-\x1f~^:?*\[\\]/.test(branch) ||
    branch.includes("..") ||
    branch.includes("@{") ||
    branch
      .split("/")
      .some(
        (p) =>
          !p || p.startsWith(".") || p.endsWith(".") || p.endsWith(".lock"),
      ) ||
    branch === "@"
  )
    throw new Error("Choose a valid branch.");
  if (
    typeof path !== "string" ||
    path.length > 240 ||
    !/^(?:[A-Za-z0-9_-][A-Za-z0-9_. -]*\/)*README(?:\.[A-Za-z0-9_-]+)?$/i.test(
      path,
    ) ||
    path.split("/").some((p) => p.endsWith(".") || p.endsWith(" "))
  )
    throw new Error(
      "Choose a relative README file path without traversal or hidden folders.",
    );
  return { repository, branch, path };
}
export function writeInput(value) {
  const result = target(value);
  if (
    typeof value.content !== "string" ||
    new TextEncoder().encode(value.content).length > MAX_SOURCE_BYTES
  )
    throw new Error(
      "README exceeds the 750 KB publishing limit. Download it instead.",
    );
  if (
    typeof value.message !== "string" ||
    !value.message.trim() ||
    value.message.length > 500 ||
    /[\x00-\x1f\x7f]/.test(value.message)
  )
    throw new Error("Enter a commit message of 1–500 characters.");
  if (value.sha !== null && !/^[a-f0-9]{40,64}$/.test(value.sha || ""))
    throw new Error("Reload the remote SHA before publishing.");
  if (value.confirmed !== true)
    throw new Error("Review and confirm this write first.");
  return {
    ...result,
    content: value.content,
    message: value.message.trim(),
    sha: value.sha,
    confirmed: true,
  };
}
