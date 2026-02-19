import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const OnboardingPreconSearch = ({ onDeckAdded }) => {
    const { addToast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [precons, setPrecons] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedDeck, setSelectedDeck] = useState(null);
    const [importing, setImporting] = useState(false);

    // Initial load: Default search (triggers filtered view)
    useEffect(() => {
        searchPrecons('');
    }, []);

    const hydrateDeckImages = async (decks) => {
        // Filter for decks needing art (no image_uri set)
        const decksNeedingArt = decks.filter(d => !d.image_uri);

        if (decksNeedingArt.length === 0) return;

        console.log(`[Onboarding] Hydrating art for ${decksNeedingArt.length} decks...`);

        const updates = await Promise.all(decksNeedingArt.map(async (deck) => {
            try {


                let deckData = deck.data;

                // Helper to find candidate in data
                const findCandidate = (data) => {
                    if (!data) return null;
                    const getSafeArray = (arr) => Array.isArray(arr) ? arr : [];

                    const cmds = getSafeArray(data.commander);
                    if (cmds.length > 0) return cmds[0];

                    const main = getSafeArray(data.mainBoard);
                    if (main.length > 0) {
                        const sorted = [...main].sort((a, b) => (b.cmc || 0) - (a.cmc || 0));
                        return sorted[0];
                    }
                    return null;
                };

                // 1. Try existing data
                let candidate = findCandidate(deckData);

                // Check if candidate needs hydration (missing set/cn)
                const isCandidateIncomplete = candidate && (!candidate.set && !candidate.set_code && !candidate.SetCode && !deckData?.code || !candidate.collector_number && !candidate.number && !candidate.cn && !candidate.CollectorNumber);

                // 2. If no candidate or incomplete, fetch full deck details (Deep Hydration)
                if (!candidate || isCandidateIncomplete) {
                    try {
                        const fullDeck = await api.get(`/api/precons/${deck.id}`);
                        if (fullDeck && fullDeck.data) {
                            deckData = fullDeck.data;
                            candidate = findCandidate(deckData);
                        }
                    } catch (fetchErr) {
                        console.warn(`[Onboarding] Failed to fetch full deck for "${deck.name}"`, fetchErr);
                    }
                }

                if (!candidate) return null;

                // 3. Resolve Set/CN
                // Handle various key formats from different data sources
                const set = candidate.set || candidate.set_code || candidate.SetCode || deckData?.code;
                const cn = candidate.collector_number || candidate.number || candidate.cn || candidate.CollectorNumber;

                // If missing vital info, skip
                if (!set || !cn) {
                    console.warn(`[Onboarding] Skipping hydration for "${deck.name}": Missing Set/CN on candidate`, candidate);
                    return null;
                }

                // 3. Query Internal DB
                const response = await api.post('/api/cards/search', { set, cn });

                if (response.data && response.data.length > 0) {
                    const foundCard = response.data[0];
                    // STRICT PRIORITY: Art Crop (for background) -> Large -> Normal
                    // We must check image_uris.art_crop BEFORE generic .image_uri (which might be the full card)
                    const image = foundCard.image_uris?.art_crop
                        || foundCard.card_faces?.[0]?.image_uris?.art_crop
                        || foundCard.image_uri
                        || foundCard.image_uris?.large
                        || foundCard.card_faces?.[0]?.image_uris?.large
                        || foundCard.image_uris?.normal;

                    if (image) {
                        return { id: deck.id, image_uri: image };
                    }
                } else {
                    console.warn(`[Onboarding] No art found in DB for ${set} #${cn}`);
                }
            } catch (err) {
                console.warn(`[Onboarding] Failed to hydrate image for "${deck.name}"`, err);
            }
            return null;
        }));

        // Apply updates
        const validUpdates = updates.filter(Boolean);
        if (validUpdates.length > 0) {
            console.log(`[Onboarding] Successfully hydrated ${validUpdates.length} decks.`);
            setPrecons(current => current.map(d => {
                const update = validUpdates.find(u => u.id === d.id);
                return update ? { ...d, image_uri: update.image_uri } : d;
            }));
        }
    };

    const searchPrecons = async (term) => {
        setLoading(true);
        try {
            let data;

            if (!term) {
                // Default View: Fetch from specific type endpoint
                // "What its showing should be the same thing as the route "precons/type/Commander%20Deck" on load"
                // Default View: Fetch ALL decks (API workaround)
                data = await api.get('/api/precons');
            } else {
                // User Search: Pass the term to the API
                // We trust the API to return relevant results for the search term (e.g. "Elven")
                const query = `search=${encodeURIComponent(term)}`;
                data = await api.get(`/api/precons?${query}`);
            }

            const results = Array.isArray(data) ? data : [];

            // Client-side filter for Commander Decks on default view
            const finalResults = !term
                ? results.filter(d => d.data?.type === 'Commander Deck')
                : results;

            setPrecons(finalResults);

            // Hydrate images from internal DB
            hydrateDeckImages(finalResults);

        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleImport = async () => {
        if (!selectedDeck) return;
        setImporting(true);
        try {
            await api.createPreconDeck(selectedDeck.id, { mode: 'collection', useExisting: true });
            addToast(`Added "${selectedDeck.name}" to your collection!`, 'success');
            onDeckAdded(selectedDeck);
        } catch (err) {
            console.error(err);
            addToast('Failed to add deck. Please try again.', 'error');
        } finally {
            setImporting(false);
        }
    };

    // Smart Image Selection Logic
    const getDeckBackground = (deck) => {
        if (!deck || !deck.data) return deck?.image_uri || null;

        const getSafeArray = (arr) => Array.isArray(arr) ? arr : [];

        // Helper to extract art from single or double faced cards
        const getArt = (card) => {
            if (!card) return null;
            if (card.image_uris?.art_crop) return card.image_uris.art_crop;
            if (card.card_faces?.[0]?.image_uris?.art_crop) return card.card_faces[0].image_uris.art_crop;
            if (card.image_uris?.large) return card.image_uris.large;
            if (card.card_faces?.[0]?.image_uris?.large) return card.card_faces[0].image_uris.large;
            return null;
        };

        // 1. Try Commander Art (Best for flavor)
        const commanders = getSafeArray(deck.data.commander);
        if (commanders.length > 0) {
            const art = getArt(commanders[0]);
            if (art) return art;
        }

        // 2. Try explicitly set image_uri
        if (deck.image_uri) return deck.image_uri;

        // 3. Fallback: Find Highest CMC Card with art
        const allCards = [
            ...commanders,
            ...getSafeArray(deck.data.mainBoard),
            ...getSafeArray(deck.data.sideBoard)
        ];

        if (allCards.length === 0) return null;

        // Sort by CMC descending
        allCards.sort((a, b) => (b.cmc || 0) - (a.cmc || 0));

        // Return first valid art crop
        for (const card of allCards) {
            const art = getArt(card);
            if (art) return art;
        }

        return null;
    };

    return (
        <div className="w-full max-w-4xl mx-auto space-y-6 animate-fade-in">
            <div className="flex gap-4">
                <div className="relative flex-1">
                    <input
                        id="precon-search-input"
                        type="text"
                        placeholder="Search for a deck (e.g. 'Eldrazi', 'Slivers', 'Mothman')..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && searchPrecons(searchTerm)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-5 py-4 text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                    />
                    <button
                        onClick={() => searchPrecons(searchTerm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </button>
                </div>
            </div>

            {/* Results Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {loading ? (
                    <div className="col-span-full flex justify-center items-center h-40">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                    </div>
                ) : precons.length === 0 ? (
                    <div className="col-span-full text-center py-10 text-gray-500">
                        No decks found. Try searching for a commander or set name.
                    </div>
                ) : (
                    precons.map(deck => {
                        const bgImage = getDeckBackground(deck);
                        return (
                            <div
                                key={deck.id}
                                onClick={() => setSelectedDeck(deck)}
                                className={`
                                    relative group cursor-pointer rounded-xl overflow-hidden border-2 transition-all duration-200
                                    h-48 flex flex-col justify-end
                                    ${selectedDeck?.id === deck.id
                                        ? 'border-primary-500 ring-2 ring-primary-500/50 shadow-xl scale-[1.02] z-10'
                                        : 'border-gray-800 hover:border-gray-600 hover:-translate-y-1'}
                                `}
                            >
                                {/* Image Background - Brighter & Better Gradient */}
                                <div className="absolute inset-0 bg-gray-900 z-0">
                                    {bgImage && (
                                        <img
                                            src={bgImage}
                                            alt={deck.name}
                                            className="w-full h-full object-cover opacity-80 group-hover:opacity-60 transition-opacity"
                                        />
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                                </div>

                                <div className="relative z-10 p-4 w-full">
                                    <h3 className="text-lg font-bold text-white leading-tight mb-2 drop-shadow-md line-clamp-2">
                                        {deck.name}
                                    </h3>
                                    <div className="flex justify-between items-end">
                                        <span className="text-xs font-bold text-gray-200 bg-black/60 px-2 py-1 rounded backdrop-blur-md border border-white/10">
                                            {deck.set_code?.toUpperCase()}
                                        </span>
                                        {selectedDeck?.id === deck.id && (
                                            <div className="bg-primary-500 text-white p-1.5 rounded-full shadow-lg animate-fade-in shadow-primary-500/50">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Action Bar */}
            <div className="flex justify-end pt-4 border-t border-gray-800">
                <button
                    id="precon-import-btn"
                    onClick={handleImport}
                    disabled={!selectedDeck || importing}
                    className={`
                        px-8 py-3 rounded-xl font-bold text-white transition-all shadow-lg flex items-center gap-2
                        ${!selectedDeck || importing
                            ? 'bg-gray-700 cursor-not-allowed opacity-50'
                            : 'bg-primary-600 hover:bg-primary-500 hover:shadow-primary-500/25 transform hover:scale-105'}
                    `}
                >
                    {importing ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            Importing...
                        </>
                    ) : (
                        <>
                            Import Selected Deck
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default OnboardingPreconSearch;
