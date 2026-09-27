import { marked } from "marked";
import hljs from "highlight.js/lib/common";
import { sanitize } from "./sanitize.js";
marked.use({
  gfm: true,
  renderer: {
    code({ text, lang }) {
      const language = (lang || "").split(" ")[0];
      const value = hljs.getLanguage(language)
        ? hljs.highlight(text, { language }).value
        : text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
      return `<pre><code class="hljs">${value}</code></pre>`;
    },
  },
});
export const render = (markdown) => sanitize(marked.parse(markdown));
