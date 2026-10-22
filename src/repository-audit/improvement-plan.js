import { assessProjectType, topicLabel } from "./project-types.js";
import { dismissalApplies, readmeRevision } from "./attention.js";

// Improvement plans are derived from one in-session audit record and the
// author's decisions (ADR epic64-01). Pure: no fetch, no source re-parse, no
// scores. Each Recommendation maps to exactly one Audit finding ID.

// Bump only when mapping, band or evidence rules change; Audit snapshots record it.
export const PLAN_RULES_VERSION = 1;
export const PLAN_LIMIT = 30;
export const planBands = [
  ["start", "Start here"],
  ["next", "Next"],
  ["optional", "Optional"],
];
const bandOrder = Object.fromEntries(planBands.map(([id], i) => [id, i]));
const kindOrder = [
  "readme",
  "starter",
  "placeholder",
  "topic",
  "link",
  "image",
  "history",
];

const fixedTitles = {
  "readme:missing": "Add a root README",
  "readme:thin": "Expand the README",
  "placeholder:todo": "Review TODO text in the README",
  "placeholder:project-name": "Replace the your-project-name placeholder",
  "starter:create-react-app": "Replace Create React App starter text",
  "starter:vite": "Replace Vite starter text",
  "starter:nextjs": "Replace Next.js starter text",
  "history:activity-after-readme": "Review the README against recent activity",
};
const topicTitles = {
  overview: "Add a purpose or overview",
  visuals: "Add a screenshot or demo",
  setup: "Add setup or how-to-run instructions",
  installation: "Add an Installation section",
  configuration: "Add environment or configuration notes",
  testing: "Add a Testing section",
  deployment: "Add a Deployment section",
  usage: "Add a Usage section",
  api: "Add an API reference",
  compatibility: "Add a Compatibility section",
  examples: "Add Examples",
  contributing: "Add a Contributing section",
  commands: "Add a Commands section",
  options: "Add a Flags / options section",
  authentication: "Add an Authentication section",
  endpoints: "Add an Endpoints section",
  requests: "Add sample requests and responses",
  controls: "Add a Controls section",
  gameplay: "Add a Gameplay section",
  build: "Add Build instructions",
  offline: "Add offline / installation behavior",
  navigation: "Add documentation navigation",
  license: "Add a License section",
  prerequisites: "Add a Prerequisites section",
  steps: "Add learning steps",
  findings: "Add findings or limitations",
  links: "Add project or documentation links",
};

// Title for any finding ID, also used by later Audit comparisons.
export function findingTitle(id) {
  if (fixedTitles[id]) return fixedTitles[id];
  if (id.startsWith("topic:"))
    return (
      topicTitles[id.slice(6)] || `Add a ${topicLabel(id.slice(6))} section`
    );
  if (id.startsWith("link:unavailable:")) return "Review unavailable link";
  if (id.startsWith("image:unavailable:")) return "Review unavailable image";
  return "Review this audit finding";
}

// What the classifier also accepts besides a matching heading, so evidence
// states exactly what was not observed.
const alsoChecked = {
  overview: "no substantive prose passage",
  setup: "no setup-like prose",
  usage: "no usage-like prose",
  examples: "no code example",
  visuals: "no non-badge image",
  links: "no project/documentation link",
};
// Facts detected without English heading terms.
const languageNeutral = {
  overview: (m) => m.substantiveParagraphs > 0,
  examples: (m) => m.codeExamples > 0,
  visuals: (m) => m.supportingImages > 0,
  links: (m) => m.projectLinks > 0,
};
const ANYWHERE = "may be covered under another heading or linked elsewhere";
const WEAK_TYPE =
  "Project type is a weak inference; choose a type if this is wrong";
const NOT_ENGLISH =
  "Headings may not be in English; topic detection uses English terms";
// Kind- and type-specific caveats. `optional` downgrades the Recommendation.
const topicCaveats = [
  {
    topic: "authentication",
    text: "does not apply to APIs without authentication",
  },
  {
    topic: "api",
    when: (m) => m?.projectLinks > 0,
    text: "README links to external documentation, which may be a deliberate alternative",
    optional: true,
  },
  {
    topic: "license",
    text: "a LICENSE file may already cover this; the audit does not read it",
  },
  {
    topic: "findings",
    type: "experiment",
    text: "findings are optional for an experiment",
    optional: true,
  },
];

