/**
 * Service to handle parsing of imported deck lists from various formats.
 * Supports:
 * - MTG Arena Export (Qty Name (SET) ColNum)
 * - MTGO / Standard Text (Qty Name)
 * - Raw List (Name only)
 */
import { api } from './api';

export class DeckImportService {

    /**
     * Main entry point to parse any text.
     * Attempts to detect format and parse accordingly.
     * @param {string} text - The raw text input
     * @returns {Object} result - { mainboard: [], sideboard: [], errors: [] }
     */
    static parseText(text) {
        if (!text || typeof text !== 'string') {
            return { mainboard: [], sideboard: [], errors: ['Empty input'] };
        }

        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l);
        const result = {
            mainboard: [],
            sideboard: [],
            errors: []
        };

        let currentSection = 'mainboard';

        lines.forEach(line => {
            // Check for section headers
            if (line.toLowerCase() === 'deck' || line.toLowerCase() === 'mainboard') {
                currentSection = 'mainboard';
                return;
            }
            if (line.toLowerCase() === 'sideboard' || line.toLowerCase() === 'commander') {
                currentSection = 'sideboard';
                return;
            }

            // Attempt Parse
            const card = this.parseLine(line);

            if (card) {
                result[currentSection].push(card);
            } else {
                // If it's just a section divider or emptyish line we missed, ignore
                // otherwise log error
                if (line.length > 2) {
                    result.errors.push(`Could not parse line: "${line}"`);
                }
            }
        });

        // Consolidate duplicates
        result.mainboard = this.consolidate(result.mainboard);
        result.sideboard = this.consolidate(result.sideboard);

