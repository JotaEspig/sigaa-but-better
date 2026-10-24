import { describe, expect, it } from "vitest";
import type { Activity, ClassGrades } from "../api/types";
import { classAverage, mergeUpcoming, type ClassStats } from "./classStats";

const grades = (assessments: ClassGrades["assessments"], extra: Partial<ClassGrades> = {}): ClassGrades => ({
  published: true,
  assessments,
  makeup: null,
  result: null,
  absences: null,
  situation: "",
  ...extra,
});

describe("classAverage", () => {
  it("uses the published unit total", () => {
    expect(
      classAverage(
        grades([
          { group: "Unid. 1", label: "AV1", weight: "1", value: 7.2, isUnitTotal: false },
          { group: "Unid. 1", label: "Nota", value: 2.4, isUnitTotal: true },
        ]),
      ),
    ).toBe(2.4);
  });

  it("averages released assessments while the unit is open", () => {
    // Empreendedorismo: A1 and A2 out, A3 and the unit total still empty.
    const avg = classAverage(
      grades([
        { group: "Unid. 1", label: "A1", weight: "10", value: 7.5, isUnitTotal: false },
        { group: "Unid. 1", label: "A2", weight: "10", value: 7.1, isUnitTotal: false },
        { group: "Unid. 1", label: "A3", weight: "10", value: null, isUnitTotal: false },
        { group: "Unid. 1", label: "Nota", value: null, isUnitTotal: true },
      ]),
    );
    expect(avg).toBeCloseTo(7.3);
  });

  it("prefers the final result and ignores unpublished grades", () => {
    expect(classAverage(grades([], { result: 9.3 }))).toBe(9.3);
    expect(classAverage(grades([], { published: false }))).toBeNull();
  });
});

describe("mergeUpcoming", () => {
  const a = (className: string, date: string, title: string, past = false): Activity => ({ className, date, title, kind: "Avaliação", past });
  const stats = (upcoming: Activity[]) => new Map([["x", { upcoming } as ClassStats]]);

  it("adds class assessments the portal missed, soonest first, without duplicates", () => {
    const merged = mergeUpcoming(
      [a("EMPREENDEDORISMO", "2026-11-04", "Trabalho"), a("COMPILADORES", "2026-09-29", "Prova", true)],
      stats([a("EMPREENDEDORISMO", "2026-11-04", "Trabalho (avaliações)"), a("FUNDAMENTOS", "2026-11-23", "Prova 1")]),
    );
    expect(merged.map((m) => m.title)).toEqual(["Trabalho", "Prova 1"]);
  });
});
