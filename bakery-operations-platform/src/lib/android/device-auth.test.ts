import { describe, it, expect } from "vitest";
import { hashToken, bearerFromRequest, generateDeviceToken } from "./token-util";

describe("android device-auth helpers", () => {
  it("hashToken is deterministic and 64 hex chars", () => {
    const a = hashToken("abc");
    const b = hashToken("abc");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("hashToken differs for different tokens", () => {
    expect(hashToken("abc")).not.toBe(hashToken("abd"));
  });

  it("generated tokens are long and unique", () => {
    const t1 = generateDeviceToken();
    const t2 = generateDeviceToken();
    expect(t1).not.toBe(t2);
    expect(t1.length).toBeGreaterThanOrEqual(40);
  });

  it("bearerFromRequest extracts the token", () => {
    const req = new Request("https://x/api", {
      headers: { authorization: "Bearer my.token.value" },
    });
    expect(bearerFromRequest(req)).toBe("my.token.value");
  });

  it("bearerFromRequest is case-insensitive on the scheme", () => {
    const req = new Request("https://x/api", {
      headers: { authorization: "bearer   spaced.token" },
    });
    expect(bearerFromRequest(req)).toBe("spaced.token");
  });

  it("bearerFromRequest returns null without a bearer header", () => {
    expect(bearerFromRequest(new Request("https://x/api"))).toBeNull();
    const basic = new Request("https://x/api", {
      headers: { authorization: "Basic abc" },
    });
    expect(bearerFromRequest(basic)).toBeNull();
  });
});
