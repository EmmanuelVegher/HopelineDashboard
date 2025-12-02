
/**
 * @fileOverview Defines the data schemas and types for the user approval feature.
 */
import { z } from 'zod';

// Define the schema for the input to the user approval flow
export const ApproveUserInputSchema = z.object({
  requestId: z.string().describe("The ID of the document in the 'pendingUsers' collection."),
  email: z.string().email().describe("The email address for the new user."),
  role: z.enum(["Admin", "Support Agent"]).describe("The role to assign to the new user."),
});
export type ApproveUserInput = z.infer<typeof ApproveUserInputSchema>;
