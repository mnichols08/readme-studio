import { analyze } from "./compatibility.js";
import { documentSegments } from "./source-context.js";
import { isRelativeUrl, validSourceContext } from "./resolve-urls.js";
import { duplicateWarnings } from "./merge.js";
import { contextResolver } from "../state/import-plan.js";
export function analyzeDraft(draft) {
  const analysis = analyze(draft.markdown),
    warnings = duplicateWarnings(draft.markdown, contextResolver(draft));
  for (const block of draft.blocks || []) {
    if (
      block.type === "projects" &&
      block.settings?.version === 1 &&
      (["card", "two-column"].includes(block.settings.layout) ||
        block.settings.items?.some((p) => p.imagePlacement === "side-by-side"))
    )
      analysis.issues.push({
        category: "Layout",
        message:
          "Project tables may scroll on narrow screens. Preview at mobile width or choose a linear layout.",
      });
  }
  for (const segment of documentSegments(draft)) {
    if (validSourceContext(segment.sourceContext)) continue;
    const a =
      segment.source === draft.markdown ? analysis : analyze(segment.source);
    if (a.images.some((i) => isRelativeUrl(i.url)))
      warnings.push(
        "Relative image cannot be previewed from this local or mixed-source import.",
      );
    if (a.links.some((i) => isRelativeUrl(i.url)))
      warnings.push(
        "Relative repository link has no known source; its destination cannot be opened in preview.",
      );
  }
  return { analysis, warnings: [...new Set(warnings)] };
}
