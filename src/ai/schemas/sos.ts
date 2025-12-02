/**
 * @fileOverview Defines the data schemas and types for the SOS alert feature.
 */

import { z } from 'zod';

/**
 * List of emergency types that should trigger displaced person creation.
 */
export const DISPLACEMENT_EMERGENCY_TYPES = [
  'flood',
  'earthquake',
  'hurricane',
  'tornado',
  'tsunami',
  'volcanic eruption',
  'war',
  'conflict',
  'evacuation',
  'disaster',
  'fire',
  'landslide',
  'mudslide',
];

/**
 * Checks if the given emergency type is displacement-related.
 */
export const isDisplacementEmergency = (emergencyType: string): boolean => {
  return DISPLACEMENT_EMERGENCY_TYPES.includes(emergencyType.toLowerCase());
};

export const SendSosInputSchema = z.object({
  emergencyType: z.string().describe('The type of emergency reported by the user.'),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
    address: z.string().optional(),
  }),
  additionalInfo: z.string().optional().describe('Any extra details provided by the user.'),
  userId: z.string().optional().describe('The ID of the user sending the SOS.'),
  userEmail: z.string().optional().describe('The email of the user sending the SOS.'),
});
export type SendSosInput = z.infer<typeof SendSosInputSchema>;

export const SosAlertSchema = SendSosInputSchema.extend({
    id: z.string(),
    timestamp: z.any(),
    status: z.enum(['Active', 'Responding', 'In Transit', 'Resolved']),
    assignedTeam: z.object({
        driverId: z.string(),
        driverName: z.string(),
        vehicle: z.string(),
    }).optional(),
    isDisplacementRelated: z.boolean().optional().describe('Indicates if the emergency type is related to displacement.'),
});
export type SosAlert = z.infer<typeof SosAlertSchema>;
