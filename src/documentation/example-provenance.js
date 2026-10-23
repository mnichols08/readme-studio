import { marked } from "marked";
import { visitTokens } from "../markdown/visit-tokens.js";

export const EXAMPLE_STATUSES = Object.freeze([
  "verified",
  "user-confirmed",
  "placeholder",
]);
export const EXAMPLE_MARKER_LIMIT = 500;
export const EXAMPLE_SOURCE_LIMIT = 750_000;

export function validateExampleProvenance(value) {
  if (
    !value ||
    !EXAMPLE_STATUSES.includes(value.status) ||
    typeof value.basis !== "string" ||
    value.basis.length > 500 ||
    /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value.basis)
  )
    throw Error("Choose a valid example status and verification note.");
  const basis = value.basis.trim();
  if (value.status === "verified" && !basis)
    throw Error("Verified examples need a verification note or evidence.");
  return { status: value.status, basis };
}

export const exampleMarker = (status) => {
  if (!EXAMPLE_STATUSES.includes(status))
    throw Error("Choose a valid example status.");
  return `<!-- readme-studio-example: ${status} -->`;
};

export function inspectExampleMarkers(source) {
  const text = String(source);
  if (new TextEncoder().encode(text).byteLength > EXAMPLE_SOURCE_LIMIT)
    return {
      checked: 0,
      counts: { verified: 0, "user-confirmed": 0, placeholder: 0 },
      issues: [],
      truncatedMarkers: 0,
      truncatedSource: true,
    };
  const values = [];
  visitTokens(marked.lexer(text), (token) => {
    if (token.type !== "html") return;
    for (const match of token.text.matchAll(
      /<!--\s*readme-studio-example:\s*([^]*?)-->/gi,
    ))
      values.push(match[1].trim().toLowerCase());
  });
  const visible = values.slice(0, EXAMPLE_MARKER_LIMIT);
  const counts = { verified: 0, "user-confirmed": 0, placeholder: 0 };
  const issues = [];
  for (const status of visible) {
    if (EXAMPLE_STATUSES.includes(status)) {
      counts[status]++;
      if (status === "placeholder")
        issues.push({ kind: "placeholder", status });
    } else issues.push({ kind: "invalid-marker", status });
  }
  return {
    checked: visible.length,
    counts,
    issues,
    truncatedMarkers: Math.max(values.length - visible.length, 0),
    truncatedSource: false,
  };
}
