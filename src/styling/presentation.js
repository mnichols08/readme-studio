const text = (s) =>
  String(s || "")
    .replace(/[\\`*_[\]<>#|]/g, "\\$&")
    .replace(/[\r\n]/g, " ");
const html = (s) =>
  String(s || "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function heading(title, p = {}, level = 2) {
  return `${"#".repeat(level)} ${p.heading === "emoji-accent" ? text(p.decoration || "✦") + " " : ""}${text(title)}`;
}
export function divider(style = "rule", glyph = "✦") {
  return style === "none"
    ? ""
    : style === "glyph"
      ? `<p align="center">${html(glyph)} ${html(glyph)} ${html(glyph)}</p>`
      : "---";
}
export function present(markdown, b) {
  if (b.type === "custom" || !b.settings.presentation) return markdown;
  const p = b.settings.presentation;
  if (/^## /.test(markdown)) {
    const end = markdown.indexOf("\n"),
      title = (end < 0 ? markdown : markdown.slice(0, end)).slice(3);
    markdown =
      heading(title.replace(/\\([\\`*_[\]<>#|])/g, "$1"), p) +
      (end < 0 ? "" : markdown.slice(end));
  }
  return (
    markdown +
    (b.type !== "divider" && p.divider !== "none" && p.divider
      ? "\n\n" + divider(p.divider, p.decoration)
      : "")
  );
}
