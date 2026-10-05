import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// Every translation lives under src/i18n/locales/<lang>/<namespace>.json.
// Namespaces are discovered from the filenames, so adding a namespace file is
// enough; nothing here needs to change.
const enModules = import.meta.glob("./locales/en/*.json", { eager: true });
const msModules = import.meta.glob("./locales/ms/*.json", { eager: true });

const buildResources = (modules) => {
  const resources = {};
  for (const path in modules) {
    resources[path.match(/([^/]+)\.json$/)[1]] = modules[path].default ?? modules[path];
  }
  return resources;
};

export const STORAGE_KEY = "qurbi_farmer_lang";
export const SUPPORTED_LANGUAGES = ["ms", "en"];
// Malay is the first language; English is the alternative and the fallback
// for any key not yet translated.
export const DEFAULT_LANGUAGE = "ms";

const storedLanguage = (() => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
})();

const enResources = buildResources(enModules);

i18n.use(initReactI18next).init({
  resources: { en: enResources, ms: buildResources(msModules) },
  lng: SUPPORTED_LANGUAGES.includes(storedLanguage) ? storedLanguage : DEFAULT_LANGUAGE,
  fallbackLng: "en",
  ns: Object.keys(enResources),
  defaultNS: "common",
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

const applyLanguage = (lng) => {
  document.documentElement.lang = lng;
  try {
    localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    // Storage may be unavailable; the session still gets the right language.
  }
};

applyLanguage(i18n.language);
i18n.on("languageChanged", applyLanguage);

export default i18n;
