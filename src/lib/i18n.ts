// P12 — English, Hindi and Kannada copy for the core ledger terms.
// Dictionaries are pure data so they can be parity-tested without React; the
// useTranslation hook lives in components/tola/language-switcher.tsx.

export const LANGUAGES = ["en", "hi", "kn"] as const;
export type Language = (typeof LANGUAGES)[number];

export const LANGUAGE_OPTIONS: Array<{ id: Language; label: string; short: string }> = [
  { id: "en", label: "English", short: "EN" },
  { id: "hi", label: "हिंदी", short: "हिंदी" },
  { id: "kn", label: "ಕನ್ನಡ", short: "ಕನ್ನಡ" },
];

const en = {
  "app.name": "Tola",
  "app.tagline": "One shared gold record. Nothing changes without both taps.",
  "app.loading": "Opening the shared record…",

  "nav.overview": "Overview",
  "nav.slips": "Gold slips",
  "nav.issue": "Issue gold",
  "nav.karigars": "Karigars",
  "nav.agents": "AI agents",
  "nav.messages": "Message log",
  "nav.ledger": "Ledger",

  "action.karigarPhone": "Karigar's phone",
  "action.website": "Website",
  "action.resetDemo": "Reset demo",
  "action.syncNow": "Sync now",
  "action.tryAgain": "Try again",
  "action.issueGold": "+ Issue gold",

  "common.jeweller": "Jeweller",
  "common.karigar": "Karigar",
  "common.goldSlip": "Gold slip",
  "common.issue": "Issue",
  "common.return": "Return",
  "common.settle": "Settle",
  "common.approved": "Approved",
  "common.pending": "Pending",
  "common.dueDate": "Due date",
  "common.weight": "Weight",
  "common.purity": "Purity",
  "common.job": "Job",
  "common.wastage": "Wastage",
  "common.wedding": "Wedding",
  "common.amount": "Amount",
  "common.status": "Status",
  "common.today": "Today",
  "common.overdue": "Overdue",
  "common.daysLeft": "{days} days left",

  "dash.title": "One dashboard: every karigar, every open order",
  "dash.goldWithKarigars": "Gold with karigars",
  "dash.openSlips": "Open slips",
  "dash.dueSoon": "Due within 7 days",
  "dash.daysToPay": "Days to pay a karigar",
  "dash.openDisputes": "Open disputes",
  "dash.watcher": "Watcher · what needs you today",
  "dash.balances": "Live gold balance with each karigar",
  "dash.latestLedger": "Latest entries in the shared ledger",

  "issue.title": "Weigh, snap the scale, fill the slip",
  "issue.subtitle":
    "The weight can come from a photo of the scale, or from speech in English, Hindi or Kannada. Check the confirmation card before it fills the slip.",

  "karigar.title": "The karigar's side",
  "karigar.viewingAs": "You are viewing as:",
  "karigar.back": "Jeweller dashboard",
  "karigar.balance": "Gold in hand",
  "karigar.openSlips": "Open slips",

  "offline.title": "Offline: {count} actions waiting to sync",
  "offline.titleOne": "Offline: 1 action waiting to sync",
  "offline.back": "Back online: {count} actions waiting to sync",
  "offline.backOne": "Back online: 1 action waiting to sync",
  "offline.savedLocal": "Changes are saved on this phone and sync when signal returns.",
  "offline.tapsNeedConnection": "Tap actions still need a connection.",
  "offline.sameKey": "The queue syncs with the same key, so nothing is applied twice.",

  "lang.switch": "Language",
  "tap.needsConnection": "This tap needs a connection.",
} as const;

export type TranslationKey = keyof typeof en;

