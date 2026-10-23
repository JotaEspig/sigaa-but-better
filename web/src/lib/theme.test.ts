/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PALETTES } from "./theme";

const css = readFileSync(new URL("../index.css", import.meta.url), "utf8");

describe("palettes", () => {
  it("have unique ids", () => {
    expect(new Set(PALETTES.map((p) => p.id)).size).toBe(PALETTES.length);
  });

  it("have a matching CSS block", () => {
    for (const palette of PALETTES) {
      expect(css, `missing [data-palette="${palette.id}"]`).toContain(`[data-palette="${palette.id}"]`);
    }
  });
});
