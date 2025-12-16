export type Language = 'en' | 'igbo' | 'yoruba' | 'hausa';

export type TranslationKey = string;

export interface Translations {
  common: Record<string, string>;
  navigation: Record<string, string>;
  dashboard: {
    title: string;
    welcome: string;
    subtitle: string;
    overview: string;
    quickActions: string;
    recentActivity: string;
    notifications: string;
    emergency: string;
    getAssistance: string;
    findShelter: string;
    reportEmergency: string;
    checkWeather: string;
    navigate: string;
    stats: {
      totalUsers: string;
      activeUsers: string;
      totalShelters: string;
      availableBeds: string;
      emergencyReports: string;
      resolvedCases: string;
    };
  };
  profile: {
    title: string;
    subtitle: string;
    personalInfo: string;
    updateDetails: string;
    displayName: string;
    firstName: string;
    lastName: string;
    mobileNumber: string;
    gender: string;
    language: string;
    state: string;
    profilePicture: string;
    uploadImage: string;
    saveChanges: string;
    editProfile: string;
    accountInfo: string;
    additionalDetails: string;
    accountStatus: string;
    onlineStatus: string;
    userId: string;
    profileComplete: string;
    profileUpToDate: string;
    joined: string;
    genderOptions: {
      male: string;
      female: string;
      other: string;
      preferNotToSay: string;
    };
    languageOptions: {
      english: string;
      igbo: string;
      yoruba: string;
      hausa: string;
    };
    placeholder: {
      displayName: string;
      firstName: string;
      lastName: string;
      selectGender: string;
      selectLanguage: string;
      selectState: string;
    };
    messages: {
      saving: string;
      uploading: string;
      saved: string;
      saveFailed: string;
      imageUploadFailed: string;
    };
  };
  assistance: Record<string, string>;
  sos: Record<string, string>;
  findShelter: Record<string, string>;
  navigate: Record<string, string>;
  weather: Record<string, string>;
  settings: Record<string, string>;
}

export interface TranslationContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  isLoading: boolean;
  formatDate: (date: Date) => string;
  formatNumber: (number: number) => string;
  formatCurrency: (amount: number) => string;
}