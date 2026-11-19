// P9 tests: Scribe voice parsing in English, Hindi and Kannada.
// The parser is pure (no database), so these run fast and cover the words a
// jeweller actually says beside the scale: weight, purity, wastage, wedding
// flag and a due date.
import { describe, expect, it } from "vitest";
import { normaliseScribeNumbers, scribeParse } from "@/lib/tola";

function dueDayMonth(iso: string | undefined) {
  expect(iso).toBeDefined();
  const d = new Date(iso as string);
  return { day: d.getDate(), month: d.getMonth() };
}

function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

describe("Scribe number normalisation", () => {
  it("converts Devanagari and Kannada digits to ASCII", () => {
    expect(normaliseScribeNumbers("२५.४ ग्राम")).toBe("25.4 ग्राम");
    expect(normaliseScribeNumbers("೨೫.೪ ಗ್ರಾಂ")).toBe("25.4 ಗ್ರಾಂ");
  });

  it("converts Hindi and Kannada number words", () => {
    expect(normaliseScribeNumbers("पच्चीस ग्राम")).toBe("25 ग्राम");
    expect(normaliseScribeNumbers("ಇಪ್ಪತ್ತೈದು ಗ್ರಾಂ")).toBe("25 ಗ್ರಾಂ");
  });
});

describe("scribeParse · English", () => {
  it("reads the jeweller's demo sentence", () => {
    const p = scribeParse(
      "Ravi Kumar: 25.4 grams 22K necklace set, wastage 3, due 12 Nov, wedding order"
    );
    expect(p.weight).toBe(25.4);
    expect(p.purity).toBe("22K");
    expect(p.wastage).toBe(3);
    expect(p.wedding).toBe(true);
    expect(p.job).toBe("necklace set");
    expect(dueDayMonth(p.due)).toEqual({ day: 12, month: 10 });
  });

  it("reads a relative due date ('in 5 days')", () => {
    const p = scribeParse("14 grams 18K ring set, wastage 3, in 5 days");
    const want = addDays(new Date(), 5);
    expect(dueDayMonth(p.due)).toEqual({ day: want.getDate(), month: want.getMonth() });
  });

  it("reads carat purity and comma decimals", () => {
    const p = scribeParse("12,5 grams 24 carat bangle set");
    expect(p.weight).toBe(12.5);
    expect(p.purity).toBe("24K");
    expect(p.wedding).toBe(false);
  });

  it("returns empty fields when nothing was said", () => {
    const p = scribeParse("just checking the scale");
    expect(p.weight).toBeUndefined();
    expect(p.purity).toBeUndefined();
    expect(p.due).toBeUndefined();
    expect(p.wedding).toBe(false);
  });
});

describe("scribeParse · Hindi", () => {
  it("reads Devanagari digits with the Hindi gram unit", () => {
    const p = scribeParse("२५.४ ग्राम २२ के हार सेट");
    expect(p.weight).toBe(25.4);
    expect(p.purity).toBe("22K");
  });

  it("reads a Hindi number word for weight", () => {
    expect(scribeParse("पच्चीस ग्राम २२ के पेंडेंट").weight).toBe(25);
    expect(scribeParse("बारह ग्राम १८ के").weight).toBe(12);
  });

  it("reads 'ग्रा' and 'ग्राम्स' as grams", () => {
    expect(scribeParse("१२ ग्रा २२ के").weight).toBe(12);
    expect(scribeParse("15 ग्राम्स 18 के").weight).toBe(15);
  });

  it("reads a Hindi due date, wedding flag and wastage together", () => {
    const p = scribeParse(
      "पच्चीस ग्राम २२ के नेकलेस सेट, वेस्टेज ३, शादी, ५ दिन में"
    );
    expect(p.weight).toBe(25);
    expect(p.purity).toBe("22K");
    expect(p.wastage).toBe(3);
    expect(p.wedding).toBe(true);
    const want = addDays(new Date(), 5);
    expect(dueDayMonth(p.due)).toEqual({ day: want.getDate(), month: want.getMonth() });
  });

  it("reads a Hindi month name (१२ नवंबर)", () => {
    const p = scribeParse("१२ नवंबर को शादी का हार, २० ग्राम २२ के");
    expect(p.wedding).toBe(true);
    expect(p.weight).toBe(20);
    expect(dueDayMonth(p.due)).toEqual({ day: 12, month: 10 });
  });

  it("recognises विवाह and a Hindi carat purity", () => {
    const p = scribeParse("१८ कैरेट, १० ग्राम, विवाह");
    expect(p.purity).toBe("18K");
    expect(p.weight).toBe(10);
    expect(p.wedding).toBe(true);
  });
});

describe("scribeParse · Kannada", () => {
  it("reads Kannada digits with the Kannada gram unit", () => {
    const p = scribeParse("೨೫.೪ ಗ್ರಾಂ ೨೨ ಕೆ ಕಂಠಹಾರ");
    expect(p.weight).toBe(25.4);
    expect(p.purity).toBe("22K");
  });

  it("reads a Kannada number word for weight", () => {
    expect(scribeParse("ಇಪ್ಪತ್ತೈದು ಗ್ರಾಂ ೨೨ ಕೆ").weight).toBe(25);
    expect(scribeParse("ಹತ್ತು ಗ್ರಾಂ ೧೮ ಕೆ").weight).toBe(10);
  });

  it("reads a Kannada due date, wedding flag and wastage together", () => {
    const p = scribeParse(
      "ಇಪ್ಪತ್ತೈದು ಗ್ರಾಂ ೨೨ ಕೆ ಕಂಠಹಾರ, ವೇಸ್ಟೇಜ್ ೩, ಮದುವೆ, ೫ ದಿನಗಳಲ್ಲಿ"
    );
    expect(p.weight).toBe(25);
    expect(p.purity).toBe("22K");
    expect(p.wastage).toBe(3);
    expect(p.wedding).toBe(true);
    const want = addDays(new Date(), 5);
    expect(dueDayMonth(p.due)).toEqual({ day: want.getDate(), month: want.getMonth() });
  });

  it("reads a Kannada month name (೧೨ ನವೆಂಬರ್)", () => {
    const p = scribeParse("೧೨ ನವೆಂಬರ್, ೨೦ ಗ್ರಾಂ ೨೨ ಕೆ");
    expect(p.weight).toBe(20);
    expect(dueDayMonth(p.due)).toEqual({ day: 12, month: 10 });
  });

  it("recognises ವಿವಾಹ and a Kannada carat purity", () => {
    const p = scribeParse("೨೪ ಕ್ಯಾರೆಟ್, ೫ ಗ್ರಾಂ, ವಿವಾಹ");
    expect(p.purity).toBe("24K");
    expect(p.weight).toBe(5);
    expect(p.wedding).toBe(true);
  });
});
