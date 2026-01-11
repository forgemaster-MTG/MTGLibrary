import React, { useMemo, useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import CardGridItem from '../components/common/CardGridItem';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import DeckCharts from '../components/DeckCharts';
import { useCollection } from '../hooks/useCollection';
import { useDecks } from '../hooks/useDecks';
import { getTierConfig } from '../config/tiers';

const MTG_IDENTITY_REGISTRY = [
    { badge: "White", colors: ["W"], theme: "Absolute Order" },
    { badge: "Blue", colors: ["U"], theme: "Infinite Inquiry" },
    { badge: "Black", colors: ["B"], theme: "Unrestricted Power" },
    { badge: "Red", colors: ["R"], theme: "Chaotic Passion" },
    { badge: "Green", colors: ["G"], theme: "Primal Growth" },
    { badge: "Azorius", colors: ["W", "U"], theme: "Bureaucratic Control" },
    { badge: "Dimir", colors: ["U", "B"], theme: "Subterfuge & Infiltration" },
    { badge: "Rakdos", colors: ["B", "R"], theme: "Carnival of Carnage" },
    { badge: "Gruul", colors: ["R", "G"], theme: "Primal Destruction" },
    { badge: "Selesnya", colors: ["G", "W"], theme: "Collective Harmony" },
    { badge: "Orzhov", colors: ["W", "B"], theme: "Indentured Eternity" },
    { badge: "Izzet", colors: ["U", "R"], theme: "Volatile Genus" },
    { badge: "Golgari", colors: ["B", "G"], theme: "Cycles of Rot" },
    { badge: "Boros", colors: ["R", "W"], theme: "Tactical Aggression" },
    { badge: "Simic", colors: ["G", "U"], theme: "Biological Evolution" },
    { badge: "Esper", colors: ["W", "U", "B"], theme: "Obsidian Logic" },
    { badge: "Grixis", colors: ["U", "B", "R"], theme: "Ruthless Tyranny" },
    { badge: "Jund", colors: ["B", "R", "G"], theme: "Apex Predation" },
    { badge: "Naya", colors: ["R", "G", "W"], theme: "Primal Majesty" },
    { badge: "Bant", colors: ["G", "W", "U"], theme: "Knightly Order" },
    { badge: "Abzan", colors: ["W", "B", "G"], theme: "Eternal Endurance" },
    { badge: "Jeskai", colors: ["U", "R", "W"], theme: "Disciplined Spark" },
    { badge: "Sultai", colors: ["B", "G", "U"], theme: "Opulent Decay" },
    { badge: "Mardu", colors: ["R", "W", "B"], theme: "Relentless Conquest" },
    { badge: "Temur", colors: ["G", "U", "R"], theme: "Elemental Instinct" },
    { badge: "WUBRG", colors: ["W", "U", "B", "R", "G"], theme: "The Convergence" },
    { badge: "Colorless", colors: ["C"], theme: "The Great Void" }
];

const PreconDeckPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { currentUser, userProfile } = useAuth();
    const { addToast } = useToast();

    const [deck, setDeck] = useState(null);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState('grid');
    const [creating, setCreating] = useState(null);
    const [activePartnerIndex, setActivePartnerIndex] = useState(0);

    useEffect(() => {
        const fetchDeck = async () => {
            try {
                const data = await api.get(`/api/precons/${id}`);
                setDeck(data);
            } catch (err) {
                console.error("Precon load failed", err);
                addToast("Failed to load precon", "error");
                navigate('/precons');
            } finally {
                setLoading(false);
            }
        };
        fetchDeck();
    }, [id, navigate, addToast]);

    // Flatten cards for unified processing
    const allCards = useMemo(() => {
        if (!deck) return [];
        return [
            ...(deck.data.commander || []).map(c => ({ ...c, isCommander: true })),
            ...(deck.data.mainBoard || []),
            // ...(deck.data.sideBoard || []) // Typically precons are Commander, so sideboard is unused or wishboard. Include if needed.
        ];
    }, [deck]);

    // Spotlight Logic: Commander or Highest CMC
    const spotlightCard = useMemo(() => {
        if (!deck) return null;
        const commanders = deck.data.commander || [];
        if (commanders.length > 0) return commanders[0];

        // Find highest CMC in mainboard
        let highest = null;
        let maxCMC = -1;

        // Helper to get CMC safe
        const getCMC = (c) => c.data?.cmc || c.cmc || 0;

        for (const c of (deck.data.mainBoard || [])) {
            const cmc = getCMC(c);
            if (cmc > maxCMC) {
                maxCMC = cmc;
                highest = c;
            }
        }
        return highest;
    }, [deck]);

    const partnerCard = useMemo(() => {
        if (!deck?.data?.commander || deck.data.commander.length < 2) return null;
        return deck.data.commander[1];
    }, [deck]);

    // Active displayed commander (allows toggling partners)
    const activeCommander = activePartnerIndex === 0 ? spotlightCard : (partnerCard || spotlightCard);

    // Resolve Image Helper
    const resolveImage = (c) => {
        if (!c) return '';
        if (c.image_uris?.normal) return c.image_uris.normal;
        if (c.card_faces?.[0]?.image_uris?.normal) return c.card_faces[0].image_uris.normal;
        if (c.data?.image_uris?.normal) return c.data.image_uris.normal;
        if (c.data?.card_faces?.[0]?.image_uris?.normal) return c.data.card_faces[0].image_uris.normal;

        // Handle Identifier if needed (though resolved in API now usually)
        return 'https://placehold.co/400x600'; // fallback
    };

    const resolveArtCrop = (c) => {
        if (!c) return '';
        if (c.image_uris?.art_crop) return c.image_uris.art_crop;
        if (c.data?.image_uris?.art_crop) return c.data.image_uris.art_crop;
        if (c.card_faces?.[0]?.image_uris?.art_crop) return c.card_faces[0].image_uris.art_crop;
        if (c.data?.card_faces?.[0]?.image_uris?.art_crop) return c.data.card_faces[0].image_uris.art_crop;
        return resolveImage(c); // fallback to normal
    };

    const commanderImage = resolveArtCrop(activeCommander);
    const colorIdentityMap = { W: 'https://svgs.scryfall.io/card-symbols/W.svg', U: 'https://svgs.scryfall.io/card-symbols/U.svg', B: 'https://svgs.scryfall.io/card-symbols/B.svg', R: 'https://svgs.scryfall.io/card-symbols/R.svg', G: 'https://svgs.scryfall.io/card-symbols/G.svg' };

    // Derived Stats
    const totalCards = useMemo(() => {
        return allCards.reduce((acc, c) => acc + (c.count || c.quantity || 1), 0);
    }, [allCards]);

    const totalValue = useMemo(() => {
        return allCards.reduce((acc, c) => {
            const price = parseFloat(c.prices?.usd || c.prices?.usd_foil || c.data?.prices?.usd || c.data?.prices?.usd_foil || 0);
            return acc + (price * (c.count || c.quantity || 1));
        }, 0);
    }, [allCards]);

    // Grouping
    const groupedCards = useMemo(() => {
        const groups = {
            Commander: [], Creature: [], Planeswalker: [], Instant: [],
            Sorcery: [], Artifact: [], Enchantment: [], Land: [], Other: []
        };

        allCards.forEach(c => {
            // For display, if it's in the commander array, it goes to Commander group
            if (c.isCommander) {
                groups.Commander.push(c);
                return;
            }

            const typeLine = (c.data?.type_line || c.type || '').toLowerCase();
            if (typeLine.includes('creature')) groups.Creature.push(c);
            else if (typeLine.includes('planeswalker')) groups.Planeswalker.push(c);
            else if (typeLine.includes('instant')) groups.Instant.push(c);
            else if (typeLine.includes('sorcery')) groups.Sorcery.push(c);
            else if (typeLine.includes('artifact')) groups.Artifact.push(c);
            else if (typeLine.includes('enchantment')) groups.Enchantment.push(c);
            else if (typeLine.includes('land')) groups.Land.push(c);
            else groups.Other.push(c);
        });

        // Normalize card objects for GridItem if needed (ensure image_uri is present)
        Object.keys(groups).forEach(key => {
            groups[key] = groups[key].map(c => ({ ...c, image_uri: resolveImage(c) }));
        });

        return Object.fromEntries(Object.entries(groups).filter(([_, list]) => list.length > 0));
    }, [allCards]);

    const identityInfo = useMemo(() => {
        if (!deck) return MTG_IDENTITY_REGISTRY.find(i => i.badge === 'Colorless');
        const colors = deck.data?.colors || [];
        const match = MTG_IDENTITY_REGISTRY.find(entry => {
            if (entry.colors.length !== colors.length) return false;
            return entry.colors.every(c => colors.includes(c));
        });
        return match || MTG_IDENTITY_REGISTRY.find(i => i.badge === 'Colorless');
    }, [deck]);

    const { cards: collection } = useCollection();
    const { decks } = useDecks();

    const handleCreate = async (mode) => {
        // Enforce Limits
        const tierId = userProfile?.subscription_tier || 'free';
        const config = getTierConfig(tierId);

        // 1. Deck Limit
        const deckLimit = config.limits.decks;
        if (deckLimit !== Infinity && decks && decks.length >= deckLimit) {
            addToast(`Deck limit reached (${decks.length}/${deckLimit}). Upgrade to add this deck!`, 'error');
            return;
        }

        // 2. Collection/Wishlist Limit
        const isWishlist = mode === 'wishlist';
        const limitType = isWishlist ? 'wishlist' : 'collection';
        const limit = config.limits[limitType];

        if (limit !== Infinity && collection) {
            // Count current
            const currentCount = collection
                .filter(c => !!c.is_wishlist === isWishlist)
                .reduce((acc, c) => acc + (c.count || 1), 0);

            // Count adding
            const addingCount = totalCards; // pre-calculated memo

            if (currentCount + addingCount > limit) {
                addToast(`${isWishlist ? 'Wishlist' : 'Collection'} limit reached. Cannot add ${addingCount} cards. Upgrade needed!`, 'error');
                return;
            }
        }

        setCreating(mode);
        try {
            const result = await api.post(`/api/precons/${deck.id}/create`, { mode });
            if (result.success) {
                addToast('Deck created successfully!', 'success');
                navigate(`/decks/${result.deckId}`);
            }
        } catch (err) {
            console.error(err);
            if (err.message && err.message.includes('Limit reached')) {
                addToast(err.message, 'error');
            } else {
                addToast('Failed to create deck', 'error');
            }
        } finally {
            setCreating(null);
        }
    };

    if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center"><div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-500"></div></div>;
    if (!deck) return null;

    return (
        <div className="relative min-h-screen bg-gray-950 text-white font-sans">
            {/* Background */}
            <div
                className="fixed inset-0 z-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${commanderImage})` }}
            >
                <div className="absolute inset-0 bg-gray-950/20" />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-4 py-8 pb-24 pt-20">

                {/* Breadcrumb */}
                <div className="flex items-center gap-2 text-sm text-gray-400 mb-2 font-bold">
                    <Link to="/precons" className="hover:text-white transition-colors">Precons</Link>
                    <span>/</span>
                    {deck.data.code && (
                        <>
                            <Link to={`/precons/set/${deck.data.code}`} className="hover:text-white transition-colors">{deck.data.code}</Link>
                            <span>/</span>
                        </>
                    )}
                    <span className="text-white">{deck.name}</span>
                </div>

                {/* Header Card */}
                <div className="bg-gradient-to-r from-gray-900/90 via-gray-900/60 to-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 md:p-8 mb-8 shadow-2xl">
                    <div className="flex flex-col md:flex-row justify-between gap-6 items-start md:items-center">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-widest rounded border border-indigo-500/30">
                                    {deck.type || 'Commander'}
                                </span>
                                <span className="text-gray-500 text-xs font-bold uppercase tracking-wide">
                                    Official Precon
                                </span>
                            </div>
                            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tighter leading-tight mb-2">
                                {deck.name}
                            </h1>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1">
                                    {(deck.data.colors || []).map(c => (
                                        <img key={c} src={colorIdentityMap[c]} alt={c} className="w-6 h-6" />
                                    ))}
                                </div>
                                <div className="h-4 w-px bg-white/10" />
                                <div className="text-sm font-bold text-gray-400">{identityInfo?.theme || 'Deck'}</div>
                            </div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                            <div className="text-2xl font-mono font-bold text-green-400">
                                ${totalValue.toFixed(2)}
                            </div>
                            <div className="text-xs text-gray-500 uppercase tracking-widest font-bold">
                                {totalCards} Cards
                            </div>
                            <div className="flex flex-wrap justify-end gap-2 mt-2">
                                <a
                                    href={`https://www.amazon.com/s?k=${encodeURIComponent(deck.name)}&tag=mtgsite-20`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-[#FF9900] text-black px-4 py-2 rounded-xl font-black hover:bg-[#FF9900]/90 transition-colors shadow-lg shadow-orange-900/20 text-xs uppercase tracking-wider flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M15.54 13.924c-1.35 1.572-3.645 2.502-5.466 2.502-3.132 0-5.187-1.487-6.264-2.292l-.768 1.488c1.374 1.05 4.092 3.036 8.046 2.454 2.829-.414 5.37-2.67 6.096-3.816l-1.644-.336zM3.444 19.542l1.626 1.104c.126.066.27.018.33-.096.792-2.142 2.766-3.21 2.898-3.276.102-.054.126-.18.066-.27l-1.632-2.07c-.066-.09-.192-.09-.264-.024-.03.042-2.22 2.652-3.09 4.392-.048.102.006.21.066.24zM20.598 6.942C20.598 6.942 18.078 2.37 11.232 2.598 4.296 2.826 2.898 7.356 2.898 7.356c-.054.168.042.33.204.372l1.83.474c.144.036.294-.036.354-.168.03-.066 1.038-2.61 5.388-2.88 2.058-.126 4.194.516 5.34 1.764.57.624.81 1.434.69 2.214-1.284.186-2.58.348-3.84.48-4.2.438-6.198 2.052-6.114 4.542.06 1.764 1.344 3.324 3.96 3.258 2.634-.066 4.104-1.848 4.104-1.848v1.446c0 .168.126.3.288.3h1.992c.162 0 .288-.132.288-.3l.006-4.944c-.006-3.324-1.746-5.124-4.8-5.124H20.598zM12.924 10.998c0 .672-.084 1.458-.87 2.016-.624.456-1.398.546-1.956.558-1.098.024-1.722-.594-1.758-1.218-.048-1.02 0-1.872 4.584-2.316v.96z" />
                                    </svg>
                                    Amazon
                                </a>
                                <a
                                    href={`https://partner.tcgplayer.com/jexzaZ?u=${encodeURIComponent(`https://www.tcgplayer.com/search/magic/product?productLineName=magic&q=${deck.name}&view=grid`)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-[#2a2a2a] text-white px-4 py-2 rounded-xl font-black hover:bg-[#3a3a3a] transition-colors shadow-lg shadow-black/20 text-xs uppercase tracking-wider flex items-center gap-2 border border-white/10"
                                >
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 2L2 7l10 5 10-5-10-5zm0 9l2.5-1.25L12 8.5l-2.5 1.25L12 11zm0 2.5l-5-2.5-5 2.5L12 22l10-8.5-5-2.5-5 2.5z" />
                                    </svg>
                                    TCGPlayer
                                </a>
                                <button
                                    onClick={() => handleCreate('collection')}
                                    disabled={creating}
                                    className="bg-white text-gray-900 px-6 py-2 rounded-xl font-bold hover:bg-gray-200 transition-colors shadow-lg shadow-white/10 text-sm disabled:opacity-50"
                                >
                                    {creating === 'collection' ? 'Adding...' : 'Add to Collection'}
                                </button>
                                <button
                                    onClick={() => handleCreate('wishlist')}
                                    disabled={creating}
                                    className="bg-gray-800 text-white border border-gray-700 px-4 py-2 rounded-xl font-bold hover:bg-gray-700 transition-colors text-sm disabled:opacity-50"
                                >
                                    Wishlist
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content Layout */}
                <div className="flex flex-col lg:flex-row gap-8">

                    {/* Left: Decklist */}
                    <div className="flex-1 order-3 lg:order-1 space-y-8">
                        <div className="bg-gray-950/10 backdrop-blur-md rounded-3xl border border-white/5 overflow-hidden">
                            <div className="p-4 bg-white/5 border-b border-white/5 flex justify-between items-center">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                    Decklist
                                </h3>
                                <div className="flex bg-gray-900/50 rounded-lg p-1 gap-1 border border-gray-700">
                                    <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-gray-700 text-white' : 'text-gray-400'}`}>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
                                    </button>
                                    <button onClick={() => setViewMode('table')} className={`p-1.5 rounded ${viewMode === 'table' ? 'bg-gray-700 text-white' : 'text-gray-400'}`}>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path></svg>
                                    </button>
                                </div>
                            </div>

                            <div className="p-4 space-y-8">
                                {Object.entries(groupedCards).map(([type, cards]) => (
                                    <div key={type}>
                                        <h4 className="text-xs font-black text-indigo-300 uppercase tracking-widest border-b border-indigo-500/20 mb-3 pb-1 flex justify-between">
                                            <span>{type}</span>
                                            <span className="text-gray-500">
                                                {cards.reduce((acc, c) => acc + (c.count || c.quantity || 1), 0)}
                                            </span>
                                        </h4>
                                        {viewMode === 'grid' ? (
                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                                {cards.map((card, i) => (
                                                    <CardGridItem
                                                        key={i}
                                                        card={card}
                                                        readOnly
                                                        showQuantity={true}
                                                    />
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="space-y-1">
                                                {cards.map((card, i) => (
                                                    <div key={i} className="flex justify-between p-2 hover:bg-white/5 rounded text-sm text-gray-300">
                                                        <div className="flex gap-2">
                                                            <span className="font-mono text-gray-500">{card.count || card.quantity || 1}</span>
                                                            <span className={card.finish === 'foil' ? 'text-yellow-200' : ''}>{card.name}</span>
                                                        </div>
                                                        <div className="font-mono text-xs opacity-50">{card.manacost || card.mana_cost || card.data?.mana_cost}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right: Sidebar */}
                    <div className="w-full lg:w-80 shrink-0 order-1 lg:order-2 space-y-6">
                        {/* FEATURED CARD (Commander or Spotlight) */}
                        <div className="bg-gray-950/10 backdrop-blur-md rounded-3xl border border-white/5 overflow-hidden p-6 relative">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-white/5 pb-2">
                                {spotlightCard?.isCommander ? 'Commander' : 'Spotlight Card'}
                            </h3>
                            <div className="relative group">
                                <img
                                    src={resolveImage(activeCommander) || 'https://placehold.co/400x600'}
                                    className="w-full rounded-xl shadow-2xl hover:scale-105 transition-transform duration-500"
                                    alt="Featured Card"
                                />
                                {activeCommander?.data?.card_faces?.length > 1 && activeCommander.data.card_faces[1].image_uris && (
                                    <button className="absolute bottom-2 right-2 p-2 bg-gray-900/80 rounded block md:hidden" title="Flip">↻</button>
                                )}
                            </div>

                            {partnerCard && (
                                <button
                                    onClick={() => setActivePartnerIndex(i => i === 0 ? 1 : 0)}
                                    className="mt-4 w-full py-2 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 text-xs font-bold uppercase rounded-lg border border-indigo-500/20 transition-colors"
                                >
                                    {activePartnerIndex === 0 ? 'View Partner' : 'View Commander'}
                                </button>
                            )}
                        </div>

                        {/* Analytics */}
                        <div className="bg-gray-950/10 backdrop-blur-md rounded-3xl border border-white/5 overflow-hidden p-6 order-2">
                            <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Analytics</h3>
                            </div>
                            <div className="space-y-6">
                                <div className="h-[120px]">
                                    <h4 className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 text-center">Mana Curve</h4>
                                    <DeckCharts cards={allCards} type="mana" />
                                </div>
                                <div className="h-[220px]">
                                    <h4 className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 text-center">Type Dist</h4>
                                    <DeckCharts cards={allCards} type="types" />
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default PreconDeckPage;
