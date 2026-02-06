// Client-safe AI functions - these are mocks for development
// In production, these should call API endpoints

import { functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';

export async function sendSos(input: any): Promise<{ success: boolean; alertId: string }> {
  console.log('Calling sendSos Firebase Function with:', input);

  try {
    // Call Firebase Function instead of mock
    const sendSosFunction = httpsCallable(functions, 'sendSos');
    const result = await sendSosFunction(input);

    return result.data as { success: boolean; alertId: string };
  } catch (error) {
    console.error('Firebase Function error:', error);
    // Fallback to mock data if Firebase Function fails
    return { success: false, alertId: '' };
  }
}

export async function getWeather(input: any) {
  console.log('Fetching weather data via Firebase Function:', input);

  try {
    // Call Firebase Function instead of direct API
    const getWeatherFunction = httpsCallable(functions, 'getWeather');
    const result = await getWeatherFunction(input);

    return result.data;
  } catch (error) {
    console.error('Firebase Function error:', error);
    // Fallback to mock data if Firebase Function fails
    return {
      narrativeSummary: 'Weather information temporarily unavailable. Please check again later.',
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
      alerts: [
        {
          title: 'Flood & Security Alert',
          description: 'Heavy rainfall and potential flooding forecasted for Bayelsa. Increased security vigilance advised in Adamawa. Please find safe shelter immediately.',
          area: 'Bayelsa and Adamawa',
          severity: 'Severe' as const,
          activeUntil: '23:59:59'
        }
      ],
      shelterImpact: 'Current weather conditions are favorable for shelter operations. No significant impacts expected.',
      lastUpdated: new Date().toLocaleTimeString()
    };
  }
}

export async function generateAgoraToken(input: { channelName: string; uid: string; role?: string }): Promise<{ token: string }> {
  console.log('Generating Agora token via Firebase Function:', input);

  try {
    // Call Firebase Function
    const generateAgoraTokenFunction = httpsCallable(functions, 'generateAgoraToken');
    const result = await generateAgoraTokenFunction(input);

    return result.data as { token: string };
  } catch (error) {
    console.error('Firebase Function error:', error);
    throw new Error('Failed to generate Agora token');
  }
}