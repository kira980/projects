import { describe, it, expect } from "vitest";
import {
  distanceMeters,
  isValidCoords,
  clientIp,
  isAllowedIp,
} from "./geo";

describe("distanceMeters", () => {
  it("is zero for the same point", () => {
    expect(distanceMeters(32.7, 35.3, 32.7, 35.3)).toBe(0);
  });

  it("measures a short hop accurately", () => {
    // 0.001° of latitude is ~111 m anywhere on earth.
    expect(distanceMeters(32.7, 35.3, 32.701, 35.3)).toBeCloseTo(111, 0);
  });

  it("is symmetric", () => {
    const there = distanceMeters(32.7, 35.3, 32.75, 35.35);
    const back = distanceMeters(32.75, 35.35, 32.7, 35.3);
    expect(there).toBeCloseTo(back, 6);
  });

  it("puts a nearby town well outside any sane radius", () => {
    // Two points roughly 10 km apart — far beyond any geofence radius.
    const away = distanceMeters(32.8000, 35.2500, 32.7100, 35.3000);
    expect(away).toBeGreaterThan(5_000);
  });
});

describe("isValidCoords", () => {
  it("accepts a real fix", () => {
    expect(isValidCoords(32.8000, 35.2500)).toBe(true);
  });

  it("rejects the null island a broken sensor reports", () => {
    expect(isValidCoords(0, 0)).toBe(false);
  });

  it("rejects out-of-range, non-finite and non-numeric values", () => {
    expect(isValidCoords(91, 35)).toBe(false);
    expect(isValidCoords(32, 181)).toBe(false);
    expect(isValidCoords(NaN, 35)).toBe(false);
    expect(isValidCoords("32.8", 35)).toBe(false);
    expect(isValidCoords(null, null)).toBe(false);
  });
});

describe("clientIp", () => {
  it("takes the first entry of x-forwarded-for — the client, not a proxy", () => {
    const h = new Headers({ "x-forwarded-for": "84.1.2.3, 10.0.0.1, 10.0.0.2" });
    expect(clientIp(h)).toBe("84.1.2.3");
  });

  it("falls back to x-real-ip", () => {
    expect(clientIp(new Headers({ "x-real-ip": "84.1.2.3" }))).toBe("84.1.2.3");
  });

  it("is null when the platform sent nothing", () => {
    expect(clientIp(new Headers())).toBeNull();
  });
});

describe("isAllowedIp", () => {
  it("passes an address on the list", () => {
    expect(isAllowedIp("84.1.2.3", ["84.1.2.3", "84.9.9.9"])).toBe(true);
  });

  it("refuses an address that is not", () => {
    expect(isAllowedIp("84.1.2.4", ["84.1.2.3"])).toBe(false);
  });

  it("fails closed with no address or an empty list", () => {
    expect(isAllowedIp(null, ["84.1.2.3"])).toBe(false);
    expect(isAllowedIp("84.1.2.3", [])).toBe(false);
    expect(isAllowedIp("84.1.2.3", null)).toBe(false);
  });
});
