"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

interface TranslationContextType {
  currentLanguage: string;
  changeLanguage: (language: string) => Promise<void>;
  isLoading: boolean;
  renderCount: number;
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

const getLanguageCode = (lang: string) => {
  if (!lang) return 'en';
  // Check direct mapping
  if (LANGUAGE_MAP[lang]) return LANGUAGE_MAP[lang];

  const lowerLang = lang.toLowerCase();

  // Check if it's already a code (e.g., 'en', 'ha')
  if (Object.values(LANGUAGE_MAP).includes(lowerLang)) return lowerLang;

  // Check keys in a case-insensitive way
  for (const [key, value] of Object.entries(LANGUAGE_MAP)) {
    if (key.toLowerCase() === lowerLang) {
      return value;
    }
  }

  return 'en';
};

export const useTranslationContext = () => {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslationContext must be used within a TranslationProvider');
  }
  return context;
};

interface TranslationProviderProps {
  children: React.ReactNode;
}

export const TranslationProvider: React.FC<TranslationProviderProps> = ({ children }) => {
  const { i18n } = useTranslation();
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [isLoading, setIsLoading] = useState(true);

  // Load user's language preference from Firebase
  useEffect(() => {
    let unsubscribeDoc: (() => void) | undefined;

    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = undefined;
      }

      if (!user) {
        setIsLoading(false);
        return;
      }

      // Listen for real-time changes to the user document
      unsubscribeDoc = onSnapshot(doc(db, 'users', user.uid), async (snapshot: any) => {
        if (snapshot.exists()) {
          const userData = snapshot.data();
          // Priorities: root language > settings.language > preferences.language
          const rawLanguage = userData.language || userData.settings?.language || userData.preferences?.language || 'en';
          const userLanguageCode = getLanguageCode(rawLanguage);

          console.log(`TranslationProvider: Syncing language to "${userLanguageCode}" (raw: "${rawLanguage}")`);

          if (i18n.language !== userLanguageCode) {
            await i18n.changeLanguage(userLanguageCode);
            setCurrentLanguage(userLanguageCode);
          } else if (currentLanguage !== userLanguageCode) {
            setCurrentLanguage(userLanguageCode);
          }
        }
        setIsLoading(false);
      }, (error: any) => {
        console.error('Error listening to user language:', error);
        setIsLoading(false);
      });
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, [i18n, currentLanguage]);

  const changeLanguage = async (language: string) => {
    try {
      setIsLoading(true);

      // Change i18n language
      await i18n.changeLanguage(language);
      setCurrentLanguage(language);

      // Save to Firebase if user is logged in
      const user = auth.currentUser;
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          await updateDoc(doc(db, 'users', user.uid), {
            language: language, // Save to root level
            settings: {
              ...(userData.settings || {}),
              language: language
            },
            preferences: {
              ...(userData.preferences || {}),
              language: language
            },
            updatedAt: new Date()
          });
        }
      }
    } catch (error) {
      console.error('Error changing language:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Force re-render when language changes by updating a counter
  const [renderCount, setRenderCount] = useState(0);
  useEffect(() => {
    setRenderCount(prev => prev + 1);
  }, [currentLanguage]);

  const value: TranslationContextType = {
    currentLanguage,
    changeLanguage,
    isLoading,
    renderCount, // Add renderCount to force re-renders
  };

  return (
    <TranslationContext.Provider value={value}>
      {children}
    </TranslationContext.Provider>
  );
};