import { describe, expect, it } from "vitest";
import { firstName, formatDate, formatDateTime, formatGrade, parseLocal, relativeDays, relativeTime, titleCase } from "./format";
import { blockTimeRange, blocksForDay, sigaaDay } from "./schedule";
import { situationTone } from "./colors";
import type { ClassSummary } from "../api/types";

describe("parseLocal", () => {
  it("parses date-only strings as local midnight (no UTC shift)", () => {
    const d = parseLocal("2026-10-04")!;
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 9, 4, 0]);
  });
  it("parses datetimes", () => {
    const d = parseLocal("2026-10-06T21:53")!;
    expect([d.getDate(), d.getHours(), d.getMinutes()]).toEqual([6, 21, 53]);
  });
  it("rejects garbage", () => {
    expect(parseLocal("06/10/2026")).toBeNull();
  });
});

describe("relativeDays", () => {
  const now = new Date(2026, 9, 21, 23, 59);
  it.each([
    ["2026-10-21", "hoje"],
    ["2026-10-22", "amanhã"],
    ["2026-10-20", "ontem"],
    ["2026-10-24", "em 3 dias"],
    ["2026-10-19", "há 2 dias"],
    ["2026-11-04", "em 14 dias"],
  ])("%s → %s", (input, expected) => {
    expect(relativeDays(input, now)).toBe(expected);
  });
});

describe("formatting", () => {
  it("formats grades with comma decimal", () => {
    expect(formatGrade(9.25)).toBe("9,3");
    expect(formatGrade(10)).toBe("10,0");
    expect(formatGrade(null)).toBe("–");
  });
  it("formats dates in pt-BR", () => {
    expect(formatDate("2026-10-04")).toBe("04/10/2026");
    expect(formatDateTime("2026-10-06T21:53")).toBe("06/10/2026 às 21:53");
  });
  it("formats relative time", () => {
    const now = new Date("2026-10-21T12:10:00Z");
    expect(relativeTime("2026-10-21T12:09:50Z", now)).toBe("agora");
    expect(relativeTime("2026-10-21T12:07:00Z", now)).toBe("há 3 min");
  });
  it("title-cases names", () => {
    expect(titleCase("ALUNO EXEMPLO DA SILVA")).toBe("Aluno Exemplo da Silva");
    expect(titleCase("PROJETO APLICADO I")).toBe("Projeto Aplicado I");
    expect(firstName("ALUNO EXEMPLO DA SILVA")).toBe("Aluno");
  });
});

describe("schedule", () => {
  const cls = (name: string, slots: ClassSummary["slots"]): ClassSummary => ({
    id: name,
    name,
    period: "2026.2",
    location: "",
    schedule: "",
    slots,
    startDate: "",
    endDate: "",
  });
  it("maps JS days to SIGAA codes", () => {
    expect(sigaaDay(new Date(2026, 9, 20))).toBe(3); // terça
  });
  it("groups slots into blocks per day and shift", () => {
    const c = cls("COMPILADORES", [1, 2, 3, 4].map((index) => ({ day: 3, shift: "N" as const, index })));
    const blocks = blocksForDay([c], 3);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.indexes).toEqual([1, 2, 3, 4]);
    expect(blocksForDay([c], 4)).toHaveLength(0);
  });
  it("computes approximate ranges", () => {
    expect(blockTimeRange("N", [1, 2, 3, 4])).toBe("18:30 – 22:00");
  });
});

describe("situationTone", () => {
  it.each([
    ["APROVADO", "success"],
    ["REPROVADO", "danger"],
    ["REPROVADO POR FALTAS", "danger"],
    ["REC", "warning"],
    ["--", "neutral"],
  ])("%s → %s", (s, tone) => {
    expect(situationTone(s)).toBe(tone);
  });
});
