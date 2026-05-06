/**
 * useLang — Language context hook for Care Net Portal
 *
 * Wraps the LangContext. Use in any component:
 *   const { t, lang, setLang } = useLang();
 */
import { useContext } from "react";
import { LangContext } from "./LangContext";

export { LangContext };
export const useLang = () => useContext(LangContext);
