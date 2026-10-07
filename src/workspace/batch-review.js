import { target } from "../publishing/validation.js";
import { targetIdentity } from "./documents.js";

export function validateBatch(value) {
  if (value == null) return null;
  if (
    value.version !== 1 ||
    !Array.isArray(value.items) ||
    !value.items.length ||
    value.items.length > 200 ||
    !Number.isInteger(value.current) ||
    value.current < 0 ||
    value.current >= value.items.length
  )
    throw Error("Invalid review batch. Choose up to 200 repositories.");
  const ids = new Set();
  return {
    version: 1,
    current: value.current,
    items: value.items.map((item) => {
      const destination = target(item);
      const identity = targetIdentity(destination);
      if (
        ids.has(identity) ||
        !["pending", "reviewed", "skipped"].includes(item.state)
      )
        throw Error("Invalid or duplicate batch item.");
      ids.add(identity);
      return { ...destination, state: item.state };
    }),
  };
}
export function createBatch(repositories) {
  const unique = [
    ...new Map(
      repositories.map((repo) => [repo.full_name.toLowerCase(), repo]),
    ).values(),
  ];
  return validateBatch({
    version: 1,
    current: 0,
    items: unique.map((repo) => ({
      repository: repo.full_name,
      branch: repo.default_branch,
      path: "README.md",
      state: "pending",
    })),
  });
}
export function nextBatchIndex(batch) {
  return batch.items.findIndex((item) => item.state === "pending");
}
export function decideBatch(batch, index, state) {
  const next = validateBatch(batch);
  if (!next.items[index] || !["pending", "reviewed", "skipped"].includes(state))
    throw Error("Choose a valid batch decision.");
  next.items[index].state = state;
  return next;
}
export function recoverBatch(value) {
  try {
    return validateBatch(value);
  } catch {
    return null;
  }
}
