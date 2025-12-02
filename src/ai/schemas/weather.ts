/**
 * @fileOverview Defines the data schemas and types for the weather feature.
 * This includes input and output structures for the weather AI flow.
 */

import { z } from 'zod';

export const GetWeatherInputSchema = z.object({
  latitude: z.number().describe('The latitude for the weather forecast.'),
  longitude: z.number().describe('The longitude for the weather forecast.'),
});
export type GetWeatherInput = z.infer<typeof GetWeatherInputSchema>;

const DailyForecastSchema = z.object({
  day: z.string().describe('Day of the week'),
  temp: z.string().describe('The temperature forecast, e.g., 29°C'),
  description: z.string().describe('A brief weather description, e.g., "Thunderstorms"'),
  icon: z.enum(["Sun", "Cloud", "Cloudy", "CloudDrizzle", "CloudRain", "CloudLightning", "CloudSnow", "CloudFog"]),
});

const WeatherAlertSchema = z.object({
  title: z.string().describe('Title of the weather alert'),
  description: z.string().describe('Detailed description of the alert'),
  area: z.string().describe('The affected area'),
  severity: z.enum(['Severe', 'Moderate', 'Minor']).describe('Severity of the alert'),
  activeUntil: z.string().describe('When the alert expires, e.g., "12:35:26"'),
});

export const GetWeatherOutputSchema = z.object({
  narrativeSummary: z.string().describe('A human-friendly summary of the current and upcoming weather.'),
  currentConditions: z.object({
    temperature: z.string().describe('Current temperature in Celsius, e.g., "28°C"'),
    description: z.string().describe('Current weather description, e.g., "Cloudy"'),
    humidity: z.string().describe('Humidity percentage, e.g., "78%"'),
    windSpeed: z.string().describe('Wind speed, e.g., "15 km/h"'),
    visibility: z.string().describe('Visibility, e.g., "8 km"'),
    uvIndex: z.string().describe('UV index, e.g., "6"'),
  }),
  forecast: z.array(DailyForecastSchema),
  alerts: z.array(WeatherAlertSchema),
  shelterImpact: z.string().describe('An AI-generated analysis of the potential impact of the weather on local shelters.'),
  lastUpdated: z.string().describe('The time the weather data was last fetched, e.g., "4:30 PM"'),
});
export type GetWeatherOutput = z.infer<typeof GetWeatherOutputSchema>;
