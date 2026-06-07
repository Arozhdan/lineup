import { describe, expect, it } from "vitest";
import { buildSpd, looksLikeIban, spdSafe } from "./spd.js";

describe("spdSafe", () => {
  it("transliterates Cyrillic and strips forbidden characters", () => {
    expect(spdSafe("Хамовники · 5×5", 60)).toBe("KHAMOVNIKI 5X5");
  });

  it("strips Czech diacritics", () => {
    expect(spdSafe("Česká spořitelna", 60)).toBe("CESKA SPORITELNA");
  });

  it("never emits the field delimiter or non-ASCII", () => {
    const s = spdSafe("a*b%cЖ—«test»", 60);
    expect(s).not.toMatch(/[*%«»—]/);
    // eslint-disable-next-line no-control-regex
    expect(s).toMatch(/^[\x20-\x7E]*$/);
  });

  it("caps length", () => {
    expect(spdSafe("A".repeat(100), 35)).toHaveLength(35);
  });
});

describe("buildSpd", () => {
  it("produces a fully ASCII alphanumeric-safe payload", () => {
    const spd = buildSpd({
      iban: "CZ65 0800 0000 1920 0014 5399",
      recipient: "Lineup Praha",
      amount: 350,
      currency: "Kč",
      message: "Хамовники · 5×5",
      vs: 1,
    });
    expect(spd).toBe("SPD*1.0*ACC:CZ6508000000192000145399*AM:350.00*CC:CZK*X-VS:1*RN:LINEUP PRAHA*MSG:KHAMOVNIKI 5X5");
  });

  it("omits AM below 1 and unknown currencies", () => {
    const spd = buildSpd({ iban: "CZ6508000000192000145399", amount: 0, currency: "฿" });
    expect(spd).toBe("SPD*1.0*ACC:CZ6508000000192000145399");
  });
});

describe("looksLikeIban", () => {
  it("accepts valid Czech IBANs", () => {
    expect(looksLikeIban("CZ65 0800 0000 1920 0014 5399")).toBe(true);
  });

  it("rejects checksum failures and garbage", () => {
    expect(looksLikeIban("CZ66 0800 0000 1920 0014 5399")).toBe(false);
    expect(looksLikeIban("40817 0000 0000 4471")).toBe(false);
  });
});
