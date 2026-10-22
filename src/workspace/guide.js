// Guided start state (ADR 0004): the chosen Goal and the Next steps on/off
// preference. A workspace field, never a setting, so portable projects, draft
// JSON and README exports cannot carry it.
import { portableData } from "../state/portable-data.js";
export const GUIDE_VERSION = 1,
  GUIDE_LIMIT = 1024;
export const GOALS = Object.freeze({
  profile: Object.freeze({
    label: "Write my profile README",
    description: "Introduce yourself on your GitHub profile page.",
    needsNetwork: false,
  }),
  repository: Object.freeze({
    label: "Write a repository README",
    description:
      "Explain a project: what it does, how to install it and how to use it.",
    needsNetwork: false,
  }),
  audit: Object.freeze({
    label: "Audit my repository READMEs",
    description:
      "Find public repositories whose README is missing or needs attention. Needs a GitHub connection.",
    needsNetwork: true,
  }),
});
export const goalIds = Object.keys(GOALS);
// Only a Goal id string counts: Object.hasOwn alone would coerce ["audit"].
export const knownGoal = (goal) =>
  typeof goal === "string" && Object.hasOwn(GOALS, goal);
export const defaultGuide = () => ({
  version: GUIDE_VERSION,
  goal: null,
  nextSteps: true,
});
const object = (v) => v && typeof v === "object" && !Array.isArray(v);
function guideJson(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}
// A kept guide must pass the all-drafts backup boundary unchanged: the guide
// sits one level inside the workspace, so portableData starts at depth 1. Too
// deep, or holding credential-named keys the backup would strip, means it
// could not be kept unchanged, so it is replaced by the default instead.
function keepable(value) {
  const raw = guideJson(value);
  if (raw === undefined || new TextEncoder().encode(raw).length > GUIDE_LIMIT)
    return false;
  try {
    return JSON.stringify(portableData(JSON.parse(raw), 1)) === raw;
  } catch {
    return false;
  }
}
export function validateGuide(value) {
  if (value === undefined) return defaultGuide();
  if (object(value) && value.version === GUIDE_VERSION)
    return {
      version: GUIDE_VERSION,
      goal: knownGoal(value.goal) ? value.goal : null,
      nextSteps: value.nextSteps !== false,
    };
  // Another version, or a damaged value, is kept as it is so a newer app can
  // still read it; it reads as "no Goal" until the author chooses again.
  return keepable(value) ? JSON.parse(JSON.stringify(value)) : defaultGuide();
}
export function recoverGuide(value) {
  try {
    return validateGuide(value);
  } catch {
    return defaultGuide();
  }
}
// The Goal only counts in a version-1 guide; anything else means "no Goal".
export const guideGoal = (guide) =>
  object(guide) && guide.version === GUIDE_VERSION && knownGoal(guide.goal)
    ? guide.goal
    : null;
export const nextStepsEnabled = (guide) =>
  !(object(guide) && guide.version === GUIDE_VERSION) ||
  guide.nextSteps !== false;
// An explicit choice is the only thing that replaces an unknown guide.
export function chooseGoal(guide, goal) {
  if (!knownGoal(goal)) throw Error("Choose a known Goal.");
  return {
    version: GUIDE_VERSION,
    goal,
    nextSteps: nextStepsEnabled(guide),
  };
}
const option = (id, label) => ({ id, label });
// The second step of Guided start. Each option opens an existing flow; ids are
// AppShell actions except the two blank starts. Offline, the audit stays
// visible but unavailable, with offline-capable ways to begin beside it.
export function goalOptions(goal, { online = true } = {}) {
  if (goal === "profile")
    return [
      option("templates", "Start from a profile template"),
      option("profile", "Autofill from GitHub"),
      option("blank-profile", "Start a blank profile README"),
    ];
  if (goal === "repository")
    return [
      option("repository-readme", "Build a repository README"),
      option("import", "Import existing README"),
      option("blank-repository", "Start a blank repository README"),
    ];
  if (goal === "audit")
    return online
      ? [option("repository-audit", "Open README audit")]
      : [
          {
            ...option("repository-audit", "Open README audit"),
            unavailable:
              "You are offline. README audit reads your repositories from GitHub, so it needs a connection. Import a README file or start blank now and audit later.",
          },
          option("import", "Import existing README"),
          option("blank-repository", "Start a blank repository README"),
        ];
  throw Error("Choose a known Goal.");
}
export const blankDocument = (kind) => ({
  version: 1,
  kind,
  target: null,
});
