import { describe, it, expect } from "vitest";
import { monthGrid, monthLabel, shiftDate, shiftMonth } from "./calendar";

describe("shiftMonth", () => {
  it("moves within a year", () => {
    expect(shiftMonth("2026-07", 1)).toBe("2026-08");
    expect(shiftMonth("2026-07", -1)).toBe("2026-06");
  });

  it("crosses year boundaries", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });

  it("moves a whole year at a time", () => {
    expect(shiftMonth("2026-07", 12)).toBe("2027-07");
    expect(shiftMonth("2026-07", -12)).toBe("2025-07");
  });
});

describe("monthGrid", () => {
  it("pads so the 1st sits under its weekday", () => {
    // 2026-07-01 is a Wednesday → index 3 → three leading blanks.
    const cells = monthGrid("2026-07");
    expect(cells.slice(0, 4)).toEqual([null, null, null, "2026-07-01"]);
  });

  it("covers the whole month and nothing more", () => {
    const days = monthGrid("2026-07").filter(Boolean);
    expect(days).toHaveLength(31);
    expect(days.at(0)).toBe("2026-07-01");
    expect(days.at(-1)).toBe("2026-07-31");
  });

  it("gets short months right", () => {
    expect(monthGrid("2026-02").filter(Boolean)).toHaveLength(28);
    expect(monthGrid("2026-04").filter(Boolean)).toHaveLength(30);
  });

  it("gets a leap February right", () => {
    const days = monthGrid("2028-02").filter(Boolean);
    expect(days).toHaveLength(29);
    expect(days.at(-1)).toBe("2028-02-29");
  });

  it("starts a month that begins on Sunday with no padding", () => {
    // 2026-03-01 is a Sunday.
    expect(monthGrid("2026-03")[0]).toBe("2026-03-01");
  });

  it("zero-pads day numbers", () => {
    expect(monthGrid("2026-07")).toContain("2026-07-09");
  });
});

describe("shiftDate", () => {
  it("moves a day either way", () => {
    expect(shiftDate("2026-07-28", 1)).toBe("2026-07-29");
    expect(shiftDate("2026-07-28", -1)).toBe("2026-07-27");
  });

  it("crosses month and year boundaries", () => {
    expect(shiftDate("2026-07-31", 1)).toBe("2026-08-01");
    expect(shiftDate("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("is unaffected by the Israeli DST switch", () => {
    // Clocks go forward on 2026-03-27 and back on 2026-10-25.
    expect(shiftDate("2026-03-27", 1)).toBe("2026-03-28");
    expect(shiftDate("2026-10-25", 1)).toBe("2026-10-26");
    expect(shiftDate("2026-10-25", -1)).toBe("2026-10-24");
  });
});

describe("monthLabel", () => {
  it("reads as Hebrew month and year", () => {
    expect(monthLabel("2026-07")).toBe("יולי 2026");
    expect(monthLabel("2026-01")).toBe("ינואר 2026");
  });
});
