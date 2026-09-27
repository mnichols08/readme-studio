import { describe, it, expect } from "vitest";
import {
  newBanner,
  normalizeBanner,
  bannerStyles,
} from "../src/banners/banner-model.js";
import { renderBanner } from "../src/banners/render-svg.js";
import { bannerFiles, bannerMarkup } from "../src/banners/export.js";
import { builtInThemes } from "../src/themes/built-ins.js";
describe("Local SVG banners", () => {
  it.each(bannerStyles)(
    "generates bounded self-contained %s assets",
    (pattern) => {
      const b = { ...newBanner(), pattern };
      const svg = renderBanner(b);
      const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
      expect(doc.querySelector("parsererror")).toBeNull();
      expect(doc.querySelector("script,foreignObject,image,use")).toBeNull();
      expect(svg.length).toBeLessThan(20000);
      expect(doc.documentElement.getAttribute("width")).toBe("1200");
    },
  );
  it("deterministically reproduces seeded decoration", () => {
    const b = { ...newBanner(), pattern: "constellation" };
    expect(renderBanner(b)).toBe(renderBanner(b));
    expect(renderBanner({ ...b, seed: "different" })).not.toBe(renderBanner(b));
  });
  it("escapes malicious content and preserves Unicode", () => {
    const b = {
      ...newBanner(),
      name: "雪 🌱 <script>bad()</script>",
      subtitle: '" onload="bad()',
      alt: "A & B <svg>",
    };
    const svg = renderBanner(b),
      doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    expect(doc.querySelector("script")).toBeNull();
    expect(doc.querySelector("[onload]")).toBeNull();
    expect(doc.querySelector("parsererror")).toBeNull();
    expect(doc.documentElement.textContent).toContain(
      "雪 🌱 <script>bad()</script>",
    );
  });
  it("exports themed filenames and ordinary picture paths", () => {
    const b = newBanner(builtInThemes[2]);
    const files = bannerFiles(b);
    expect(files.map((f) => f.name)).toEqual([
      "banner-light.svg",
      "banner-dark.svg",
    ]);
    expect(files[0].source).not.toBe(files[1].source);
    expect(bannerMarkup(b)).toContain("assets/banner-dark.svg");
    expect(bannerMarkup({ ...b, themeMode: "light" })).not.toContain(
      "<picture>",
    );
  });
  it("sanitizes filenames consistently with markup", () => {
    const b = { ...newBanner(), filename: "../bad:name.svg" };
    expect(bannerFiles(b)[0].name).not.toMatch(/[/:]/);
    expect(bannerMarkup(b)).toContain(bannerFiles(b)[0].name);
  });
  it.each([
    { width: 99999 },
    { height: 0 },
    { alt: "" },
    { palette: { accent: "url(evil)" } },
    { assetDirectory: "../private" },
    { pattern: "<svg>" },
  ])("rejects unsafe or unusable configuration %j", (changes) =>
    expect(() => normalizeBanner({ ...newBanner(), ...changes })).toThrow(),
  );
});
