import { serializeBlock } from "../markdown/serialize.js";

// A section form's edits reach the README only through Save section (or Add
// to README). Export README and Copy Markdown use the saved Source, so they
// ask first rather than leaving unsaved edits out without a word. Saving is
// always the author's explicit choice; nothing here changes a document.

// The Markdown a section would add, or null when its fields cannot produce
// any (the form shows why).
export function sectionMarkdown(block) {
  try {
    return serializeBlock(block);
  } catch {
    return null;
  }
}

// Whether `current` would change the README compared with the section as it
// was opened. Edits that serialize to the same Markdown change nothing in an
// export, so they do not count.
export function unsavedSection(opened, current) {
  return sectionMarkdown(current) !== opened;
}

const verbs = {
  download: { verb: "export", tool: "Export README" },
  copy: { verb: "copy", tool: "Copy Markdown" },
};

// The question asked before `action` (download or copy) runs while a section
// form has unsaved edits. `added` is false for a new section not yet added.
export function unsavedSectionPrompt(action, { title, added = true } = {}) {
  const { verb, tool } = verbs[action] || verbs.download;
  const name = title ? `The ${title} section` : "This section";
  const save = added ? "Save section" : "Add section";
  return {
    heading: "Save your section edits first?",
    body: `${name} has edits that are not in your README yet. ${tool} uses only saved sections.`,
    save: `${save} and ${verb}`,
    skip: `${verb[0].toUpperCase()}${verb.slice(1)} without these edits`,
    keep: "Keep editing",
  };
}
