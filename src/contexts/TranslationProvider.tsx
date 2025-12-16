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
          const userLanguage = userData.settings?.language || 'en';
          setCurrentLanguage(userLanguage);
          await i18n.changeLanguage(userLanguage);
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
          const userData = userDoc.data();
          const currentSettings = userData.settings || {};
          await updateDoc(doc(db, 'users', user.uid), {
            settings: {
              ...currentSettings,
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