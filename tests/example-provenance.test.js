import { describe, it, expect } from "vitest";
import {
  exampleMarker,
  inspectExampleMarkers,
  validateExampleProvenance,
} from "../src/documentation/example-provenance.js";
import {
  documentationDefaults,
  serializeDocumentation,
} from "../src/documentation/sections.js";
import "../src/components/example-export-check.js";

describe("example provenance", () => {
  it("serializes exact portable status markers without executing examples", () => {
    const settings = documentationDefaults("doc-testing");
    settings.commands = "npm test";
    settings.exampleProvenance.commands = {
      status: "verified",
      basis: "Matched package.json scripts on 2026-10-23.",
    };
    const source = serializeDocumentation("doc-testing", settings);
    expect(source).toContain(exampleMarker("verified"));
    expect(source).toContain("```sh\nnpm test\n```");
    expect(source).not.toContain(settings.exampleProvenance.commands.basis);
    expect(inspectExampleMarkers(source)).toMatchObject({
      checked: 1,
      counts: { verified: 1, "user-confirmed": 0, placeholder: 0 },
      issues: [],
    });
  });

  it("defaults new code fields to placeholders and validates evidence", () => {
    const settings = documentationDefaults("doc-installation");
    expect(settings.exampleProvenance.command).toEqual({
      status: "placeholder",
      basis: "",
    });
    expect(() =>
      validateExampleProvenance({ status: "verified", basis: "" }),
    ).toThrow(/verification note/i);
    expect(
      validateExampleProvenance({
        status: "user-confirmed",
        basis: "Confirmed by the author.",
      }),
    ).toEqual({
      status: "user-confirmed",
      basis: "Confirmed by the author.",
    });
  });

  it("reports placeholder, malformed and bounded marker reviews", () => {
    const source = [
      exampleMarker("placeholder"),
      "```sh\nnpm publish\n```",
      "<!-- readme-studio-example: invented -->",
      "```text\n<!-- readme-studio-example: placeholder -->\n```",
    ].join("\n");
    const report = inspectExampleMarkers(source);
    expect(report.checked).toBe(2);
    expect(report.counts.placeholder).toBe(1);
    expect(report.issues.map((issue) => issue.kind)).toEqual([
      "placeholder",
      "invalid-marker",
    ]);
    expect(inspectExampleMarkers("x".repeat(800_000)).truncatedSource).toBe(
      true,
    );
  });
});

describe("example export review", () => {
  it("renders inert provenance and keeps continuation explicit", () => {
    const panel = document.createElement("example-export-check");
    panel.configure({
      action: "export",
      snapshot: "source-v1",
      report: {
        checked: 1,
        counts: { verified: 0, "user-confirmed": 0, placeholder: 1 },
        issues: [{ kind: "placeholder", status: "placeholder" }],
        truncatedMarkers: 0,
        truncatedSource: false,
      },
    });
    expect(panel.textContent).toContain("1 placeholder");
    let detail;
    panel.addEventListener(
      "example-export-continue",
      (event) => (detail = event.detail),
    );
    panel.querySelector("button").click();
    expect(detail).toEqual({ snapshot: "source-v1" });
  });
});
