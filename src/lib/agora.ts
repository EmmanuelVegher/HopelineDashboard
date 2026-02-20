// Agora RTC Configuration
// Using the same App ID as the mobile app for consistency
export const AGORA_APP_ID = import.meta.env.VITE_AGORA_APP_ID || '8bb7364b135e43d0b936e3cb53dc69fe';

/**
 * Generate channel name from two user IDs
 * Channel name MUST be identical for both participants
 * @param userId1 First user ID
 * @param userId2 Second user ID
 * @returns Sorted channel name (e.g., "agent_xyz_user_abc")
 */
export function generateChannelName(userId1: string, userId2: string): string {
    const ids = [userId1, userId2].sort();
    return ids.join('_');
}

/**
 * Call status types matching mobile app
 */
export type CallStatus = 'ringing' | 'active' | 'ended' | 'declined' | 'missed' | 'answered';

/**
 * Call type
 */
export type CallType = 'video' | 'voice';
