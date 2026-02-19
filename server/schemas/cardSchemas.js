
import { z } from 'zod';

export const cardSearchSchema = z.object({
    query: z.string().optional(),
    set: z.string().optional(),
    cn: z.union([z.string(), z.number()]).optional(),
    type: z.string().optional(),
    text: z.string().optional(),
    flavor: z.string().optional(),
    artist: z.string().optional(),
    rarity: z.array(z.string()).optional(),
    colors: z.array(z.string()).optional(),
    colorLogic: z.enum(['and', 'or']).optional(),
    colorIdentity: z.boolean().optional(),
    colorExcluded: z.boolean().optional(),
    // Numeric filters often come as objects { value: 5, operator: '>=' }
    mv: z.object({
        value: z.number().or(z.string().transform(Number)),
        operator: z.string().optional()
    }).optional(),
    power: z.object({
        value: z.number().or(z.string().transform(Number)),
        operator: z.string().optional()
    }).optional(),
    toughness: z.object({
        value: z.number().or(z.string().transform(Number)),
        operator: z.string().optional()
    }).optional(),
    preferFinish: z.enum(['foil', 'nonfoil', 'cheapest']).optional(),
    isCommander: z.boolean().optional()
});

export const cardAutocompleteSchema = z.object({
    q: z.string().min(1)
});

export const setsForCardSchema = z.object({
    name: z.string().min(1)
});
