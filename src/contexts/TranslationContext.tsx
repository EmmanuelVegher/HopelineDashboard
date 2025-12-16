"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { en } from '@/translations/en';
import { igbo } from '@/translations/igbo';
import { yoruba } from '@/translations/yoruba';
import { hausa } from '@/translations/hausa';
import { Language } from '@/translations/types';

type Translations = Record<string, any>;

const translations: Record<Language, Translations> = {
  en,
  igbo,
  yoruba,
  hausa
};

const LOCAL_STORAGE_KEY = 'hopeline-language';

interface TranslationContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  isLoading: boolean;
  formatDate: (date: Date) => string;
  formatNumber: (number: number) => string;
  formatCurrency: (amount: number) => string;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

interface TranslationProviderProps {
  children: ReactNode;
}

export function TranslationProvider({ children }: TranslationProviderProps) {
  const [language, setLanguageState] = useState<Language>('en');
  const [currentTranslations, setCurrentTranslations] = useState<Translations>(en);
  const [isLoading, setIsLoading] = useState(true);

  // Load language from localStorage on mount
  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const savedLanguage = localStorage.getItem(LOCAL_STORAGE_KEY) as Language;
        if (savedLanguage && savedLanguage in translations) {
          await setLanguage(savedLanguage);
        } else {
          // Default to English if no saved language or invalid language
          await setLanguage('en');
        }
      } catch (error) {
        console.warn('Failed to load language from localStorage:', error);
        await setLanguage('en');
      }
    };

    loadLanguage();
  }, []);

  const setLanguage = async (newLanguage: Language) => {
    setIsLoading(true);
    
    // Simulate loading time for smooth transition
    await new Promise(resolve => setTimeout(resolve, 200));
    
    setLanguageState(newLanguage);
    setCurrentTranslations(translations[newLanguage]);
    
    // Save to localStorage
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, newLanguage);
    } catch (error) {
      console.warn('Failed to save language to localStorage:', error);
    }
    
    setIsLoading(false);
  };

  const t = (key: string, params?: Record<string, string | number>): string => {
    const keys = key.split('.');
    let value: any = currentTranslations;

    for (const k of keys) {
      value = value?.[k];
    }

    if (typeof value === 'string') {
      // Replace parameters in the string
      if (params) {
        return value.replace(/\{(\w+)\}/g, (match, paramKey) => {
          return String(params[paramKey] || match);
        });
      }
      return value;
    }

    // Fallback to English if translation not found
    let fallbackValue: any = en;
    for (const k of keys) {
      fallbackValue = fallbackValue?.[k];
    }
    
    return typeof fallbackValue === 'string' ? fallbackValue : key;
  };

  const formatDate = (date: Date): string => {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };

    // Add locale-specific formatting
    switch (language) {
      case 'igbo':
        // Igbo date formatting
        return date.toLocaleDateString('en-NG', options);
      case 'yoruba':
        // Yoruba date formatting
        return date.toLocaleDateString('en-NG', options);
      case 'hausa':
        // Hausa date formatting
        return date.toLocaleDateString('ha-NG', options);
      default:
        // English default
        return date.toLocaleDateString('en-US', options);
    }
  };

  const formatNumber = (number: number): string => {
    // Use locale-specific number formatting
    switch (language) {
      case 'igbo':
        return number.toLocaleString('en-NG');
      case 'yoruba':
        return number.toLocaleString('en-NG');
      case 'hausa':
        return number.toLocaleString('ha-NG');
      default:
        return number.toLocaleString('en-US');
    }
  };

  const formatCurrency = (amount: number): string => {
    // Use Nigerian Naira for Nigerian languages
    const currency = language === 'en' ? 'USD' : 'NGN';
    
    return new Intl.NumberFormat(language === 'en' ? 'en-US' : 'en-NG', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const value: TranslationContextType = {
    language,
    setLanguage,
    t,
    isLoading,
    formatDate,
    formatNumber,
    formatCurrency,
  };

  return (
    <TranslationContext.Provider value={value}>
      <div lang={language === 'en' ? 'en' : language === 'igbo' ? 'ig' : language === 'yoruba' ? 'yo' : 'ha'}>
        {children}
      </div>
    </TranslationContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(TranslationContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
}