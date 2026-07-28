import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./en.json";

// English only for this deployment.
//
// The other bundles are still on disk and the lazy-loading machinery below
// still works — restoring one is a matter of adding it back to this map and to
// LANGUAGES in the localization page. Until then nothing may switch away from
// English, including a stale value saved in localStorage or on the
// organisation record: the picker no longer offers a way back, and Arabic
// would also flip the whole layout to right-to-left with no way to undo it.
const LANG_LOADERS = {};

/** The only language currently offered. See LANG_LOADERS above. */
export const SUPPORTED_LANGUAGES = ["en"];
export const isSupportedLanguage = (lang) => SUPPORTED_LANGUAGES.includes(lang);

const savedLanguage = isSupportedLanguage(localStorage.getItem("appLanguage"))
  ? localStorage.getItem("appLanguage")
  : "en";

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
  },
  lng: savedLanguage,
  fallbackLng: "en",
  keySeparator: false,
  interpolation: {
    escapeValue: false,
  },
});

// Lazy-load non-English language on startup
if (savedLanguage !== "en" && LANG_LOADERS[savedLanguage]) {
  LANG_LOADERS[savedLanguage]().then((mod) => {
    i18n.addResourceBundle(savedLanguage, "translation", mod.default, true, true);
    i18n.changeLanguage(savedLanguage);
  });
}

/**
 * Load a language bundle on demand. Called by applyLanguage().
 */
export async function loadLanguageBundle(lang) {
  if (lang === "en" || i18n.hasResourceBundle(lang, "translation")) return;
  const loader = LANG_LOADERS[lang];
  if (!loader) return;
  const mod = await loader();
  i18n.addResourceBundle(lang, "translation", mod.default, true, true);
}

export default i18n;
