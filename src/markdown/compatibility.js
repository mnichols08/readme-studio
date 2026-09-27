import { marked } from "marked";
export const compatibilityRules = [
  ["script", /<script\b/i, "Script tags cannot run on GitHub."],
  ["iframe", /<iframe\b/i, "Use an image and link instead of an iframe."],
  [
    "css",
    /<style\b|<link\b|\sstyle\s*=/i,
    "Custom CSS is not supported by GitHub.",
  ],
  [
    "unsafe",
    /\son\w+\s*=|javascript\s*:/i,
    "Unsafe HTML or URLs are removed from the preview.",
  ],
  [
    "interactive",
    /<(?:form|button|select|textarea|video|audio)\b/i,
    "Interactive HTML has limited GitHub support.",
  ],
  [
    "attributes",
    /\s(?:id|onclick|contenteditable)\s*=/i,
    "GitHub may remove unsupported HTML attributes.",
  ],
];
export function analyze(markdown) {
  const issues = [];
  const headings = [];
  const images = [];
  const links = [];
  let codeBlocks = 0;
  const tokens = marked.lexer(markdown);
  let source = "";
  marked.walkTokens(tokens, (t) => {
    if (t.type === "heading") headings.push({ level: t.depth, text: t.text });
    if (t.type === "image") images.push({ alt: t.text, url: t.href });
    if (t.type === "link") links.push({ text: t.text, url: t.href });
    if (t.type === "code") codeBlocks++;
    if (t.type === "html") source += t.text + "\n";
    if (t.type === "table" && t.header.length > 6)
      issues.push({
        category: "Layout",
        message: "A table has more than six columns; check mobile preview.",
      });
  });
  const add = (category, message) => issues.push({ category, message });
  const attr = (tag, name) =>
    tag.match(
      new RegExp(
        "\\b" + name + '\\s*=\\s*["\u0027]([^"\u0027]*)["\u0027]',
        "i",
      ),
    )?.[1] || "";
  for (const tag of source.match(/<img\b[^>]*>/gi) || []) {
    images.push({ alt: attr(tag, "alt"), url: attr(tag, "src") });
    if (Number(attr(tag, "width")) > 900)
      add("Layout", "A fixed-width image exceeds 900px.");
  }
  if (images.some((i) => !i.alt.trim()))
    add("Accessibility", "Add descriptive alt text to every image.");
  if (images.some((i) => i.alt.length > 150 || /^[^\p{L}\p{N}]+$/u.test(i.alt)))
    add("Accessibility", "Keep decorative alt text concise and meaningful.");
  if (links.some((l) => !l.text.trim()) || /<a\b[^>]*>\s*<\/a>/i.test(source))
    add("Accessibility", "Give empty links descriptive text.");
  for (const [, re, message] of compatibilityRules)
    if (re.test(source)) add("Compatibility", message);
  if (links.some((l) => /^javascript:/i.test(l.url)))
    add("Compatibility", "Unsafe link URLs are removed from preview.");
  if (headings.filter((h) => h.level === 1).length > 1)
    add("Structure", "Consider a single H1 for your introduction.");
  if (!headings.some((h) => h.level === 1))
    add("Structure", "Add a main introduction with an H1 heading.");
  if (headings.some((h, i) => i > 0 && h.level > headings[i - 1].level + 1))
    add("Structure", "Avoid skipped heading levels.");
  const badgeLikeImages = images.filter((i) =>
    /shields\.io|badge/i.test(i.url),
  ).length;
  if (badgeLikeImages >= 30)
    add(
      "Content density",
      "Clutter suggestions: consider reducing 30+ badges.",
    );
  if ((markdown.match(/^\s*(---+|\*\*\*+)\s*$/gm) || []).length > 6)
    add("Content density", "Clutter suggestions: reduce repeated separators.");
  if (
    markdown
      .split("\n")
      .some((l) => (l.match(/img\.shields\.io/g) || []).length > 8)
  )
    add("Layout", "A long badge row may overflow on small screens.");
  const widgets = images.filter((i) =>
    /stats|metrics|streak|typing|activity|snake|constellation/i.test(i.url),
  );
  if (widgets.length >= 5)
    add(
      "Content density",
      "Clutter suggestions: consider fewer dynamic widgets.",
    );
  if (widgets.some((w, i) => widgets.findIndex((v) => v.url === w.url) !== i))
    add(
      "Content density",
      "Clutter suggestions: remove repeated widget images.",
    );
  if (images.filter((i) => /typing/i.test(i.url)).length > 1)
    add("Content density", "Clutter suggestions: use a single typing effect.");
  if ((markdown.split(/^## /m)[0] || "").length > 4000)
    add("Content density", "Clutter suggestions: shorten the introduction.");
  return {
    headings,
    images,
    links,
    codeBlocks,
    badgeLikeImages,
    issues,
    words: markdown.trim() ? markdown.trim().split(/\s+/).length : 0,
    bytes: new TextEncoder().encode(markdown).length,
  };
}
