// Client-safe AI functions - these are mocks for development
// In production, these should call API endpoints

export async function sendSos(input: any) {
  console.log('Mock sendSos called with:', input);
  await new Promise(resolve => setTimeout(resolve, 1000));
  return { success: true, alertId: 'mock-' + Date.now() };
}

export async function getWeather(input: any) {
  console.log('Mock getWeather called with:', input);
  await new Promise(resolve => setTimeout(resolve, 500));
  return {
    narrativeSummary: 'Sunny conditions expected throughout the day with temperatures around 28°C.',
    currentConditions: {
      temperature: '28°C',
      description: 'Sunny',
      humidity: '65%',
      windSpeed: '12 km/h',
      visibility: '10 km',
      uvIndex: '7'
    },
    forecast: [
      { day: 'Today', temp: '28°C', description: 'Sunny', icon: 'Sun' as const },
      { day: 'Tomorrow', temp: '27°C', description: 'Partly cloudy', icon: 'Cloud' as const },
      { day: 'Wed', temp: '26°C', description: 'Cloudy', icon: 'Cloudy' as const },
      { day: 'Thu', temp: '29°C', description: 'Sunny', icon: 'Sun' as const },
      { day: 'Fri', temp: '30°C', description: 'Sunny', icon: 'Sun' as const }
    ],
    alerts: [],
    shelterImpact: 'Current weather conditions are favorable for shelter operations. No significant impacts expected.',
    lastUpdated: new Date().toLocaleTimeString()
  };
}

export async function translateText(input: any) {
  console.log('translateText called with:', input);
  // Import the actual translation flow
  const { translateText: translateTextFlow } = await import('./flows/translate-text-flow');
  return await translateTextFlow(input);
}

// Re-export types from schemas
export type { SosAlert, SendSosInput } from './schemas/sos';
export type { GetWeatherOutput } from './schemas/weather';
export type { TranslateTextOutput } from './schemas/translation';