const hi: Record<TranslationKey, string> = {
  "app.name": "Tola",
  "app.tagline": "एक साझा सोने का रिकॉर्ड। दोनों की सहमति के बिना कुछ नहीं बदलता।",
  "app.loading": "साझा रिकॉर्ड खुल रहा है…",

  "nav.overview": "अवलोकन",
  "nav.slips": "सोने की पर्चियाँ",
  "nav.issue": "सोना जारी करें",
  "nav.karigars": "कारीगर",
  "nav.agents": "एआई एजेंट",
  "nav.messages": "संदेश लॉग",
  "nav.ledger": "बहीखाता",

  "action.karigarPhone": "कारीगर का फ़ोन",
  "action.website": "वेबसाइट",
  "action.resetDemo": "डेमो रीसेट करें",
  "action.syncNow": "अभी सिंक करें",
  "action.tryAgain": "फिर कोशिश करें",
  "action.issueGold": "+ सोना जारी करें",

  "common.jeweller": "जौहरी",
  "common.karigar": "कारीगर",
  "common.goldSlip": "सोने की पर्ची",
  "common.issue": "जारी करें",
  "common.return": "वापसी",
  "common.settle": "निपटान",
  "common.approved": "स्वीकृत",
  "common.pending": "लंबित",
  "common.dueDate": "देय तिथि",
  "common.weight": "वज़न",
  "common.purity": "शुद्धता",
  "common.job": "काम",
  "common.wastage": "क्षय",
  "common.wedding": "शादी",
  "common.amount": "राशि",
  "common.status": "स्थिति",
  "common.today": "आज",
  "common.overdue": "अतिदेय",
  "common.daysLeft": "{days} दिन बाकी",

  "dash.title": "एक डैशबोर्ड: हर कारीगर, हर खुला ऑर्डर",
  "dash.goldWithKarigars": "कारीगरों के पास सोना",
  "dash.openSlips": "खुली पर्चियाँ",
  "dash.dueSoon": "7 दिनों में देय",
  "dash.daysToPay": "कारीगर को भुगतान के दिन",
  "dash.openDisputes": "खुले विवाद",
  "dash.watcher": "वॉचर · आज क्या ध्यान दें",
  "dash.balances": "हर कारीगर के पास मौजूद सोना",
  "dash.latestLedger": "साझा बहीखाते की ताज़ा प्रविष्टियाँ",

  "issue.title": "तौलें, स्केल की फ़ोटो लें, पर्ची भरें",
  "issue.subtitle":
    "वज़न स्केल की फ़ोटो से या अंग्रेज़ी, हिंदी या कन्नड़ में बोलकर आ सकता है। पर्ची भरने से पहले पुष्टि कार्ड देखें।",

  "karigar.title": "कारीगर का पक्ष",
  "karigar.viewingAs": "आप देख रहे हैं:",
  "karigar.back": "जौहरी डैशबोर्ड",
  "karigar.balance": "हाथ में सोना",
  "karigar.openSlips": "खुली पर्चियाँ",

  "offline.title": "ऑफ़लाइन: {count} कार्य सिंक के इंतज़ार में",
  "offline.titleOne": "ऑफ़लाइन: 1 कार्य सिंक के इंतज़ार में",
  "offline.back": "फिर ऑनलाइन: {count} कार्य सिंक के इंतज़ार में",
  "offline.backOne": "फिर ऑनलाइन: 1 कार्य सिंक के इंतज़ार में",
  "offline.savedLocal": "बदलाव इस फ़ोन में सहेजे जाते हैं और सिग्नल लौटने पर सिंक होते हैं।",
  "offline.tapsNeedConnection": "टैप क्रियाओं के लिए कनेक्शन ज़रूरी है।",
  "offline.sameKey": "कतार एक ही कुंजी से सिंक होती है, इसलिए कोई क्रिया दो बार नहीं होती।",

  "lang.switch": "भाषा",
  "tap.needsConnection": "इस टैप के लिए कनेक्शन ज़रूरी है।",
};

