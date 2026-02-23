"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
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
  'Pidgin': 'pcm'
};

const getLanguageCode = (lang: string) => {
  if (!lang) return 'en';
  if (LANGUAGE_MAP[lang]) return LANGUAGE_MAP[lang];
  const lowerLang = lang.toLowerCase();
  if (Object.values(LANGUAGE_MAP).includes(lowerLang)) return lowerLang;
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
    const loadUserLanguage = async () => {
      const user = auth.currentUser;
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          // Check root language first, then settings.language
          const rawLanguage = userData.language || userData.settings?.language || 'en';
          const userLanguageCode = getLanguageCode(rawLanguage);

          setCurrentLanguage(userLanguageCode);
          await i18n.changeLanguage(userLanguageCode);
        }
      } catch (error) {
        console.error('Error loading user language:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserLanguage();
  }, [i18n]);

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
          await updateDoc(doc(db, 'users', user.uid), {
            language: language, // Save to root level
            settings: {
              ...(userDoc.data().settings || {}),
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