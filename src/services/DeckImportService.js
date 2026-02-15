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
        // Pre-processing: Detect Commander tags and strip ALL tags to clean names
        // Example: "1x Sol Ring [Ramp]" -> "1x Sol Ring"
        // Example: "1x Terra... [Commander{top}]" -> "1x Terra...", isCommander=true

        let isCommander = false;

        // 1. Check for Commander keyword in any brackets or specific *CMDR* tag
        const cmdrTriggerRegex = /\[.*Commander.*\]|\*CMDR\*/i;
        if (cmdrTriggerRegex.test(line)) {
            isCommander = true;
        }

        // 2. Remove ALL square bracket tags (custom categories) and *CMDR*
        // keeping *F* for foil detection later (or we can detect foil here too?)
        // The existing code detects *F* inside arenaRegex or manual check. 
        // Let's just strip the known junk.

        line = line.replace(/\[.*?\]/g, '').replace(/\*CMDR\*/ig, '').trim();

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
                isFoil: line.toLowerCase().includes(' *f*'), // Arena sometimes marks foils
                isCommander
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
                collectorNumber: null,
                isCommander
            };
        }

        // Strategy 3: Just Name (Assume quantity 1)
        // Only if it looks like a card name (letters)
        if (/[a-zA-Z]/.test(line)) {
            return {
                quantity: 1,
                name: line,
                set: null,
                collectorNumber: null,
                isCommander
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
        // Track which input card objects (references) were successfully resolved
        const resolvedInputCards = new Set();

        for (const chunk of chunks) {
            const identifiers = chunk.map(c => {
                if (c.set && c.collectorNumber) {
                    return { set: c.set, collector_number: c.collectorNumber };
                }
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
                            data: scryfallCard,
                            isCommander: match.isCommander // Explicitly preserve
                        });
                        resolvedInputCards.add(match);
                    }
                });

                // Handle missing / retry logic
                if (data.not_found && data.not_found.length > 0) {
                    console.warn("Cards not found with strict matching, retrying with name only:", data.not_found.length);

                    const failedIdentifiers = new Set(data.not_found.map(nf =>
                        nf.set && nf.collector_number ? `${nf.set}:${nf.collector_number}` : nf.name
                    ));

                    const retryCandidates = chunk.filter(c => {
                        const id = c.set && c.collectorNumber ? `${c.set}:${c.collectorNumber}` : c.name;
                        // Only retry if we haven't already resolved it (sanity check)
                        return failedIdentifiers.has(id) && !resolvedInputCards.has(c);
                    });

                    if (retryCandidates.length > 0) {
                        const retryIdentifiers = retryCandidates.map(c => {
                            // Clean name for retry: remove " // " suffix if present
                            const cleanName = c.name.split(' // ')[0];
                            return { name: cleanName };
                        });

                        try {
                            const retryResponse = await fetch('https://api.scryfall.com/cards/collection', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ identifiers: retryIdentifiers })
                            });

                            if (retryResponse.ok) {
                                const retryData = await retryResponse.json();
                                retryData.data.forEach(scryfallCard => {
                                    const match = retryCandidates.find(c => {
                                        const cName = c.name.toLowerCase();
                                        const sName = scryfallCard.name.toLowerCase();

                                        // Specific check for double-sided cards:
                                        // Input might be "Front // Back" or just "Front"
                                        // Scryfall result is "Front // Back"

                                        // 1. Exact match
                                        if (cName === sName) return true;

                                        // 2. Input is "Front", Scryfall is "Front // Back"
                                        if (sName.startsWith(cName + ' //')) return true;

                                        // 3. Input is "Front // Back", Scryfall is "Front // Back" (Covered by 1)

                                        // 4. Input is "Front // Back", Scryfall returned just "Front" (unlikely but possible for meld?)
                                        if (cName.startsWith(sName + ' //')) return true;

                                        return false;
                                    });

                                    if (match) {
                                        resolvedCards.push({
                                            ...match,
                                            scryfall_id: scryfallCard.id,
                                            name: scryfallCard.name,
                                            set_code: scryfallCard.set,
                                            collector_number: scryfallCard.collector_number,
                                            image_uri: scryfallCard.image_uris?.normal || scryfallCard.card_faces?.[0]?.image_uris?.normal,
                                            data: scryfallCard,
                                            isCommander: match.isCommander // Explicitly preserve
                                        });
                                        resolvedInputCards.add(match);
                                    }
                                });
                            }
                        } catch (retryErr) {
                            console.error("Retry failed", retryErr);
                        }
                    }
                }

            } catch (err) {
                console.error("Failed to resolve batch", err);
            }
        }

        // Append missing cards (preserves input data even if Scryfall failed)
        const missingCards = cards.filter(c => !resolvedInputCards.has(c));

        if (missingCards.length > 0) {
            console.warn(`DeckImportService: ${missingCards.length} cards failed to resolve from Scryfall. Returning raw inputs.`);
        }

        return [...resolvedCards, ...missingCards];
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

