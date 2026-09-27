import DOMPurify from "dompurify";
export function sanitize(markup) {
  const clean = DOMPurify.sanitize(markup, {
    ALLOWED_TAGS: [
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "p",
      "br",
      "hr",
      "a",
      "img",
      "picture",
      "source",
      "details",
      "summary",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "ul",
      "ol",
      "li",
      "blockquote",
      "pre",
      "code",
      "em",
      "strong",
      "del",
      "s",
      "kbd",
      "sup",
      "sub",
      "div",
      "span",
      "input",
    ],
    ALLOWED_ATTR: [
      "href",
      "src",
      "srcset",
      "alt",
      "title",
      "width",
      "height",
      "align",
      "media",
      "type",
      "checked",
      "disabled",
      "start",
      "colspan",
      "rowspan",
      "class",
      "open",
    ],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
  });
  const template = document.createElement("template");
  template.innerHTML = clean;
  template.content.querySelectorAll("a").forEach((a) => {
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  });
  template.content.querySelectorAll("input").forEach((i) => {
    if (i.type !== "checkbox") i.remove();
    else i.disabled = true;
  });
  return template.innerHTML;
}