        return result;
    }

    /**
     * Parses a single line using varying strategies.
     * Priority: Arena -> Standard Qty -> Valid Name
     */
    static parseLine(line) {
        // Strategy 1: Arena / MTGO Export with Set Code
        // Format: "4 Opt (XLN) 65" or "1x Opt (XLN) 65" or "1 Opt (XLN)"
        const arenaRegex = /^(\d+)[xX]?\s+(.+)\s+\(([A-Za-z0-9]{3,4})\)\s*(\d+)?/;
        const arenaMatch = line.match(arenaRegex);

        if (arenaMatch) {
            return {
                quantity: parseInt(arenaMatch[1], 10),
                name: arenaMatch[2].trim(),
                set: arenaMatch[3].toUpperCase(),
                collectorNumber: arenaMatch[4] || null,
                isFoil: line.toLowerCase().includes(' *f*') // Arena sometimes marks foils
            };
        }

        // Strategy 2: Standard Quantity + Name
        // Format: "4 Opt" or "1x Opt"
        const standardRegex = /^(\d+)[xX]?\s+(.+)/;
        const standardMatch = line.match(standardRegex);

        if (standardMatch) {
            // Check if there are trailing set codes in parens without collector number that regex 1 missed
            // e.g. "1 Opt (XLN)" might be caught here if regex 1 was too strict
            let name = standardMatch[2].trim();
            let set = null;

            // Simple check for (SET) at end of name if not caught above
            const setSuffixMatch = name.match(/\(([A-Za-z0-9]{3,4})\)$/);
            if (setSuffixMatch) {
                set = setSuffixMatch[1];
                name = name.replace(setSuffixMatch[0], '').trim();
            }

            return {
                quantity: parseInt(standardMatch[1], 10),
                name: name,
                set: set,
                collectorNumber: null
            };
        }

        // Strategy 3: Just Name (Assume quantity 1)
        // Only if it looks like a card name (letters)
        if (/[a-zA-Z]/.test(line)) {
            return {
                quantity: 1,
                name: line,
                set: null,
                collectorNumber: null
            };
        }

        return null; // parse failure
    }

    /**
     * Consolidates duplicate entries in the list
     */
    static consolidate(list) {
        const map = new Map();

        list.forEach(item => {
            // Create a unique key based on Name + Set depending on "True Import Fidelity"
            // If Set is present, treat as distinct version. If not, merge by name.
            const key = item.set
                ? `${item.name}|${item.set}|${item.collectorNumber || ''}`
                : item.name;

            if (map.has(key)) {
                map.get(key).quantity += item.quantity;
            } else {
                map.set(key, { ...item });
            }
        });

        return Array.from(map.values());
    }

    /**
     * Resolves a list of parsed cards against Scryfall API to get IDs/Images.
     * @param {Array} cards - [{ name, set, quantity, ... }]
     * @returns {Promise<Array>} - [{ ...card, scryfall_id, image_uri, finish, data }]
     */
    static async resolveCards(cards) {
        if (!cards || cards.length === 0) return [];

        // Scryfall /cards/collection accepts max 75 identifiers
        const chunks = [];
        const CHUNK_SIZE = 75;

        for (let i = 0; i < cards.length; i += CHUNK_SIZE) {
            chunks.push(cards.slice(i, i + CHUNK_SIZE));
        }

        const resolvedCards = [];
        const missingNames = [];

        for (const chunk of chunks) {
            const identifiers = chunk.map(c => {
                if (c.set && c.collectorNumber) {
                    return { set: c.set, collector_number: c.collectorNumber };
                }
                // If we have strict set but no number, generic set search isn't directly supported by identifier
                // nicely in this batch endpoint (it supports 'name' + 'set' only if name is exact?)
                // Actually Scryfall identifiers are: { name, set? } or { id } or { set, collector_number }
                if (c.set) {
                    return { name: c.name, set: c.set };
                }
                return { name: c.name };
            });

            try {
                const response = await fetch('https://api.scryfall.com/cards/collection', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ identifiers })
                });

                if (!response.ok) throw new Error('Scryfall API Error');

                const data = await response.json();

                // Process hits
                data.data.forEach(scryfallCard => {
                    // Find the original input to merge quantity/isFoil
                    // Scryfall returns 'name' and we can try to matches
                    // But since we sent a batch, we rely on the order? 
                    // No, Scryfall docs say: "results are NOT in order".
                    // We have to match by name/set/collector.

                    // Optimization: Create a lookup key for the chunk inputs
                    // This is complex because of varying input quality.
                    // Simple approach: Match by name (lowercase)

                    const match = chunk.find(c => {
                        // Try strict match first
                        if (c.set && c.collectorNumber) {
                            return c.set.toLowerCase() === scryfallCard.set && c.collectorNumber === scryfallCard.collector_number;
                        }
                        // Then name match
                        return c.name.toLowerCase() === scryfallCard.name.toLowerCase() ||
                            (scryfallCard.card_faces && scryfallCard.card_faces[0].name.toLowerCase() === c.name.toLowerCase());
                    });

                    if (match) {
                        resolvedCards.push({
                            ...match,
                            scryfall_id: scryfallCard.id,
                            name: scryfallCard.name, // Use official name
                            set_code: scryfallCard.set,
                            collector_number: scryfallCard.collector_number,
                            image_uri: scryfallCard.image_uris?.normal || scryfallCard.card_faces?.[0]?.image_uris?.normal,
                            data: scryfallCard
                        });
                    }
                });

                // Track missing
                if (data.not_found && data.not_found.length > 0) {
                    data.not_found.forEach(nf => {
                        console.warn("Card not found:", nf);
                        missingNames.push(nf.name);
                    });
                }

            } catch (err) {
                console.error("Failed to resolve batch", err);
            }
        }

        // Add dummy objects for missing cards so they at least appear (optional?)
        // Or just let them drop? 
        // Better to notify user. For now, we return resolved only.
        return resolvedCards;
        return resolvedCards;
    }

    /**
     * Proxies a URL to the backend to fetch deck data.
     * @param {string} url 
     * @returns {Promise<Object>} { mainboard, sideboard, name, errors }
     */
    static async parseUrl(url) {
        try {
            const response = await api.post('/api/import/url', { url });
            return {
                mainboard: response.mainboard || [],
                sideboard: response.sideboard || [],
                name: response.name,
                errors: []
            };
        } catch (err) {
            console.error("URL Import Error", err);
            return {
                mainboard: [],
                sideboard: [],
                errors: [err.response?.data?.error || 'Failed to fetch URL']
            };
        }
    }
}

