import { normalizeTheme, safeName, baseTheme } from "./theme-model.js";
import {
  newBanner,
  normalizeBanner,
  themePalette,
} from "../banners/banner-model.js";
import { derive, themeBlocks } from "./theme-resolver.js";
export const visualKeys = [
  "width",
  "height",
  "alignment",
  "pattern",
  "themeMode",
  "showBorder",
  "showAccent",
  "seed",
];
export const emptyLibrary = () => ({
  version: 1,
  themes: [],
  banners: [],
  bundles: [],
});
const id = (value) =>
  typeof value === "string" && /^[a-z\d-]{1,80}$/i.test(value)
    ? value
    : crypto.randomUUID();
function rejectExecutable(value) {
  if (!value || typeof value !== "object") return;
  for (const [key, v] of Object.entries(value)) {
    if (
      /^(css|rawcss|rawsvg|script|html|foreignobject|stylesheet|on[a-z]+)$/i.test(
        key,
      )
    )
      throw Error(
        "Visual presets cannot contain CSS, SVG, HTML, scripts, or event handlers.",
      );
    rejectExecutable(v);
  }
}
export function bannerVisual(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("A banner preset needs visual settings.");
  rejectExecutable(value);
  const b = normalizeBanner({
    ...newBanner(),
    ...Object.fromEntries(
      visualKeys
        .filter((k) => Object.hasOwn(value || {}, k))
        .map((k) => [k, value[k]]),
    ),
    palette: value?.palette || newBanner().palette,
  });
  return {
    ...Object.fromEntries(visualKeys.map((k) => [k, b[k]])),
    palette: Object.fromEntries(
      Object.keys(themePalette()).map((k) => [k, b.palette[k]]),
    ),
  };
}
export function normalizeVisualEntry(value, kind) {
  if (!value || typeof value !== "object")
    throw Error("Invalid visual preset.");
  rejectExecutable(value);
  if (
    (kind === "themes" || kind === "bundles") &&
    (!value.theme ||
      typeof value.theme !== "object" ||
      Array.isArray(value.theme))
  )
    throw Error("A visual preset needs a complete theme.");
  const entry = { id: id(value.id), name: safeName(value.name) };
  if (kind === "themes") entry.theme = normalizeTheme(value.theme);
  else if (kind === "banners") entry.banner = bannerVisual(value.banner);
  else if (kind === "bundles") {
    entry.theme = normalizeTheme(value.theme);
    entry.banner = bannerVisual(value.banner);
  } else throw Error("Unknown visual preset kind.");
  return entry;
}
export function validateVisualLibrary(value) {
  if (value === undefined) return emptyLibrary();
  if (!value || value.version !== 1)
    throw Error("Unsupported visual library version.");
  const result = emptyLibrary(),
    ids = new Set();
  for (const kind of ["themes", "banners", "bundles"]) {
    if (!Array.isArray(value[kind]) || value[kind].length > 100)
      throw Error("Each visual library category supports up to 100 entries.");
    const names = new Set();
    for (const raw of value[kind]) {
      const e = normalizeVisualEntry(raw, kind);
      if (ids.has(e.id)) e.id = crypto.randomUUID();
      ids.add(e.id);
      const base = e.name;
      let n = 2;
      while (names.has(e.name.toLowerCase()))
        e.name = `${base.slice(0, 110)} (${n++})`;
      names.add(e.name.toLowerCase());
      result[kind].push(e);
    }
  }
  return result;
}
export function mergeVisualLibraries(current, incoming) {
  const a = validateVisualLibrary(current),
    b = validateVisualLibrary(incoming);
  return validateVisualLibrary({
    version: 1,
    ...Object.fromEntries(
      ["themes", "banners", "bundles"].map((k) => [k, [...a[k], ...b[k]]]),
    ),
  });
}
export function recoverVisualLibrary(value) {
  const result = emptyLibrary();
  if (value?.version !== 1) return result;
  for (const kind of ["themes", "banners", "bundles"])
    for (const raw of Array.isArray(value[kind])
      ? value[kind].slice(0, 100)
      : []) {
      try {
        result[kind].push(normalizeVisualEntry(raw, kind));
      } catch {
        /* Original invalid data stays in recovery download. */
      }
    }
  return validateVisualLibrary(result);
}
export function exportVisualEntry(entry, kind) {
  const e = normalizeVisualEntry(entry, kind);
  return {
    version: 1,
    type:
      kind === "themes"
        ? "readme-studio-theme"
        : kind === "banners"
          ? "readme-studio-banner-preset"
          : "readme-studio-visual-preset",
    name: e.name,
    ...(e.theme ? { theme: e.theme } : {}),
    ...(e.banner ? { banner: e.banner } : {}),
  };
}
export function readVisualFile(input) {
  if (typeof input === "string" && input.length > 2_000_000)
    throw Error("Visual preset file exceeds the 2 MB limit.");
  let v;
  try {
    v = typeof input === "string" ? JSON.parse(input) : input;
  } catch {
    throw Error("Could not read visual preset JSON.");
  }
  if (v?.version !== 1)
    throw Error("Unsupported visual preset version. Expected version 1.");
  rejectExecutable(v);
  const result = emptyLibrary();
  if (v.type === "readme-studio-visual-pack")
    return validateVisualLibrary(v.library);
  if (v.type === "readme-studio-theme-pack") {
    if (!Array.isArray(v.themes) || v.themes.length > 100)
      throw Error("Theme packs support up to 100 themes.");
    for (const theme of v.themes)
      result.themes.push(normalizeVisualEntry(theme, "themes"));
  } else {
    const kind = {
      "readme-studio-theme": "themes",
      "readme-studio-banner-preset": "banners",
      "readme-studio-visual-preset": "bundles",
    }[v.type];
    if (!kind)
      throw Error(
        "Choose a README Studio theme, banner preset, visual preset, or pack.",
      );
    result[kind].push(normalizeVisualEntry(v, kind));
  }
  return validateVisualLibrary(result);
}
export function applyVisualPreset(draft, preset, { reset = false } = {}) {
  const next = structuredClone(draft);
  next.metadata ||= {};
  const theme = preset.theme
    ? normalizeTheme(preset.theme)
    : next.metadata.visualTheme || baseTheme;
  if (preset.theme) {
    next.metadata.visualTheme = theme;
    next.blocks = themeBlocks(next.blocks, theme, { reset });
  }
  if (preset.banner) {
    const visual = bannerVisual(preset.banner),
      banner = next.metadata.bannerSettings
        ? normalizeBanner(next.metadata.bannerSettings)
        : newBanner(theme);
    derive(banner, Object.fromEntries(visualKeys.map((k) => [k, visual[k]])), {
      reset,
    });
    derive(banner.palette, visual.palette, { reset });
    next.metadata.bannerSettings = banner;
  } else if (preset.theme && next.metadata.bannerSettings) {
    derive(next.metadata.bannerSettings.palette, themePalette(theme), {
      reset,
    });
  }
  return next;
}
