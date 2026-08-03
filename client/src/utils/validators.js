import { z } from 'zod';

export const memberSchema = z.object({
  name: z.string().min(2, 'Name is required (at least 2 chars)'),
  regNo: z.string().min(2, 'Registration Number is required'),
  phone: z.string().length(10, 'Phone number must be exactly 10 digits').regex(/^\d{10}$/, 'Phone number must contain only numbers'),
  section: z.string().min(1, 'Section is required'),
  branch: z.string().min(1, 'Branch is required')
});

export const registrationFormSchema = z.object({
  teamName: z.string().min(3, 'Team Name must be at least 3 characters'),
  leader: memberSchema,
  members: z.array(memberSchema).optional().default([])
});

export const paymentSchema = z.object({
  transactionId: z.string().min(6, 'Transaction ID must be at least 6 characters (e.g., UPI/Bank Ref No)'),
});
