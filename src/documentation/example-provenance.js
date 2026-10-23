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

export function readableExampleProvenance(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !EXAMPLE_STATUSES.includes(value.status) ||
    typeof value.basis !== "string"
  )
    return null;
  try {
    return validateExampleProvenance(value);
  } catch {
    return null;
  }
}

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
  const records = [];
  let fence = null;
  let pending = [];
  const flushOrphans = () => {
    records.push(
      ...pending.map((status) => ({ kind: "orphan-marker", status })),
    );
    pending = [];
  };
  for (const line of text.split(/\r?\n/)) {
    if (fence) {
      if (new RegExp(`^\\s*${fence.char}{${fence.size},}\\s*$`).test(line))
        fence = null;
      continue;
    }
    const opening = line.match(/^\s*(`{3,}|~{3,})[^]*$/);
    if (opening) {
      const statuses = pending;
      pending = [];
      if (!statuses.length) records.push({ kind: "unclassified" });
      else if (statuses.length > 1)
        records.push({ kind: "duplicate-marker", statuses });
      else records.push({ kind: "classified", status: statuses[0] });
      fence = { char: opening[1][0], size: opening[1].length };
      continue;
    }
    const marker = line.match(
      /^\s*<!--\s*readme-studio-example:\s*([^]*?)-->\s*$/i,
    );
    if (marker) {
      pending.push(marker[1].trim().toLowerCase());
      continue;
    }
    if (pending.length) flushOrphans();
  }
  if (pending.length) flushOrphans();
  const visible = records.slice(0, EXAMPLE_MARKER_LIMIT);
  const counts = { verified: 0, "user-confirmed": 0, placeholder: 0 };
  const issues = [];
  for (const record of visible) {
    if (record.kind !== "classified") {
      issues.push(record);
      continue;
    }
    const { status } = record;
    if (!EXAMPLE_STATUSES.includes(status))
      issues.push({ kind: "invalid-marker", status });
    else {
      counts[status]++;
      if (status === "placeholder")
        issues.push({ kind: "placeholder", status });
    }
  }
  return {
    checked: visible.length,
    counts,
    issues,
    truncatedMarkers: Math.max(records.length - visible.length, 0),
    truncatedSource: false,
  };
}
