import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SRC_ROOT = join(process.cwd(), "src");
const LEGACY_RESOLVER_PATH = join(
  SRC_ROOT,
  "features/projection/orderResolution.js",
);

function sourceFiles(dir, files = []) {
  readdirSync(dir).forEach((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) sourceFiles(path, files);
    else if (/\.[jt]sx?$/.test(path)) files.push(path);
  });
  return files;
}

describe("legacy order resolver guard", () => {
  it("does not keep or import the old orderResolution module", () => {
    expect(existsSync(LEGACY_RESOLVER_PATH)).toBe(false);
    const offenders = sourceFiles(SRC_ROOT)
      .filter((file) => !file.endsWith("noLegacyResolver.test.js"))
      .filter((file) => readFileSync(file, "utf8").includes("orderResolution"))
      .map((file) => relative(SRC_ROOT, file));
    expect(offenders).toEqual([]);
  });

  it("does not call the old resolveOrderAfterTransaction API", () => {
    const offenders = sourceFiles(SRC_ROOT)
      .filter((file) => !file.endsWith("noLegacyResolver.test.js"))
      .filter((file) =>
        /resolveOrderAfterTransaction\s*\(/.test(readFileSync(file, "utf8")),
      )
      .map((file) => relative(SRC_ROOT, file));
    expect(offenders).toEqual([]);
  });

  it("keeps selectors/buildColumns free from final round-first ordering", () => {
    const selectors = readFileSync(
      join(SRC_ROOT, "features/projection/selectors.js"),
      "utf8",
    );
    const renderPath = selectors.slice(0, selectors.indexOf("export function buildCountersByInstrument"));
    expect(renderPath).not.toMatch(/round-first|appearanceIndex|positionInRound|roundOrder|orderScore|sortByColumnOrder/);
  });
});
