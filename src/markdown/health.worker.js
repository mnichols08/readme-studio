import { analyzeDraft } from "./health-analysis.js";
self.onmessage = ({ data }) => {
  try {
    self.postMessage({ result: analyzeDraft(data) });
  } catch {
    self.postMessage({ error: true });
  }
};
