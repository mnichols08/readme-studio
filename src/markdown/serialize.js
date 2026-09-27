export const html = (value = "") =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const text = (value = "") =>
  String(value)
    .replace(/[\\`*_[\]<>#]/g, "\\$&")
    .replace(/\r?\n/g, " ");
export function safeUrl(value = "") {
  return /^(https?:\/\/|mailto:)/i.test(value.trim()) ? value.trim() : "";
}
const destination = (value) =>
  safeUrl(value).replace(/[()\s]/g, (c) => encodeURIComponent(c));
export function badgeUrl(s = {}, dark = false) {
  const segment = (v) =>
    encodeURIComponent(
      String(v || "")
        .replace(/-/g, "--")
        .replace(/_/g, "__")
        .replace(/ /g, "_"),
    );
  const color = (dark ? s.darkColor : s.color) || s.brandColor || "6558d3";
  const query = new URLSearchParams({
    style: s.style || "flat",
    logo: s.logo || "",
    logoColor: (dark ? s.darkLogoColor : s.logoColor) || "white",
  });
  const label = s.label || s.name || "";
  const parts =
    s.message && label
      ? [label, s.message, color]
      : [s.message || label || "badge", color];
  return `https://img.shields.io/badge/${parts.map(segment).join("-")}?${query}`;
}
export function picture(s) {
  const size = ["width", "height"]
    .filter((k) => /^\d+$/.test(String(s[k])))
    .map((k) => ` ${k}="${s[k]}"`)
    .join("");
  let result = `<picture>\n  <source media="(prefers-color-scheme: dark)" srcset="${html(safeUrl(s.dark))}">\n  <img src="${html(safeUrl(s.light))}" alt="${html(s.alt)}"${size}>\n</picture>`;
  if (safeUrl(s.link))
    result = `<a href="${html(safeUrl(s.link))}">\n${result}\n</a>`;
  return s.align === "center" ? `<p align="center">\n${result}\n</p>` : result;
}
export function badge(s) {
  if (s.darkColor || s.darkUrl)
    return picture({
      light: s.lightUrl || badgeUrl(s),
      dark: s.darkUrl || badgeUrl(s, true),
      alt: s.alt || s.label || s.name,
      link: s.link,
    });
  const img = `![${text(s.alt || s.label || s.name)}](${safeUrl(s.lightUrl) || badgeUrl(s)})`;
  return safeUrl(s.link) ? `[${img}](${destination(s.link)})` : img;
}
export function widget(s) {
  const img = `<img src="${html(safeUrl(s.image))}" alt="${html(s.alt)}">`;
  if (s.align === "center")
    return `<p align="center">${safeUrl(s.link) ? `<a href="${html(safeUrl(s.link))}">${img}</a>` : img}</p>`;
  const md = `![${text(s.alt)}](${destination(s.image)})`;
  return safeUrl(s.link) ? `[${md}](${destination(s.link)})` : md;
}
export function social(s) {
  const links = (s.items || []).filter((i) => safeUrl(i.url));
  if (s.style === "footer")
    return `<p align="center">${links.map((i) => `<a href="${html(safeUrl(i.url))}">${html(i.name)}</a>`).join(" · ")}</p>`;
  return links
    .map((i) =>
      s.style === "links"
        ? `[${text(i.name)}](${destination(i.url)})`
        : badge({
            label: i.name,
            logo: i.logo || i.name.toLowerCase(),
            color: "30363d",
            link: i.url,
          }),
    )
    .join(" ");
}
export function project(s) {
  const title = `${s.icon || ""} ${s.name || "Untitled project"}`.trim();
  const links = [
    ["Project", s.url],
    ["Source", s.github],
    ["Live demo", s.demo],
    ...(s.links || []).map((i) => [i.name, i.url]),
  ].filter(([, u]) => safeUrl(u));
  if (s.layout === "card")
    return `<table><tr><td>\n<h3>${html(title)}</h3>\n<p>${html(s.subtitle)}</p>\n<p>${html(s.description)}</p>\n${safeUrl(s.image) ? `<img src="${html(safeUrl(s.image))}" alt="${html(s.name)} screenshot" width="480">` : ""}\n<ul>${(
      s.highlights || ""
    )
      .split("\n")
      .filter(Boolean)
      .map((h) => `<li>${html(h)}</li>`)
      .join(
        "",
      )}</ul>\n<p>${html(s.stack)}</p>\n<p>${links.map(([n, u]) => `<a href="${html(safeUrl(u))}">${html(n)}</a>`).join(" · ")}</p>\n</td></tr></table>\n\n${s.status || ""}`;
  const head = `### ${safeUrl(s.url) ? `[${text(title)}](${destination(s.url)})` : text(title)}\n\n${text(s.subtitle)}\n\n`;
  if (s.layout === "compact") return head + text(s.stack);
  return (
    head +
    [
      s.description,
      safeUrl(s.image)
        ? `![${text(s.name)} screenshot](${destination(s.image)})`
        : "",
      (s.highlights || "")
        .split("\n")
        .filter(Boolean)
        .map((h) => `- ${h}`)
        .join("\n"),
      s.stack ? `**Built with:** ${text(s.stack)}` : "",
      links.map(([n, u]) => `[${text(n)}](${destination(u)})`).join(" · "),
      s.status,
    ]
      .filter(Boolean)
      .join("\n\n")
  );
}
export function stack(s) {
  const groups = {};
  for (const item of s.items || [])
    (groups[s.headings ? item.category || "Other" : ""] ||= []).push(item);
  return Object.entries(groups)
    .map(
      ([category, items]) =>
        (category ? `### ${text(category)}\n\n` : "") +
        items
          .map((i) =>
            s.style === "text"
              ? text(i.name)
              : s.style === "chips"
                ? `<code>${html(i.name)}</code>`
                : badge({ ...i, label: i.name }),
          )
          .join(s.style === "text" ? ", " : " "),
    )
    .join("\n\n");
}
export function serializeBlock({ type, settings: s }) {
  switch (type) {
    case "hero":
      return `# ${text(s.name || "Your Name")}\n\n${s.subtitle || ""}`;
    case "badge":
      return badge(s);
    case "badges":
      return (
        (s.title ? `## ${text(s.title)}\n\n` : "") +
        (s.items || []).map(badge).join(" ")
      );
    case "stack":
      return `## Tech Stack\n\n${stack(s)}`;
    case "social":
    case "contact":
      return social(s);
    case "projects":
      return `## ${text(s.title || "Selected Projects")}\n\n${(s.items || []).map(project).join("\n\n")}`;
    case "widget":
      return widget(s);
    case "picture":
      return picture(s);
    case "divider":
      return "---";
    case "custom":
      return s.markdown || "";
    default:
      return `## ${text(s.title || "About Me")}\n\n${s.body || ""}`;
  }
}
export const serializeBlocks = (blocks) =>
  blocks
    .map((b, i) => (i ? (b.separator ?? "\n\n") : "") + serializeBlock(b))
    .join("");
export const createBlock = (type, settings = {}) => ({
  id: crypto.randomUUID(),
  type,
  settings,
});
