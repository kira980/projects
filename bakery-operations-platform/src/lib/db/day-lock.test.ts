import { describe, it, expect } from "vitest";
import {
  localInstantToday,
  businessDayOf,
  shiftDayOf,
  jerusalemDayRange,
  shiftDayRange,
} from "./day-lock";

/** Israel-local date + HH:MM of an instant, for readable assertions. */
const at = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));

describe("localInstantToday", () => {
  // 2026-07-28 10:00 Israel time (UTC+3 in summer).
  const morning = Date.parse("2026-07-28T07:00:00Z");

  it("uses today when the time has already passed", () => {
    expect(at(localInstantToday("08:30", morning)!)).toBe("28/07/2026, 08:30");
  });

  it("refuses a time that has not arrived yet, rather than guessing yesterday", () => {
    // The old behaviour silently returned yesterday's 22:00, which filed a
    // shift a full day early whenever a manager typed the scheduled start a
    // few minutes ahead of the clock.
    expect(localInstantToday("22:00", morning)).toBeNull();
    expect(localInstantToday("10:01", morning)).toBeNull();
  });

  it("never returns a future instant", () => {
    for (const t of ["00:00", "03:59", "04:00", "09:59", "10:00", "23:59"]) {
      const resolved = localInstantToday(t, morning);
      if (resolved) expect(Date.parse(resolved)).toBeLessThanOrEqual(morning);
    }
  });

  it("is exact across a DST boundary", () => {
    // Israel leaves DST on 2026-10-25 (clocks go back at 02:00).
    const afterFallBack = Date.parse("2026-10-26T08:00:00Z"); // 10:00, UTC+2
    expect(at(localInstantToday("07:00", afterFallBack)!)).toBe("26/10/2026, 07:00");
  });
});

describe("businessDayOf — the money day, ending at 02:00", () => {
  it("keeps a trading night whole: 01:10 still closes the night before", () => {
    // 01:10 on the 15th Israel time.
    expect(businessDayOf("2026-08-14T22:10:00Z")).toBe("2026-08-14");
  });

  it("rolls over at 02:00", () => {
    // 01:59 and 02:01 on the 15th Israel time (UTC+3).
    expect(businessDayOf("2026-08-14T22:59:00Z")).toBe("2026-08-14");
    expect(businessDayOf("2026-08-14T23:01:00Z")).toBe("2026-08-15");
  });

  it("covers a full 24 hours from 02:00", () => {
    const { start, end } = jerusalemDayRange("2026-08-14");
    expect(at(start)).toBe("14/08/2026, 02:00");
    expect(at(end)).toBe("15/08/2026, 02:00");
  });
});

describe("shiftDayOf — the shift day, 21:00 onward is tomorrow", () => {
  it("files the morning crew on their own day", () => {
    // 02:55 and 03:35 on the 15th — the bakers' start.
    expect(shiftDayOf("2026-08-14T23:55:00Z")).toBe("2026-08-15");
    expect(shiftDayOf("2026-08-15T00:35:00Z")).toBe("2026-08-15");
  });

  it("files an after-midnight start on the day it runs through", () => {
    // 00:20 on the 10th.
    expect(shiftDayOf("2026-08-09T21:20:00Z")).toBe("2026-08-10");
  });

  it("keeps the evening crew on the evening they came in", () => {
    // 18:25 on the 14th.
    expect(shiftDayOf("2026-08-14T15:25:00Z")).toBe("2026-08-14");
    // 20:59 — still the same day.
    expect(shiftDayOf("2026-08-14T17:59:00Z")).toBe("2026-08-14");
  });

  it("moves a clock-in from 21:00 onward to the next day", () => {
    // 21:00 and 22:54 on the 2nd.
    expect(shiftDayOf("2026-08-02T18:00:00Z")).toBe("2026-08-03");
    expect(shiftDayOf("2026-08-02T19:54:00Z")).toBe("2026-08-03");
  });

  it("covers 21:00 the evening before to 21:00 on the day", () => {
    const { start, end } = shiftDayRange("2026-08-14");
    expect(at(start)).toBe("13/08/2026, 21:00");
    expect(at(end)).toBe("14/08/2026, 21:00");
  });

  it("agrees with shiftDayRange on both edges", () => {
    const date = "2026-08-14";
    const { start, end } = shiftDayRange(date);
    expect(shiftDayOf(start)).toBe(date);
    expect(shiftDayOf(new Date(Date.parse(end) - 60_000).toISOString())).toBe(date);
    expect(shiftDayOf(end)).not.toBe(date);
  });
});