const kn: Record<TranslationKey, string> = {
  "app.name": "Tola",
  "app.tagline": "ಒಂದೇ ಹಂಚಿದ ಚಿನ್ನದ ದಾಖಲೆ. ಎರಡೂ ಕಡೆಯ ಒಪ್ಪಿಗೆ ಇಲ್ಲದೆ ಏನೂ ಬದಲಾಗುವುದಿಲ್ಲ.",
  "app.loading": "ಹಂಚಿದ ದಾಖಲೆ ತೆರೆಯುತ್ತಿದೆ…",

  "nav.overview": "ಅವಲೋಕನ",
  "nav.slips": "ಚಿನ್ನದ ಚೀಟಿಗಳು",
  "nav.issue": "ಚಿನ್ನ ನೀಡಿ",
  "nav.karigars": "ಕಾರಿಗರ್‌ಗಳು",
  "nav.agents": "ಎಐ ಏಜೆಂಟ್‌ಗಳು",
  "nav.messages": "ಸಂದೇಶ ದಾಖಲೆ",
  "nav.ledger": "ಲೆಡ್ಜರ್",

  "action.karigarPhone": "ಕಾರಿಗರ್ ಫೋನ್",
  "action.website": "ವೆಬ್‌ಸೈಟ್",
  "action.resetDemo": "ಡೆಮೊ ಮರುಹೊಂದಿಸಿ",
  "action.syncNow": "ಈಗ ಸಿಂಕ್ ಮಾಡಿ",
  "action.tryAgain": "ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ",
  "action.issueGold": "+ ಚಿನ್ನ ನೀಡಿ",

  "common.jeweller": "ಆಭರಣ ವ್ಯಾಪಾರಿ",
  "common.karigar": "ಕಾರಿಗರ್",
  "common.goldSlip": "ಚಿನ್ನದ ಚೀಟಿ",
  "common.issue": "ನೀಡಿ",
  "common.return": "ವಾಪಸಾತಿ",
  "common.settle": "ಇತ್ಯರ್ಥ",
  "common.approved": "ಅನುಮೋದಿಸಲಾಗಿದೆ",
  "common.pending": "ಬಾಕಿ",
  "common.dueDate": "ನಿಗದಿತ ದಿನಾಂಕ",
  "common.weight": "ತೂಕ",
  "common.purity": "ಶುದ್ಧತೆ",
  "common.job": "ಕೆಲಸ",
  "common.wastage": "ವೇಸ್ಟೇಜ್",
  "common.wedding": "ಮದುವೆ",
  "common.amount": "ಮೊತ್ತ",
  "common.status": "ಸ್ಥಿತಿ",
  "common.today": "ಇಂದು",
  "common.overdue": "ಗಡುವು ಮೀರಿದೆ",
  "common.daysLeft": "{days} ದಿನ ಬಾಕಿ",

  "dash.title": "ಒಂದು ಡ್ಯಾಶ್‌ಬೋರ್ಡ್: ಪ್ರತಿ ಕಾರಿಗರ್, ಪ್ರತಿ ತೆರೆದ ಆರ್ಡರ್",
  "dash.goldWithKarigars": "ಕಾರಿಗರ್‌ಗಳ ಬಳಿ ಚಿನ್ನ",
  "dash.openSlips": "ತೆರೆದ ಚೀಟಿಗಳು",
  "dash.dueSoon": "7 ದಿನಗಳಲ್ಲಿ ನಿಗದಿತ",
  "dash.daysToPay": "ಕಾರಿಗರ್‌ಗೆ ಪಾವತಿಯ ದಿನಗಳು",
  "dash.openDisputes": "ತೆರೆದ ವಿವಾದಗಳು",
  "dash.watcher": "ವಾಚರ್ · ಇಂದು ಏನು ಗಮನಿಸಬೇಕು",
  "dash.balances": "ಪ್ರತಿ ಕಾರಿಗರ್ ಬಳಿ ಇರುವ ಚಿನ್ನ",
  "dash.latestLedger": "ಹಂಚಿದ ಲೆಡ್ಜರ್‌ನ ಇತ್ತೀಚಿನ ನಮೂದುಗಳು",

  "issue.title": "ತೂಕ ಮಾಡಿ, ಸ್ಕೇಲ್ ಫೋಟೋ ತೆಗೆಯಿರಿ, ಚೀಟಿ ಭರ್ತಿ ಮಾಡಿ",
  "issue.subtitle":
    "ತೂಕವು ಸ್ಕೇಲ್ ಫೋಟೋದಿಂದ ಅಥವಾ ಇಂಗ್ಲಿಷ್, ಹಿಂದಿ ಅಥವಾ ಕನ್ನಡದ ಮಾತಿನಿಂದ ಬರಬಹುದು. ಚೀಟಿ ಭರ್ತಿಯ ಮೊದಲು ದೃಢೀಕರಣ ಕಾರ್ಡ್ ನೋಡಿ.",

  "karigar.title": "ಕಾರಿಗರ್ ಭಾಗ",
  "karigar.viewingAs": "ನೀವು ನೋಡುತ್ತಿರುವುದು:",
  "karigar.back": "ಆಭರಣ ವ್ಯಾಪಾರಿ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್",
  "karigar.balance": "ಕೈಯಲ್ಲಿ ಚಿನ್ನ",
  "karigar.openSlips": "ತೆರೆದ ಚೀಟಿಗಳು",

  "offline.title": "ಆಫ್‌ಲೈನ್: {count} ಕ್ರಿಯೆಗಳು ಸಿಂಕ್‌ಗಾಗಿ ಕಾಯುತ್ತಿವೆ",
  "offline.titleOne": "ಆಫ್‌ಲೈನ್: 1 ಕ್ರಿಯೆ ಸಿಂಕ್‌ಗಾಗಿ ಕಾಯುತ್ತಿದೆ",
  "offline.back": "ಮತ್ತೆ ಆನ್‌ಲೈನ್: {count} ಕ್ರಿಯೆಗಳು ಸಿಂಕ್‌ಗಾಗಿ ಕಾಯುತ್ತಿವೆ",
  "offline.backOne": "ಮತ್ತೆ ಆನ್‌ಲೈನ್: 1 ಕ್ರಿಯೆ ಸಿಂಕ್‌ಗಾಗಿ ಕಾಯುತ್ತಿದೆ",
  "offline.savedLocal": "ಬದಲಾವಣೆಗಳು ಈ ಫೋನ್‌ನಲ್ಲಿ ಉಳಿಯುತ್ತವೆ ಮತ್ತು ಸಿಗ್ನಲ್ ಬಂದಾಗ ಸಿಂಕ್ ಆಗುತ್ತವೆ.",
  "offline.tapsNeedConnection": "ಟ್ಯಾಪ್ ಕ್ರಿಯೆಗಳಿಗೆ ಸಂಪರ್ಕ ಬೇಕು.",
  "offline.sameKey": "ಸರದಿ ಒಂದೇ ಕೀಲಿಯಿಂದ ಸಿಂಕ್ ಆಗುತ್ತದೆ, ಹಾಗಾಗಿ ಯಾವುದೇ ಕ್ರಿಯೆ ಎರಡು ಬಾರಿ ಆಗುವುದಿಲ್ಲ.",

  "lang.switch": "ಭಾಷೆ",
  "tap.needsConnection": "ಈ ಟ್ಯಾಪ್‌ಗೆ ಸಂಪರ್ಕ ಬೇಕು.",
};

export const dictionaries: Record<Language, Record<TranslationKey, string>> = { en, hi, kn };

export const dictionaryKeys = Object.keys(en) as TranslationKey[];

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (LANGUAGES as readonly string[]).includes(value);
}

function withParams(text: string, params?: Record<string, string | number>): string {
  if (!params) return text;
  let out = text;
  for (const [key, value] of Object.entries(params)) {
    out = out.split(`{${key}}`).join(String(value));
  }
  return out;
}

/**
 * Resolve one key, falling back to English (then the key itself) when a
 * translation is missing or empty. Missing keys never blank the UI.
 */
export function translateFrom(
  table: Partial<Record<TranslationKey, string>>,
  fallback: Partial<Record<TranslationKey, string>>,
  key: TranslationKey,
  params?: Record<string, string | number>
): string {
  const text = table[key] || fallback[key] || String(key);
  return withParams(text, params);
}

export function translate(
  language: Language,
  key: TranslationKey,
  params?: Record<string, string | number>
): string {
  return translateFrom(dictionaries[language] ?? en, en, key, params);
}
