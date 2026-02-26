"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
// Import i18n as a stable singleton — NOT from useTranslation() which causes re-renders
import i18n from '../i18n';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

interface TranslationContextType {
  currentLanguage: string;
  changeLanguage: (language: string) => Promise<void>;
  isLoading: boolean;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

const LANGUAGE_MAP: Record<string, string> = {
  'English': 'en',
  'Hausa': 'ha',
  'Yoruba': 'yo',
  'Igbo': 'ig',
  'French': 'fr',
  'Spanish': 'es',
  'Arabic': 'ar',
  'Pidgin': 'pcm',
  'Nigerian Pidgin': 'pcm'
};

const getLanguageCode = (lang: string): string => {
  if (!lang) return 'en';
  // Already a known code like 'en', 'ha', 'yo', 'ig', 'pcm'
  if (Object.values(LANGUAGE_MAP).includes(lang.toLowerCase())) return lang.toLowerCase();
  // Full name like 'English' or 'Hausa'
  if (LANGUAGE_MAP[lang]) return LANGUAGE_MAP[lang];
  // Case-insensitive name match
  for (const [key, value] of Object.entries(LANGUAGE_MAP)) {
    if (key.toLowerCase() === lang.toLowerCase()) return value;
  }
  return 'en';
};

export const useTranslationContext = () => {
  const context = useContext(TranslationContext);
  if (!context) throw new Error('useTranslationContext must be used within a TranslationProvider');
  return context;
};

interface TranslationProviderProps {
  children: React.ReactNode;
}

export const TranslationProvider: React.FC<TranslationProviderProps> = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language || 'en');
  const [isLoading, setIsLoading] = useState(true);
  // Stable ref so the snapshot callback never uses stale state
  const currentLanguageRef = useRef(currentLanguage);

  useEffect(() => {
    let unsubscribeDoc: (() => void) | undefined;

    // Listen to auth state — when user logs in, start listening to their Firestore doc
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      // Clean up any previous doc listener
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = undefined;
      }

      if (!user) {
        setIsLoading(false);
        return;
      }

      // Real-time listener on the user document
      unsubscribeDoc = onSnapshot(
        doc(db, 'users', user.uid),
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            // Priority: preferences.language > root language > fallback 'en'
            const raw = data.preferences?.language || data.language || data.settings?.language || 'en';
            const langCode = getLanguageCode(raw);

            console.log(`[TranslationProvider] Firestore language change detected: "${raw}" → "${langCode}"`);

            // Only change if different to avoid unnecessary re-renders
            if (langCode !== currentLanguageRef.current) {
              currentLanguageRef.current = langCode;
              setCurrentLanguage(langCode);
              i18n.changeLanguage(langCode);
            }
          }
          setIsLoading(false);
        },
        (error) => {
          console.error('[TranslationProvider] Firestore listener error:', error);
          setIsLoading(false);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
    // Empty dependency array: this effect is set up once and is stable
    // i18n is a stable module singleton, not a reactive hook value
  }, []);

  const changeLanguage = async (language: string) => {
    const langCode = getLanguageCode(language);
    currentLanguageRef.current = langCode;
    setCurrentLanguage(langCode);
    i18n.changeLanguage(langCode);
    // NOTE: Calling code is responsible for saving to Firestore if needed
    // The snapshot listener above will handle syncing FROM Firestore back to i18n
  };

  return (
    <TranslationContext.Provider value={{ currentLanguage, changeLanguage, isLoading }}>
      {children}
    </TranslationContext.Provider>
  );
};