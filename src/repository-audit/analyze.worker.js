import { classifyReadme } from "./classify.js";
self.onmessage = ({ data: { id, source } }) => {
  try {
    self.postMessage({ id, result: classifyReadme(source) });
  } catch {
    self.postMessage({
      id,
      error:
        "README analysis could not complete. Open the source to review it manually.",
    });
  }
};
