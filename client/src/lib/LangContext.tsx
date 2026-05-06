/**
 * LangContext — provides language state and t() function to the whole app.
 */
import { createContext, useState, useCallback } from "react";
import type { ReactNode } from "react";
import { translate, type Lang, type TranslationKey } from "./i18n";

interface LangContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TranslationKey, vars?: Record<string, string>) => string;
}

export const LangContext = createContext<LangContextType>({
  lang: "en",
  setLang: () => {},
  t: (key) => key,
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    // Update html lang attribute for accessibility
    document.documentElement.setAttribute("lang", l);
  }, []);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string>) => translate(lang, key, vars),
    [lang]
  );

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}
