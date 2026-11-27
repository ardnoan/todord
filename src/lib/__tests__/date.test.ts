import { describe, expect, it } from "vitest";
import { formatLocalDateString, getLocalDateString } from "../date";

describe("getLocalDateString", () => {
  it("formats local midnight to 06:59 without shifting to previous UTC day", () => {
    // Simulate local time 2026-11-27 00:30:00 (in WIB UTC+7, UTC is 2026-11-26 17:30:00Z)
    const earlyMorningLocal = new Date(2026, 10, 27, 0, 30, 0);
    expect(getLocalDateString(earlyMorningLocal)).toBe("2026-11-27");

    const sixFiftyNineLocal = new Date(2026, 10, 27, 6, 59, 59);
    expect(formatLocalDateString(sixFiftyNineLocal)).toBe("2026-11-27");
  });

  it("pads single-digit month and day with leading zeros", () => {
    const janFive = new Date(2026, 0, 5, 3, 15, 0);
    expect(getLocalDateString(janFive)).toBe("2026-01-05");
  });
});
