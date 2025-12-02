
'use server';
/**
 * @fileOverview A weather fetching AI agent.
 *
 * - getWeather - A function that handles fetching weather data.
 */

import { ai } from '@/ai/genkit';
import { GetWeatherInputSchema, GetWeatherOutputSchema, type GetWeatherInput, type GetWeatherOutput } from '@/ai/schemas/weather';
import { z } from 'zod';

export async function getWeather(input: GetWeatherInput): Promise<GetWeatherOutput> {
  return getWeatherFlow(input);
}

// Helper function to map OpenWeather condition codes to our icon set
const mapIcon = (iconCode: string): "Sun" | "Cloud" | "Cloudy" | "CloudDrizzle" | "CloudRain" | "CloudLightning" | "CloudSnow" | "CloudFog" => {
    if (iconCode.startsWith('01')) return 'Sun'; // clear sky
    if (iconCode.startsWith('02')) return 'Cloudy'; // few clouds
    if (iconCode.startsWith('03') || iconCode.startsWith('04')) return 'Cloud'; // scattered/broken clouds
    if (iconCode.startsWith('09')) return 'CloudDrizzle'; // shower rain
    if (iconCode.startsWith('10')) return 'CloudRain'; // rain
    if (iconCode.startsWith('11')) return 'CloudLightning'; // thunderstorm
    if (iconCode.startsWith('13')) return 'CloudSnow'; // snow
    if (iconCode.startsWith('50')) return 'CloudFog'; // mist
    return 'Cloudy'; // default
}

const NarrativeWeatherSchema = z.object({
    narrativeSummary: z.string().describe('A short, human-friendly summary of the current and upcoming weather for the next few hours based on the forecast. Example: "Light rain expected around 5 PM, clearing up by evening." or "Clear skies for the rest of the day."'),
});

const narrativePrompt = ai.definePrompt({
    name: 'narrativeWeatherPrompt',
    input: { schema: z.any() },
    output: { schema: NarrativeWeatherSchema },
    prompt: `You are a helpful weather assistant. Based on the provided JSON data from a weather API (current conditions, minutely forecast for the next hour, and any alerts), create a short, human-friendly summary of the current and upcoming weather.
    
    Focus on significant changes like precipitation. Mention any severe weather alerts if present.

    Current Time: {{time}}
    Weather Data:
    {{{json weatherData}}}
    `,
});

const ShelterImpactSchema = z.object({
    impactAnalysis: z.string().describe("An analysis of how the forecasted weather could impact local shelters for displaced persons. Consider factors like heavy rain making access difficult, high winds posing risks, or prolonged bad weather increasing demand for shelter space. Provide actionable advice for both people seeking shelter and for shelter managers. The tone should be informative and cautionary."),
});

const shelterImpactPrompt = ai.definePrompt({
    name: 'shelterImpactPrompt',
    input: { schema: z.any() },
    output: { schema: ShelterImpactSchema },
    prompt: `You are an emergency management expert specializing in disaster response for IDPs. Based on the provided 7-day weather forecast and any active alerts, analyze the potential impact on local shelters.

    Key considerations:
    - Flooding potential from heavy or sustained rain.
    - Accessibility issues for both displaced persons and supply vehicles.
    - Potential for increased demand for shelter space.
    - Safety of temporary structures in high winds.
    - Mention specific alerts if they are relevant.

    Provide a concise analysis and actionable advice.

    Forecast Data:
    {{{json forecastData}}}
    `,
});


const getWeatherFlow = ai.defineFlow(
  {
    name: 'getWeatherFlow',
    inputSchema: GetWeatherInputSchema,
    outputSchema: GetWeatherOutputSchema,
  },
  async (input) => {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      throw new Error("OPENWEATHER_API_KEY is not set in environment variables.");
    }
    
    // Using One Call API 3.0
    // Removed units=metric to avoid potential conflicts with some locations. Temp is in Kelvin by default.
    const oneCallUrl = `https://api.openweathermap.org/data/3.0/onecall?lat=${input.latitude}&lon=${input.longitude}&appid=${apiKey}`;

    try {
        const response = await fetch(oneCallUrl);
        if (!response.ok) {
             const errorText = await response.text();
             console.error("OpenWeather OneCall API Error:", response.status, errorText);
             throw new Error(`Failed to fetch weather data. Status: ${response.status}. Please check your OpenWeatherMap API key and subscription.`);
        }
        
        const weatherData = await response.json();

        // Function to convert Kelvin to Celsius
        const toCelsius = (k: number) => Math.round(k - 273.15);

        // Process daily forecasts
        const dailyForecasts = weatherData.daily
            .slice(0, 5) // Get next 5 days
            .map((item: any) => ({
                day: new Date(item.dt * 1000).toLocaleDateString('en-US', { weekday: 'short' }),
                temp: `${toCelsius(item.temp.day)}°C`,
                description: item.weather[0].description,
                icon: mapIcon(item.weather[0].icon),
            }));

        // Process weather alerts safely
        const weatherAlerts = (weatherData.alerts || []).map((alert: any) => {
            const severity: 'Severe' | 'Moderate' | 'Minor' = alert.event.toLowerCase().includes('warning') ? 'Severe' : 'Moderate';
            return {
                title: alert.event,
                description: alert.description,
                area: alert.sender_name, 
                severity: severity,
                activeUntil: new Date(alert.end * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }
        });
        
        // Data for narrative summary
        const currentDataForNarrative = {
            current: weatherData.current,
            minutely: weatherData.minutely,
            alerts: weatherData.alerts,
        }
        const narrativeResponse = await narrativePrompt({
            weatherData: currentDataForNarrative,
            time: new Date().toLocaleTimeString(),
        });
        const narrativeSummary = narrativeResponse.output?.narrativeSummary || "Could not generate summary.";

        const shelterImpactResponse = await shelterImpactPrompt({
            forecastData: {
                daily: weatherData.daily,
                alerts: weatherData.alerts
            },
        });
        const shelterImpact = shelterImpactResponse.output?.impactAnalysis || "Impact analysis is currently unavailable.";

        return {
            narrativeSummary: narrativeSummary,
            currentConditions: {
                temperature: `${toCelsius(weatherData.current.temp)}°C`,
                description: weatherData.current.weather[0].description,
                humidity: `${weatherData.current.humidity}%`,
                windSpeed: `${weatherData.current.wind_speed} m/s`,
                visibility: `${weatherData.current.visibility / 1000} km`,
                uvIndex: `${Math.round(weatherData.current.uvi)}`,
            },
            forecast: dailyForecasts,
            alerts: weatherAlerts,
            shelterImpact: shelterImpact,
            lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

    } catch (error) {
        console.error("Error in getWeatherFlow:", error);
        throw new Error("An error occurred while fetching weather information.");
    }
  }
);
