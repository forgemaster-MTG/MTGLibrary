
import { z } from 'zod';

export const userUpdateSchema = z.object({
    email: z.string().email().optional(),
    username: z.string().min(2).optional(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    contact_email: z.string().email().optional().or(z.literal('')),
    is_public_library: z.boolean().optional(),
    // Settings and Data are free-form JSONB columns, but we can enforce object type
    settings: z.record(z.any()).optional(),
    data: z.record(z.any()).optional(),
    lfg_status: z.string().optional(),
    agreed_to_terms_at: z.string().datetime().nullable().optional(),
    marketing_opt_in: z.boolean().optional(),

    // Admin only fields might be passed here too?
    subscription_status: z.string().optional(),
    subscription_tier: z.string().optional(),
    trial_start_date: z.string().datetime().optional(), // ISO date string
    trial_end_date: z.string().datetime().optional()
});

export const userPermissionsSchema = z.object({
    permissions: z.array(z.string()).optional(),
    isAdmin: z.boolean().optional(),
    subscription_tier: z.string().optional(),
    user_override_tier: z.string().nullable().optional(),
    subscription_status: z.string().optional()
});

export const bulkDeleteSchema = z.object({
    target: z.enum(['decks', 'collection', 'wishlist', 'all'])
});
