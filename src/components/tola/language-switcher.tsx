"use client";

import * as React from "react";
import {
  LANGUAGE_OPTIONS,
  isLanguage,
  translate,
  type Language,
  type TranslationKey,
} from "@/lib/i18n";

// Language is a small external store so every mounted screen (dashboard,
// karigar phone, offline banner) switches together, and the choice survives
// a reload through localStorage.
const STORAGE_KEY = "tola.language";

let currentLanguage: Language = "en";
let hydrated = false;
const listeners = new Set<() => void>();

function readStoredLanguage(): Language {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return isLanguage(raw) ? raw : "en";
  } catch {
    return "en";
  }
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  currentLanguage = readStoredLanguage();
  if (typeof document !== "undefined") document.documentElement.lang = currentLanguage;
}

function subscribeLanguage(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getLanguageSnapshot(): Language {
  if (typeof window === "undefined") return "en";
  ensureHydrated();
  return currentLanguage;
}

/** SSR and the hydration pass always start in English. */
export function getLanguageServerSnapshot(): Language {
  return "en";
}

export function setLanguage(language: Language) {
  currentLanguage = language;
  hydrated = true;
  try {
    window.localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Private mode can block storage; the session still switches.
  }
  if (typeof document !== "undefined") document.documentElement.lang = language;
  listeners.forEach((listener) => listener());
}

export function useTranslation() {
  const language = React.useSyncExternalStore(
    subscribeLanguage,
    getLanguageSnapshot,
    getLanguageServerSnapshot
  );
  const t = React.useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) =>
      translate(language, key, params),
    [language]
  );
  return { language, lang: language, setLanguage, t };
}

/** EN / हिंदी / ಕನ್ನಡ — each target is at least 48×48 px. */
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { language, setLanguage: choose, t } = useTranslation();

  return (
    <div
      role="group"
      aria-label={t("lang.switch")}
      className={`flex items-center gap-1 ${className}`}
    >
      {LANGUAGE_OPTIONS.map((option) => {
        const active = language === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => choose(option.id)}
            aria-pressed={active}
            aria-label={option.label}
            title={option.label}
            className={`min-h-12 min-w-12 border-[2.5px] px-2 py-1 font-sketch text-sm font-bold sketch-c transition-colors ${
              active
                ? "border-ink bg-[var(--marker-yellow)] text-ink"
                : "border-ink-soft/60 bg-white text-ink-soft hover:border-ink hover:text-ink"
            }`}
          >
            {option.short}
          </button>
        );
      })}
    </div>
  );
}