function typeOrigin(source, suggestion) {
  return {
    manual: "type chosen by you",
    topic: `type from repository topic “${suggestion.match}”`,
    prose: `type from README prose “${suggestion.match}”`,
    name: `type from name hint “${suggestion.match}”`,
    fallback: "generic fallback type; no specific evidence",
  }[source];
}

function revisionLabel(revision) {
  if (revision === "missing-root") return "no root README";
  return revision ? `README revision ${revision.slice(4, 11)}` : "";
}

/**
 * Builds the Improvement plan for one audit record, or null when the record
 * has no successful result (a failed fetch is never a missing README).
 * decisions.dismissed: Map(finding ID -> Observed revision); decisions.minimal:
 * Intentionally minimal applies to this revision; skipped: Set(finding ID).
 * A dismissal made for another revision is a Stale decision: the
 * Recommendation stays visible (also listed in hidden.stale) and is not applied.
 * Repository activity (and `now`) never changes a plan.
 */
export function improvementPlan(
  record,
  { override = "auto", decisions = {}, skipped } = {},
) {
  if (!record?.result) return null;
  const { result } = record;
  const assessment = assessProjectType(result, override);
  const { type, state } = assessment;
  const m = result.metrics;
  const suggestion = assessment.suggestion;
  const typeSource =
    override !== "auto"
      ? "manual"
      : ["topic", "prose", "name"].includes(suggestion.source)
        ? suggestion.source
        : "fallback";
  const revision = readmeRevision(record);
  const observed = Number.isFinite(record.checkedAt)
    ? new Date(record.checkedAt).toISOString()
    : "";
  const observedLines = [
    revisionLabel(revision) || "README revision unavailable",
    observed ? `Observed ${observed}` : "Observation time unknown",
  ];
  const origin = `${type.name} (${typeOrigin(typeSource, suggestion)})`;
  const caveats = [];
  if (typeSource === "name" || typeSource === "fallback")
    caveats.push(WEAK_TYPE);
  // Substantial prose under headings, yet no heading matched any English
  // topic term and no setup/usage phrase was recognised.
  if (
    m &&
    m.meaningfulWords >= 80 &&
    m.headings >= 2 &&
    !m.setup &&
    !m.usage &&
    Object.entries(result.documentation || {}).every(
      ([key, detected]) => !detected || languageNeutral[key]?.(m),
    )
  )
    caveats.push(NOT_ENGLISH);

  const found = new Map();
  const add = (id, band, evidence, applicability, extra = {}) => {
    if (found.has(id)) return;
    found.set(id, {
      id,
      band,
      title: findingTitle(id),
      evidence: [...evidence, ...observedLines],
      applicability: id.startsWith("topic:")
        ? applicability
        : `${applicability} Project type: ${origin}.`,
      ...extra,
    });
  };

  const folded = state === "missing" || state === "stub";
  const consider = folded
    ? type.key
        .filter((key) => !assessment.detected.includes(key))
        .map(topicLabel)
    : [];
  if (state === "missing")
    add(
      "readme:missing",
      "start",
      result.evidence.filter((line) => line !== "README needs attention"),
      "Applies to any project type.",
      { consider },
    );
  else if (state === "stub" || state === "minimal")
    add(
      "readme:thin",
      "start",
      [`Assessed as ${assessment.label}`, ...assessment.evidence.slice(0, 3)],
      "A short README can be deliberate; mark it intentionally minimal if so.",
      folded ? { consider } : {},
    );

  for (const finding of result.findings || []) {
    const kind = finding.id.split(":")[0];
    if (kind === "starter")
      add(
        finding.id,
        "start",
        [finding.message],
        "Applies to any project type; starter text can be kept on purpose.",
      );
    else if (kind === "placeholder")
      add(
        finding.id,
        "start",
        [finding.message],
        "Applies to any project type; the text may be intentional, for example in a TODO app.",
      );
  }

  if (!folded)
    for (const key of assessment.missing) {
      const notes = [ANYWHERE];
      let band = type.key.includes(key) ? "next" : "optional";
      for (const caveat of topicCaveats)
        if (
          caveat.topic === key &&
          (!caveat.type || caveat.type === type.id) &&
          (!caveat.when || caveat.when(m))
        ) {
          notes.push(caveat.text);
          if (caveat.optional) band = "optional";
        }
      if (caveats.length) band = "optional";
      add(
        `topic:${key}`,
        band,
        [
          `${topicLabel(key)}: no populated heading matched${alsoChecked[key] ? `, and ${alsoChecked[key]}` : ""}`,
        ],
        `${type.key.includes(key) ? "Key topic" : "Optional topic"} for ${origin}; it ${notes.join("; ")}.${caveats.length ? ` ${caveats.join(". ")}.` : ""}`,
      );
    }

  for (const finding of record.review?.findings || []) {
    const kind = finding.id.split(":")[0];
    if (kind === "link" || kind === "image")
      add(
        finding.id,
        "next",
        [finding.url || finding.message, "HTTP 404/410 at check time"],
        "Applies to any project type; the URL may have moved or be temporarily unavailable.",
        { url: finding.url },
      );
    else if (kind === "history")
      add(
        finding.id,
        "optional",
        Number.isSafeInteger(finding.commits)
          ? [
              `Last observed README update: ${finding.updated}`,
              `${finding.commits} distinct recent commits after it, spanning at least seven days`,
            ]
          : [finding.message],
        "Applies to any project type; commit activity does not prove the README is outdated.",
      );
  }

  // Plan caveats qualify type-dependent content only.
  if (
    ![...found.values()].some(
      (rec) => rec.id.startsWith("topic:") || rec.consider?.length,
    )
  )
    caveats.length = 0;
  const topicIndex = (id) =>
    id.startsWith("topic:") ? type.topics.indexOf(id.slice(6)) : -1;
  const ordered = [...found.values()].sort(
    (a, b) =>
      bandOrder[a.band] - bandOrder[b.band] ||
      kindRank(a.id) - kindRank(b.id) ||
      topicIndex(a.id) - topicIndex(b.id) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  const hidden = { dismissed: [], stale: [], skipped: [] };
  const visible = [];
  for (const rec of ordered) {
    const thin = rec.id.startsWith("readme:");
    rec.actions = [
      "improve",
      "open",
      ...(record.readme?.path && state !== "missing" ? ["github"] : []),
      "skip",
      thin ? "minimal" : "dismiss",
    ];
    if (thin && decisions.minimal) rec.minimal = true;
    const stored = decisions.dismissed?.get(rec.id);
    if (!thin && dismissalApplies(decisions.dismissed, rec.id, revision))
      hidden.dismissed.push(rec);
    else if (skipped?.has(rec.id)) hidden.skipped.push(rec);
    else {
      if (!thin && stored) {
        rec.stale = stored; // Not applied: the README changed since.
        hidden.stale.push(rec);
      }
      visible.push(rec);
    }
  }
  return {
    repository: record.repo?.full_name || "",
    revision,
    observedAt: record.checkedAt,
    type: { id: type.id, name: type.name },
    typeSource,
    state,
    label: assessment.label,
    caveats,
    recommendations: visible.slice(0, PLAN_LIMIT),
    omitted: Math.max(0, visible.length - PLAN_LIMIT),
    hidden,
  };
}

function kindRank(id) {
  const rank = kindOrder.indexOf(id.split(":")[0]);
  return rank < 0 ? kindOrder.length : rank;
}

// Story 03.1 decisions live in the audit session only (`skipped` and
// `dismissed`, keyed by canonical owner/name). Returns a status message.
export function planDecision(session, { repository, id, action, revision }) {
  const key = repository.toLowerCase();
  const title = findingTitle(id);
  if (action === "skip") {
    if (!session.skipped.has(key)) session.skipped.set(key, new Set());
    session.skipped.get(key).add(id);
    return `Skipped “${title}” for ${repository} in this session. Restore it from Skipped.`;
  }
  if (action === "dismiss") {
    if (id.startsWith("readme:"))
      throw Error(
        "A missing or thin README cannot be dismissed; mark it intentionally minimal instead.",
      );
    if (!revision)
      throw Error("Refresh the audit to obtain a README revision.");
    if (!session.dismissed.has(key)) session.dismissed.set(key, new Map());
    session.dismissed.get(key).set(id, revision);
    return `Dismissed “${title}” for ${repository} for this session and ${revisionLabel(revision)}.`;
  }
  if (action === "restore") {
    session.skipped.get(key)?.delete(id);
    session.dismissed.get(key)?.delete(id);
    return `Restored “${title}” for ${repository}.`;
  }
  throw Error("Unsupported plan decision.");
}

export function sessionDecisions(session, repository) {
  const key = repository.toLowerCase();
  return {
    decisions: { dismissed: session.dismissed?.get(key) },
    skipped: session.skipped?.get(key),
  };
}
