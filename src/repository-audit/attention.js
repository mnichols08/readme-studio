import { assessProjectType } from "./project-types.js";

const DAY = 86400000;
const keyTopics = {
  "web-app": ["overview", "visuals", "setup", "configuration"],
  library: ["overview", "installation", "usage", "api", "examples"],
  cli: ["installation", "commands", "options", "examples"],
  api: ["setup", "authentication", "endpoints", "requests"],
  "npm-package": ["overview", "installation", "usage", "api"],
  "rust-crate": ["overview", "installation", "usage", "api"],
  "python-package": ["overview", "installation", "usage", "api"],
  game: ["overview", "controls", "setup", "gameplay", "build"],
  pwa: ["overview", "setup", "offline"],
  documentation: ["overview", "navigation"],
  "open-source": ["overview", "setup", "usage", "contributing"],
  tutorial: ["overview", "prerequisites", "steps"],
  experiment: ["overview"],
  generic: ["overview", "setup", "usage"],
};
const topicNames = {
  overview: "Purpose / overview",
  visuals: "Screenshot / demo",
  setup: "Build/run or setup instructions",
  configuration: "Environment / configuration",
  installation: "Installation",
  usage: "Usage",
  api: "API reference",
  examples: "Examples",
  commands: "Commands",
  options: "Flags / options",
  authentication: "Authentication",
  endpoints: "Endpoints",
  requests: "Sample requests / responses",
  controls: "Game controls",
  gameplay: "Gameplay",
  build: "Build instructions",
  offline: "Offline behavior",
  navigation: "Documentation navigation",
  contributing: "Contributing",
  prerequisites: "Prerequisites",
  steps: "Learning steps",
};
const tiers = { high: 0, medium: 1, low: 2 };
const states = {
  missing: 0,
  stub: 1,
  minimal: 2,
  basic: 3,
  detailed: 4,
  "documentation-heavy": 5,
};
const compareText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const count = (value) =>
  Number.isSafeInteger(value) && value >= 0 ? value : 0;

export function readmeRevision(record) {
  if (!record?.result) return "";
  if (record.result.state === "missing") return "missing-root";
  const sha = record.readme?.sha;
  return typeof sha === "string" && /^(?:[a-f\d]{40}|[a-f\d]{64})$/i.test(sha)
    ? `sha:${sha.toLowerCase()}`
    : "";
}

export function suppressionFor(entry, record, now) {
  if (!entry) return "";
  const revision = readmeRevision(record);
  if (entry.revision && entry.revision !== revision) return "";
  if (entry.kind === "minimal" && revision && entry.revision === revision)
    return "Intentionally minimal for this README revision";
  if (entry.kind === "ignore" && entry.until > now)
    return `Ignored until ${new Date(entry.until).toISOString().slice(0, 10)}`;
  return "";
}

export function attentionItem(
  record,
  { override = "auto", now = Date.now(), preference } = {},
) {
  if (!record?.result) return null; // A fetch failure is never missing documentation.
  const repo = record.repo;
  const assessment = assessProjectType(record.result, override);
  const gaps = assessment.missing.filter((key) =>
    keyTopics[assessment.type.id].includes(key),
  );
  const thin = ["missing", "stub", "minimal"].includes(assessment.state);
  const findings = [
    ...(record.result.findings || []),
    ...(record.review?.findings || []),
  ];
  if (!thin && !gaps.length && !findings.length) return null;
  const pushed = Date.parse(repo.pushed_at);
  const days =
    Number.isFinite(pushed) && pushed <= now
      ? Math.floor((now - pushed) / DAY)
      : null;
  const active = !repo.archived && days !== null && days <= 30;
  const inactive = days !== null && days > 180;
  const priority =
    repo.archived || inactive ? "low" : active && thin ? "high" : "medium";
  const interest =
    count(repo.stargazers_count) > 0 ||
    count(repo.forks_count) > 0 ||
    !!repo.homepage;
  const reasons = [
    assessment.label,
    ...findings,
    repo.archived
      ? "Archived repository; placed below active work."
      : days === null
        ? "Push activity unknown; not assumed active."
        : `Pushed ${days} ${days === 1 ? "day" : "days"} ago${inactive ? "; no push in over 180 days, so placed lower" : active ? "; recently active" : ""}.`,
    ...gaps.map(
      (key) =>
        `${topicNames[key]} not detected. Commonly useful for this project type.`,
    ),
  ];
  if (repo.archived && days !== null)
    reasons.push(`Last push ${days} days ago.`);
  if (repo.homepage)
    reasons.push("Homepage/live demo link present; availability not verified.");
  if (count(repo.stargazers_count))
    reasons.push(
      `${repo.stargazers_count} stars indicate public interest, not README quality.`,
    );
  if (count(repo.forks_count))
    reasons.push(
      `${repo.forks_count} forks indicate public interest, not README quality.`,
    );
  return {
    repo,
    record,
    assessment,
    gaps,
    priority,
    reasons,
    active,
    days,
    interest,
    revision: readmeRevision(record),
    suppressed: suppressionFor(preference, record, now),
  };
}

export function attentionQueue(
  records,
  { overrides = new Map(), preferences = [], now = Date.now() } = {},
) {
  const saved = new Map(preferences.map((entry) => [entry.repository, entry]));
  return records
    .map((record) =>
      attentionItem(record, {
        override: overrides.get(record.repo.full_name) || "auto",
        preference: saved.get(record.repo.full_name.toLowerCase()),
        now,
      }),
    )
    .filter(Boolean)
    .sort(
      (a, b) =>
        tiers[a.priority] - tiers[b.priority] ||
        Number(b.active) - Number(a.active) ||
        states[a.assessment.state] - states[b.assessment.state] ||
        Number(b.interest) - Number(a.interest) ||
        (a.days ?? Infinity) - (b.days ?? Infinity) ||
        compareText(
          a.repo.full_name.toLowerCase(),
          b.repo.full_name.toLowerCase(),
        ) ||
        compareText(a.repo.full_name, b.repo.full_name),
    );
}

export function filterAttention(items, filters = {}) {
  return items.filter(
    (item) =>
      (!filters.priority ||
        filters.priority === "all" ||
        item.priority === filters.priority) &&
      (!filters.missing || item.assessment.state === "missing") &&
      (!filters.active || item.active) &&
      (filters.archived === "include" ||
        (filters.archived === "only"
          ? item.repo.archived
          : !item.repo.archived)) &&
      (!filters.language ||
        filters.language === "all" ||
        (item.repo.language || "Unspecified") === filters.language) &&
      (!filters.type ||
        filters.type === "all" ||
        item.assessment.type.id === filters.type) &&
      count(item.repo.stargazers_count) >= Number(filters.stars || 0) &&
      (!filters.pushed ||
        (item.days !== null && item.days <= Number(filters.pushed))) &&
      (filters.deferred === "all" ||
        (filters.deferred === "only" ? !!item.suppressed : !item.suppressed)),
  );
}
