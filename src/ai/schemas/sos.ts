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
    state: z.string().optional(),
    localGovernment: z.string().optional(),
  }),
  additionalInfo: z.string().optional().describe('Any extra details provided by the user.'),
  userId: z.string().optional().describe('The ID of the user sending the SOS.'),
  userEmail: z.string().optional().describe('The email of the user sending the SOS.'),
});
export type SendSosInput = z.infer<typeof SendSosInputSchema>;

export const SosAlertSchema = SendSosInputSchema.extend({
  id: z.string(),
  timestamp: z.any(),
  status: z.enum(['Active', 'Investigating', 'Responding', 'In Transit', 'False Alarm', 'Resolved']),
  assignedTeam: z.object({
    driverId: z.string(),
    driverName: z.string(),
    vehicle: z.string(),
  }).optional(),
  assignedAt: z.any().optional().describe('When the alert was assigned to a driver.'),
  resolvedAt: z.any().optional().describe('When the alert was marked as resolved.'),
  trackingData: z.object({
    coordinates: z.array(z.object({
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
      timestamp: z.number().optional(),
    })).optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
  }).optional().describe('Historical tracking data captured during the mission.'),
  isDisplacementRelated: z.boolean().optional().describe('Indicates if the emergency type is related to displacement.'),
  readByAdmin: z.boolean().optional().describe('Whether any administrator has seen this alert.'),
  readBySuperAdmin: z.boolean().optional().describe('Whether any super-administrator has seen this alert.'),
});
export type SosAlert = z.infer<typeof SosAlertSchema>;
