// P5 tests: trade-wide wastage benchmarks, structured fair-wastage verdicts,
// and a copy-lint guard that scans the app for accusatory words.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  BENCHMARK_SOURCE,
  DEFAULT_WASTAGE_BENCHMARKS,
  ensureBenchmarks,
  fairVerdict,
  jobKeyword,
  lookupBenchmark,
  pairBand,
} from "@/lib/tola";

const BENCHMARKS = [
  { keyword: "necklace", minPct: 2.2, maxPct: 4.6, avgPct: 3.4, source: "demo" },
  { keyword: "bangle", minPct: 2.8, maxPct: 4.8, avgPct: 3.7, source: "demo" },
  { keyword: "ring", minPct: 2.0, maxPct: 4.0, avgPct: 3.0, source: "demo" },
];

const FORBIDDEN = /\b(theft|fraud|cheat|cheating|suspicious|thief|steal|stealing)\b/i;

describe("Wastage benchmark lookup", () => {
  it("matches a job to its keyword, case-insensitively", () => {
    expect(jobKeyword("Necklace set", BENCHMARKS)).toBe("necklace");
    expect(jobKeyword("Bangle set (2)", BENCHMARKS)).toBe("bangle");
    expect(jobKeyword("Ring set (2)", BENCHMARKS)).toBe("ring");
    expect(jobKeyword("Pendant", BENCHMARKS)).toBeNull();
  });

  it("returns the benchmark range with its editable source label", () => {
    const b = lookupBenchmark("Anklet pair", DEFAULT_WASTAGE_BENCHMARKS);
    expect(b).not.toBeNull();
    expect(b!.keyword).toBe("anklet");
    expect(b!.minPct).toBe(2.6);
    expect(b!.maxPct).toBe(4.4);
    expect(b!.source).toContain("demo assumption");
  });

  it("ships the five expected keywords", () => {
    expect(DEFAULT_WASTAGE_BENCHMARKS.map((b) => b.keyword)).toEqual([
      "necklace",
      "bangle",
      "ring",
      "anklet",
      "jhumka",
    ]);
  });
});

describe("Pair band", () => {
  it("uses median and quartiles for a settled sample", () => {
    const band = pairBand([2, 3, 4, 5]);
    expect(band.n).toBe(4);
    expect(band.median).toBe(3.5);
    expect(band.q1).toBe(2.75);
    expect(band.q3).toBe(4.25);
    expect(band.min).toBe(2);
    expect(band.max).toBe(5);
    expect(band.avg).toBe(3.5);
  });
});

describe("Structured fair verdicts", () => {
  it("returns ok inside the agreed tolerance", () => {
    const v = fairVerdict({
      job: "Necklace set",
      agreed: 4,
      actual: 4.1,
      history: [3.6, 3.9, 4.2, 4.0],
      benchmarks: BENCHMARKS,
    });
    expect(v.level).toBe("ok");
    expect(v.used).toBe("pair");
    expect(v.pair?.n).toBe(4);
    expect(v.text).toContain("Nothing odd");
    expect(v.evidence).toContain("4.1%");
  });

  it("flags light wastage plainly (returning more than expected)", () => {
    const v = fairVerdict({ job: "Ring set", agreed: 4, actual: 2.5, history: [], benchmarks: BENCHMARKS });
    expect(v.level).toBe("light");
    expect(v.used).toBe("benchmark");
    expect(v.text).toContain("more metal came back");
    expect(v.text).toContain("2.5%");
    expect(v.text).toContain("4%");
  });

  it("flags heavy wastage inside the range", () => {
    const v = fairVerdict({ job: "Necklace set", agreed: 3, actual: 4.2, history: [], benchmarks: BENCHMARKS });
    expect(v.level).toBe("heavy");
    expect(v.text).toContain("4.2%");
  });

  it("flags odd wastage above the usual range, without accusing", () => {
    const v = fairVerdict({ job: "Bangle set", agreed: 3, actual: 6, history: [], benchmarks: BENCHMARKS });
    expect(v.level).toBe("odd");
    expect(v.text).toContain("not an accusation");
    expect(v.evidence).toContain("6%");
  });

  it("says no-history when there is neither history nor a benchmark", () => {
    const v = fairVerdict({ job: "Pendant", agreed: 3, actual: 3.5, history: [] });
    expect(v.level).toBe("no-history");
    expect(v.used).toBe("none");
  });

  it("uses pair history once there are 4+ settled jobs instead of the benchmark", () => {
    const v = fairVerdict({
      job: "Necklace set",
      agreed: 3,
      actual: 3.4,
      history: [3.2, 3.3, 3.4, 3.5],
      benchmarks: BENCHMARKS,
    });
    expect(v.used).toBe("pair");
    expect(v.pair?.n).toBe(4);
    expect(v.text).toContain("settled jobs");
  });

  it("keeps every verdict text and evidence free of accusatory words", () => {
    const samples: Array<[number, number, number[]]> = [
      [4, 4, [3.9, 4, 4.1, 4.05]],
      [4, 2, []],
      [3, 4.2, []],
      [3, 7, []],
      [3, 3.5, []],
    ];
    for (const [agreed, actual, history] of samples) {
      const v = fairVerdict({ job: "Necklace set", agreed, actual, history, benchmarks: BENCHMARKS });
      expect(v.text).not.toMatch(FORBIDDEN);
      expect(v.evidence).not.toMatch(FORBIDDEN);
    }
  });
});

describe("Benchmark rows in the database", () => {
  let dir = "";
  let client: PrismaClient;

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "tola-fair-"));
    const url = `file:${path.join(dir, "fair.db").replace(/\\/g, "/")}`;
    execFileSync(
      process.execPath,
      ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate", "--accept-data-loss"],
      { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" }
    );
    client = new PrismaClient({ datasources: { db: { url } } });
  }, 120_000);

  afterAll(async () => {
    await client?.$disconnect();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  });

  it("seeds the five benchmarks with the editable demo source", async () => {
    await ensureBenchmarks(client);
    const rows = await client.wastageBenchmark.findMany({ orderBy: { keyword: "asc" } });
    expect(rows.map((r) => r.keyword)).toEqual(["anklet", "bangle", "jhumka", "necklace", "ring"]);
    for (const r of rows) expect(r.source).toBe(BENCHMARK_SOURCE);
  });

  it("does not overwrite an edited benchmark on re-seed (editable)", async () => {
    await client.wastageBenchmark.update({ where: { keyword: "necklace" }, data: { minPct: 1.1 } });
    await ensureBenchmarks(client);
    const row = await client.wastageBenchmark.findUnique({ where: { keyword: "necklace" } });
    expect(row!.minPct).toBe(1.1);
  });
});

describe("Copy lint: no accusatory words in app code or UI copy", () => {
  function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...walk(p));
      else if (/\.(ts|tsx)$/.test(entry.name)) out.push(p);
    }
    return out;
  }

  it("finds zero forbidden words under src/", () => {
    const root = path.resolve(process.cwd(), "src");
    const files = walk(root);
    expect(files.length).toBeGreaterThan(0);
    const offenders = files.filter((f) => FORBIDDEN.test(fs.readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
