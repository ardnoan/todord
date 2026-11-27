import { describe, expect, it } from "vitest";
import {
  formatIdrNumber,
  parseIdrNumber,
} from "../../../components/finance/CurrencyInput";

describe("formatIdrNumber and parseIdrNumber", () => {
  it("formats positive and negative Indonesian numbers with thousand dots and decimal commas", () => {
    expect(formatIdrNumber(1000000)).toBe("1.000.000");
    expect(formatIdrNumber(12500.5)).toBe("12.500,5");
    expect(formatIdrNumber(-50000, true)).toBe("-50.000");
    expect(formatIdrNumber(-50000, false)).toBe("50.000");
    expect(formatIdrNumber("")).toBe("");
  });

  it("parses Indonesian formatted strings back into finite numbers", () => {
    expect(parseIdrNumber("1.000.000")).toBe(1000000);
    expect(parseIdrNumber("12.500,75")).toBe(12500.75);
    expect(parseIdrNumber("-50.000")).toBe(-50000);
    expect(Number.isNaN(parseIdrNumber(""))).toBe(true);
    expect(Number.isNaN(parseIdrNumber("-"))).toBe(true);
  });
});
