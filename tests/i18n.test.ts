// P12 tests: 100% key parity across English, Hindi and Kannada, plus the
// English fallback that keeps the UI readable if a translation is ever missing.
import { describe, expect, it } from "vitest";
import {
  LANGUAGE_OPTIONS,
  LANGUAGES,
  dictionaries,
  dictionaryKeys,
  isLanguage,
  translate,
  translateFrom,
  type TranslationKey,
} from "@/lib/i18n";

describe("dictionary parity", () => {
  it("has exactly the same keys in en, hi and kn", () => {
    const english = Object.keys(dictionaries.en).sort();

    expect(english.length).toBeGreaterThan(40);
    for (const language of LANGUAGES) {
      expect(Object.keys(dictionaries[language]).sort()).toEqual(english);
    }
  });

  it("has zero empty or placeholder translations", () => {
    for (const language of LANGUAGES) {
      for (const key of dictionaryKeys) {
        const value = dictionaries[language][key];
        expect(value.trim().length, `${language} · ${key}`).toBeGreaterThan(0);
        expect(value).not.toMatch(/TODO|FIXME|\?\?\?/);
      }
    }
  });

  it("actually translates the core terms instead of copying English", () => {
    for (const key of [
      "nav.overview",
      "nav.slips",
      "nav.issue",
      "common.jeweller",
      "common.karigar",
      "common.issue",
      "common.return",
      "common.settle",
      "common.approved",
      "common.pending",
      "common.dueDate",
      "common.weight",
      "common.purity",
      "common.wastage",
      "common.wedding",
      "karigar.balance",
    ] as TranslationKey[]) {
      expect(dictionaries.hi[key], `hi · ${key}`).not.toBe(dictionaries.en[key]);
      expect(dictionaries.kn[key], `kn · ${key}`).not.toBe(dictionaries.en[key]);
    }
  });

  it("keeps proper names and the brand stable", () => {
    expect(dictionaries.hi["app.name"]).toBe("Tola");
    expect(dictionaries.kn["app.name"]).toBe("Tola");
  });
});

describe("language selection", () => {
  it("offers the three switcher labels requested on the slide", () => {
    expect(LANGUAGE_OPTIONS.map((option) => option.short)).toEqual(["EN", "हिंदी", "ಕನ್ನಡ"]);
    expect(LANGUAGE_OPTIONS.map((option) => option.id)).toEqual(["en", "hi", "kn"]);
  });

  it("only accepts known language codes", () => {
    expect(isLanguage("en")).toBe(true);
    expect(isLanguage("hi")).toBe(true);
    expect(isLanguage("kn")).toBe(true);
    expect(isLanguage("ta")).toBe(false);
    expect(isLanguage(null)).toBe(false);
  });
});

describe("translate", () => {
  it("returns the chosen language", () => {
    expect(translate("en", "common.issue")).toBe("Issue");
    expect(translate("hi", "common.issue")).toBe("जारी करें");
    expect(translate("kn", "common.issue")).toBe("ನೀಡಿ");
  });

  it("interpolates counts in every language", () => {
    expect(translate("en", "offline.title", { count: 3 })).toBe(
      "Offline: 3 actions waiting to sync"
    );
    expect(translate("hi", "common.daysLeft", { days: 5 })).toContain("5");
    expect(translate("kn", "common.daysLeft", { days: 5 })).toContain("5");
  });

  it("falls back to English when a translation is missing", () => {
    const missing = translateFrom({}, dictionaries.en, "common.issue");
    expect(missing).toBe(dictionaries.en["common.issue"]);

    const empty = translateFrom({ "common.issue": "" }, dictionaries.en, "common.issue");
    expect(empty).toBe(dictionaries.en["common.issue"]);
  });

  it("falls back to the key itself when even English is missing", () => {
    const unknown = "not.a.real.key" as TranslationKey;
    expect(translateFrom({}, {}, unknown)).toBe("not.a.real.key");
    expect(translate("hi", unknown)).toBe("not.a.real.key");
  });
});
