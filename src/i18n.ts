import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import translation files
import en from './locales/en.json';
import fr from './locales/fr.json';
import es from './locales/es.json';
import ar from './locales/ar.json';
import ha from './locales/ha.json';
import yo from './locales/yo.json';

const resources = {
  en: { translation: en },
  fr: { translation: fr },
  es: { translation: es },
  ar: { translation: ar },
  ha: { translation: ha },
  yo: { translation: yo },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en', // default language
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;