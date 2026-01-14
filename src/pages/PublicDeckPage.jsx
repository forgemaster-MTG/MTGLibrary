import React, { useMemo, useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import CardGridItem from '../components/common/CardGridItem';
import { useAuth } from '../contexts/AuthContext';
import { deckService } from '../services/deckService';
import { useToast } from '../contexts/ToastContext';
import DeckCharts from '../components/DeckCharts';
import DeckStatsModal from '../components/modals/DeckStatsModal';
import DeckDoctorModal from '../components/modals/DeckDoctorModal';

const MTG_IDENTITY_REGISTRY = [
    { badge: "White", colors: ["W"], theme: "Absolute Order", flavor_text: "A single spark of light can banish a world of shadows." },
    { badge: "Blue", colors: ["U"], theme: "Infinite Inquiry", flavor_text: "The mind is the only battlefield where victory is absolute." },
    { badge: "Black", colors: ["B"], theme: "Unrestricted Power", flavor_text: "Power at any cost, for greatness is written in blood." },
    { badge: "Red", colors: ["R"], theme: "Chaotic Passion", flavor_text: "Do not fear the fire; fear the heart that commands it." },
    { badge: "Green", colors: ["G"], theme: "Primal Growth", flavor_text: "The forest does not ask for permission to grow." },
    { badge: "Azorius", colors: ["W", "U"], theme: "Bureaucratic Control", flavor_text: "Justice is blind, but she has a very long reach." },
    { badge: "Dimir", colors: ["U", "B"], theme: "Subterfuge & Infiltration", flavor_text: "The finest secrets are those that kill the ones who keep them." },
    { badge: "Rakdos", colors: ["B", "R"], theme: "Carnival of Carnage", flavor_text: "Entertain us, or become the entertainment." },
    { badge: "Gruul", colors: ["R", "G"], theme: "Primal Destruction", flavor_text: "Not for city-dwellers. Not for the weak. Only for the weak." },
    { badge: "Selesnya", colors: ["G", "W"], theme: "Collective Harmony", flavor_text: "One voice is a whisper; the Conclave is a roar." },
    { badge: "Orzhov", colors: ["W", "B"], theme: "Indentured Eternity", flavor_text: "Even death is no excuse for a breach of contract." },
    { badge: "Izzet", colors: ["U", "R"], theme: "Volatile Genius", flavor_text: "If it doesn’t explode, you aren't trying hard enough." },
    { badge: "Golgari", colors: ["B", "G"], theme: "Cycles of Rot", flavor_text: "Every grave is a garden if you wait long enough." },
    { badge: "Boros", colors: ["R", "W"], theme: "Tactical Aggression", flavor_text: "First to the fight, last to the fall." },
    { badge: "Simic", colors: ["G", "U"], theme: "Biological Evolution", flavor_text: "Nature is a rough draft; we are the final edit." },
    { badge: "Esper", colors: ["W", "U", "B"], theme: "Obsidian Logic", flavor_text: "Perfection is not a goal; it is a requirement." },
    { badge: "Grixis", colors: ["U", "B", "R"], theme: "Ruthless Tyranny", flavor_text: "A wasteland of power where only the cruelest thrive." },
    { badge: "Jund", colors: ["B", "R", "G"], theme: "Apex Predation", flavor_text: "In this world, you are either the dragon or the meal." },
    { badge: "Naya", colors: ["R", "G", "W"], theme: "Primal Majesty", flavor_text: "Where the mountains wake and the earth trembles." },
    { badge: "Bant", colors: ["G", "W", "U"], theme: "Knightly Order", flavor_text: "The sigil of the sun protects those who stand together." },
    { badge: "Abzan", colors: ["W", "B", "G"], theme: "Eternal Endurance", flavor_text: "We do not break; we simply outlast." },
    { badge: "Jeskai", colors: ["U", "R", "W"], theme: "Disciplined Spark", flavor_text: "The wind carries the strike; the mind guides the bolt." },
    { badge: "Sultai", colors: ["B", "G", "U"], theme: "Opulent Decay", flavor_text: "Power is measured in gold and the bones of the fallen." },
    { badge: "Mardu", colors: ["R", "W", "B"], theme: "Relentless Conquest", flavor_text: "Victory is the only law worth following." },
    { badge: "Temur", colors: ["G", "U", "R"], theme: "Elemental Instinct", flavor_text: "The wild does not think; it reacts with ice and fire." },
    { badge: "Glint-Eye", colors: ["U", "B", "R", "G"], theme: "Chaotic Adaptation", flavor_text: "Order is a cage; we have chosen to break the locks." },
    { badge: "Dune-Brood", colors: ["W", "B", "R", "G"], theme: "Sandless Conquest", flavor_text: "When the logic of the mind fails, the instinct of the swarm prevails." },
    { badge: "Ink-Treader", colors: ["W", "U", "R", "G"], theme: "Radiant Reflection", flavor_text: "To touch one is to touch the whole of the world." },
    { badge: "Witch-Maw", colors: ["W", "U", "B", "G"], theme: "Eldritch Growth", flavor_text: "There is a hunger beneath the earth that knows no fire." },
    { badge: "Yore-Tiller", colors: ["W", "U", "B", "R"], theme: "Relentless History", flavor_text: "The past is a weapon we sharpen for the future." },
    { badge: "WUBRG", colors: ["W", "U", "B", "R", "G"], theme: "The Convergence", flavor_text: "The full spectrum of power, bound in a single hand." },
    { badge: "Colorless", colors: ["C"], theme: "The Great Void", flavor_text: "Existence is a fleeting dream in the eyes of the silent." }
];

const PublicDeckPage = () => {
    const { slug } = useParams();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const { addToast } = useToast();

    const [deckData, setDeckData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [viewMode, setViewMode] = useState('grid');
    const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
    const [isDoctorOpen, setIsDoctorOpen] = useState(false);
    const [activeCommanderIndex, setActiveCommanderIndex] = useState(0);

    useEffect(() => {
        const fetchDeck = async () => {
            try {
                const data = await api.get(`/api/decks/public/${slug}`);
                setDeckData(data); // Expects { deck, items, isPublicView: true }
            } catch (err) {
                console.error("Public deck load failed", err);
                setError("Deck not found or private.");
            } finally {
                setLoading(false);
            }
        };
        fetchDeck();
    }, [slug]);

    const { deck, items: deckCards } = deckData || {};

    // --- Derived Data (Copied logic from DeckDetailsPage) ---
    const identityInfo = useMemo(() => {
        if (!deck) return MTG_IDENTITY_REGISTRY.find(i => i.badge === 'Colorless');

        // Standard Deck Logic
        if (deck?.format?.toLowerCase() === 'standard') {
            const colors = deck.colors || deck.commander?.color_identity || [];
            const match = MTG_IDENTITY_REGISTRY.find(entry => {
                if (entry.colors.length !== colors.length) return false;
                return entry.colors.every(c => colors.includes(c));
            });
            return match || { badge: "Standard", theme: "Constructed", flavor_text: "A format defined by rotation and meta mastery." };
        }

        const mainColors = deck?.commander?.color_identity || [];
        const partnerColors = deck?.commander_partner?.color_identity || [];
        const deckColors = [...new Set([...mainColors, ...partnerColors])];

        if (deckColors.length === 0) return MTG_IDENTITY_REGISTRY.find(i => i.badge === 'Colorless');

        const match = MTG_IDENTITY_REGISTRY.find(entry => {
            if (entry.colors.length !== deckColors.length) return false;
            return entry.colors.every(c => deckColors.includes(c));
        });

        return match || MTG_IDENTITY_REGISTRY.find(i => i.badge === 'Colorless');
    }, [deck]);

    const totalCards = useMemo(() => {
        if (!deckCards) return 0;
        let total = deckCards.reduce((acc, c) => acc + (c.countInDeck || c.count || 1), 0);

        // Account for Commanders if not in list
        const commanderId = deck?.commander?.id || deck?.commander?.scryfall_id;
        const partnerId = deck?.commander_partner?.id || deck?.commander_partner?.scryfall_id;

        if (deck?.commander && !deckCards.some(c => (c.scryfall_id || c.id) === commanderId)) total++;
        if (deck?.commander_partner && !deckCards.some(c => (c.scryfall_id || c.id) === partnerId)) total++;

        return total;
    }, [deckCards, deck]);

    const totalValue = useMemo(() => {
        if (!deckCards) return 0;
        let value = deckCards.reduce((acc, c) => {
            const price = parseFloat(c.prices?.[c.finish === 'foil' ? 'usd_foil' : 'usd'] || c.data?.prices?.[c.finish === 'foil' ? 'usd_foil' : 'usd'] || 0);
            return acc + (price * (c.countInDeck || c.count || 1));
        }, 0);

        // Add commander value
        const commanderId = deck?.commander?.id || deck?.commander?.scryfall_id;
        const partnerId = deck?.commander_partner?.id || deck?.commander_partner?.scryfall_id;

        if (deck?.commander && !deckCards.some(c => (c.scryfall_id || c.id) === commanderId)) {
            const c = deck.commander;
            value += parseFloat(c.prices?.usd || 0);
        }
        if (deck?.commander_partner && !deckCards.some(c => (c.scryfall_id || c.id) === partnerId)) {
            const c = deck.commander_partner;
            value += parseFloat(c.prices?.usd || 0);
        }

        return value;
    }, [deckCards, deck]);

    const countByType = (type) => {
        if (!deckCards) return 0;
        let count = deckCards.reduce((acc, c) => {
            const cardData = c.data || c;
            return ((cardData.type_line || '').includes(type) ? acc + (c.countInDeck || 1) : acc);
        }, 0);

        // Header commanders
        const commanderId = deck?.commander?.id || deck?.commander?.scryfall_id;
        const partnerId = deck?.commander_partner?.id || deck?.commander_partner?.scryfall_id;

        if (deck?.commander && !deckCards.some(c => (c.scryfall_id || c.id) === commanderId)) {
            if ((deck.commander.type_line || '').includes(type)) count++;
        }
        if (deck?.commander_partner && !deckCards.some(c => (c.scryfall_id || c.id) === partnerId)) {
            if ((deck.commander_partner.type_line || '').includes(type)) count++;
        }
        return count;
    };

    const kpiData = useMemo(() => {
        const blueprint = deck?.ai_blueprint || deck?.aiBlueprint || {};
        const targets = blueprint.layout?.types || blueprint.suggestedCounts || {};

        const layout = [
            { label: 'Total', current: totalCards, target: (deck?.format?.toLowerCase() === 'standard' || deck?.format?.toLowerCase() === 'modern' ? 60 : 100) },
            { label: 'Creatures', current: countByType('Creature'), target: targets.Creatures || targets.Creature || 30 },
            { label: 'Lands', current: countByType('Land'), target: targets.Lands || targets.Land || 36 },
            { label: 'Instants', current: countByType('Instant'), target: targets.Instants || targets.Instant || 10 },
            { label: 'Sorceries', current: countByType('Sorcery'), target: targets.Sorceries || targets.Sorcery || 10 },
            { label: 'Enchantments', current: countByType('Enchantment'), target: targets.Enchantments || targets.Enchantment || 5 },
            { label: 'Artifacts', current: countByType('Artifact'), target: targets.Artifacts || targets.Artifact || 10 },
            { label: 'Planeswalkers', current: countByType('Planeswalker'), target: targets.Planeswalkers || targets.Planeswalker || 0 },
        ];

        return layout.filter(item => item.target > 0);
    }, [deck, totalCards, deckCards]);

    const groupedCards = useMemo(() => {
        if (!deckCards) return {};
        const groups = {
            Commander: [], Creature: [], Planeswalker: [], Instant: [],
            Sorcery: [], Artifact: [], Enchantment: [], Land: [], Other: []
        };

        deckCards.forEach(c => {
            const cardData = c.data || c;
            const typeLine = (cardData.type_line || '').toLowerCase();
            const cid = c.scryfall_id || c.id;

            const isCommander = deck?.commander && (cid === (deck.commander.id || deck.commander.scryfall_id));
            const isPartner = deck?.commander_partner && (cid === (deck.commander_partner.id || deck.commander_partner.scryfall_id));

            if (isCommander || isPartner) {
                groups.Commander.push(c);
                return;
            }

            if (typeLine.includes('creature')) groups.Creature.push(c);
            else if (typeLine.includes('planeswalker')) groups.Planeswalker.push(c);
            else if (typeLine.includes('instant')) groups.Instant.push(c);
            else if (typeLine.includes('sorcery')) groups.Sorcery.push(c);
            else if (typeLine.includes('artifact')) groups.Artifact.push(c);
            else if (typeLine.includes('enchantment')) groups.Enchantment.push(c);
            else if (typeLine.includes('land')) groups.Land.push(c);
            else groups.Other.push(c);
        });

        return Object.fromEntries(Object.entries(groups).filter(([_, list]) => list.length > 0));
    }, [deckCards, deck]);

    if (loading) return <div className="min-h-screen bg-gray-950 flex justify-center items-center"><div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-500"></div></div>;
    if (error || !deck) return <div className="min-h-screen bg-gray-950 flex justify-center items-center text-red-500 font-bold text-xl">{error || "Deck inaccessible"}</div>;

    const activeCommander = activeCommanderIndex === 0 ? deck.commander : (deck.commander_partner || deck.commander);
    const commanderImage = activeCommander?.image_uris?.art_crop || activeCommander?.card_faces?.[0]?.image_uris?.art_crop || '';
    const colorIdentityMap = { W: 'https://svgs.scryfall.io/card-symbols/W.svg', U: 'https://svgs.scryfall.io/card-symbols/U.svg', B: 'https://svgs.scryfall.io/card-symbols/B.svg', R: 'https://svgs.scryfall.io/card-symbols/R.svg', G: 'https://svgs.scryfall.io/card-symbols/G.svg' };

    const handleClone = async () => {
        if (!currentUser) return;
        try {
            addToast('Cloning deck...', 'info');
            // Create New Deck
            const newDeck = await deckService.createDeck(currentUser.uid, {
                name: `Copy of ${deck.name}`,
                commander: deck.commander,
                commanderPartner: deck.commander_partner,
                format: deck.format,
                isMockup: true // Clone as mockup/wishlist initially
            });

            // Batch Add Cards
            const cardData = deckCards.map(c => ({
                scryfall_id: c.scryfall_id || c.id,
                name: c.name,
                set_code: c.set_code,
                collector_number: c.collector_number,
                finish: c.finish,
                image_uri: c.image_uri,
                data: c.data
            }));

            await api.post(`/api/decks/${newDeck.id}/cards/batch`, { cards: cardData });

            addToast('Deck cloned successfully!', 'success');
            navigate(`/decks/${newDeck.id}`);
        } catch (err) {
            console.error(err);
            addToast('Failed to clone deck', 'error');
        }
    };

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

                {/* Header Card */}
                <div className="bg-gradient-to-r from-gray-900/90 via-gray-900/60 to-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 md:p-8 mb-8 shadow-2xl">
                    <div className="flex flex-col md:flex-row justify-between gap-6 items-start md:items-center">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-widest rounded border border-indigo-500/30">
                                    {deck.format || 'Commander'}
                                </span>
                                <span className="text-gray-500 text-xs font-bold uppercase tracking-wide">
                                    Shared by {deck.user_id ? 'a User' : 'Unknown'}
                                </span>
                            </div>
                            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tighter leading-tight mb-2">
                                {deck.name}
                            </h1>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1">
                                    {(() => {
                                        const mainColors = deck?.commander?.color_identity || [];
                                        const partnerColors = deck?.commander_partner?.color_identity || [];
                                        const allColors = [...new Set([...mainColors, ...partnerColors])];
                                        return allColors.map(c => (
                                            <img key={c} src={colorIdentityMap[c]} alt={c} className="w-6 h-6" />
                                        ));
                                    })()}
                                </div>
                                <div className="h-4 w-px bg-white/10" />
                                <div className="text-sm font-bold text-gray-400">{identityInfo.theme}</div>
                            </div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                            <div className="text-2xl font-mono font-bold text-green-400">
                                ${totalValue.toFixed(2)}
                            </div>
                            <div className="text-xs text-gray-500 uppercase tracking-widest font-bold">
                                {totalCards} Cards
                            </div>
                            {currentUser ? (
                                <button
                                    onClick={handleClone}
                                    className="mt-2 bg-white text-gray-900 px-6 py-2 rounded-xl font-bold hover:bg-gray-200 transition-colors shadow-lg shadow-white/10 text-sm"
                                >
                                    Clone to Collection
                                </button>
                            ) : (
                                <Link to="/login" className="mt-2 bg-white text-gray-900 px-6 py-2 rounded-xl font-bold hover:bg-gray-200 transition-colors shadow-lg shadow-white/10 text-sm">
                                    Login to Clone
                                </Link>
                            )}
                        </div>
                    </div>
                </div>

                {/* KPI Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-8">
                    {kpiData.map((kpi, idx) => {
                        const progress = kpi.target > 0 ? Math.min((kpi.current / kpi.target) * 100, 100) : 0;
                        const isPerfect = kpi.target > 0 && kpi.current === kpi.target;
                        const isOver = kpi.target > 0 && kpi.current > kpi.target;

                        return (
                            <div key={idx} className="bg-gray-950/20 p-3 rounded-xl border border-white/5 backdrop-blur-md shadow-lg">
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{kpi.label}</span>
                                    <span className={`text-xs font-mono font-bold ${isPerfect ? 'text-green-400' : isOver ? 'text-orange-400' : 'text-indigo-300'}`}>
                                        {kpi.current}<span className="text-gray-600 mx-0.5">/</span>{kpi.target || '?'}
                                    </span>
                                </div>
                                <div className="h-1.5 w-full bg-gray-900 rounded-full overflow-hidden border border-gray-700/30">
                                    <div
                                        className={`h-full transition-all duration-700 ${isPerfect ? 'bg-green-500' : isOver ? 'bg-orange-500' : 'bg-indigo-500'}`}
                                        style={{ width: `${progress || 0}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Content Layout */}
                <div className="flex flex-col lg:flex-row gap-8">

                    {/* Left: Decklist (Takes remaining space) */}
                    <div className="flex-1 order-3 lg:order-1 space-y-8">

                        {/* DECKLIST GRID/TABLE AREA */}
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
                                            <span className="text-gray-500">{cards.length}</span>
                                        </h4>
                                        {viewMode === 'grid' ? (
                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                                {cards.map((card, i) => (
                                                    <CardGridItem key={i} card={card} readOnly />
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="space-y-1">
                                                {cards.map((card, i) => (
                                                    <div key={i} className="flex justify-between p-2 hover:bg-white/5 rounded text-sm text-gray-300">
                                                        <div className="flex gap-2">
                                                            <span className="font-mono text-gray-500">{card.countInDeck || 1}</span>
                                                            <span className={card.finish === 'foil' ? 'text-yellow-200' : ''}>{card.name}</span>
                                                        </div>
                                                        <div className="font-mono text-xs opacity-50">{card.mana_cost}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right: Sidebar (Fixed Width) */}
                    <div className="w-full lg:w-80 shrink-0 order-1 lg:order-2 space-y-6">

                        {/* COMMANDER CARD */}
                        {deck.commander && (
                            <div className="bg-gray-950/10 backdrop-blur-md rounded-3xl border border-white/5 overflow-hidden p-6 relative">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-white/5 pb-2">Commander</h3>
                                <img
                                    src={activeCommander?.image_uris?.normal || activeCommander?.card_faces?.[0]?.image_uris?.normal || 'https://placehold.co/400x600'}
                                    className="w-full rounded-xl shadow-2xl hover:scale-105 transition-transform duration-500"
                                    alt="Commander"
                                />
                                {deck.commander_partner && (
                                    <button
                                        onClick={() => setActiveCommanderIndex(i => i === 0 ? 1 : 0)}
                                        className="mt-4 w-full py-2 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 text-xs font-bold uppercase rounded-lg border border-indigo-500/20 transition-colors"
                                    >
                                        View Partner
                                    </button>
                                )}
                            </div>
                        )}

                        {/* ANALYTICS SIDEBAR CARD */}
                        <div className="bg-gray-950/10 backdrop-blur-md rounded-3xl border border-white/5 overflow-hidden p-6 order-2">
                            <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Analytics</h3>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setIsDoctorOpen(true)}
                                        className="text-[10px] font-black text-white uppercase tracking-[0.2em] bg-indigo-600 flex flex-col items-center gap-2 p-3 rounded-2xl hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-900/40 group overflow-hidden"
                                    >
                                        <svg className="w-8 h-8 text-white group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                                        <span className="text-[8px]">Deck Doctor</span>
                                    </button>
                                    <button
                                        onClick={() => setIsStatsModalOpen(true)}
                                        className="text-[10px] font-bold text-indigo-400 hover:text-white uppercase tracking-wider bg-indigo-500/10 px-2 py-1 rounded hover:bg-indigo-500/20 transition-colors"
                                    >
                                        Details ↗
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="h-[120px]">
                                    <h4 className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 text-center">Mana Curve</h4>
                                    <DeckCharts cards={deckCards} type="mana" />
                                </div>
                                <div className="h-[160px]">
                                    <h4 className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 text-center">Type Dist</h4>
                                    <DeckCharts cards={deckCards} type="types" />
                                </div>
                            </div>
                        </div>

                        {/* Prompt to Join */}
                        {!currentUser && (
                            <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 backdrop-blur-md rounded-3xl border border-white/10 p-6 text-center">
                                <h3 className="font-bold text-white mb-2">Build Your Own Decks</h3>
                                <p className="text-xs text-gray-400 mb-4">Join MTG Forge to manage your collection, build decks with AI, and track prices.</p>
                                <Link to="/login" className="block w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-900/20 transition-all text-sm">
                                    Get Started Free
                                </Link>
                            </div>
                        )}
                    </div>

                </div>
            </div>

            {/* Stats Modal */}
            <DeckStatsModal
                isOpen={isStatsModalOpen}
                onClose={() => setIsStatsModalOpen(false)}
                cards={deckCards}
                deckName={deck.name}
            />

            {/* Doctor Modal */}
            <DeckDoctorModal
                isOpen={isDoctorOpen}
                onClose={() => setIsDoctorOpen(false)}
                deck={deck}
                cards={deckCards}
                isOwner={false} // Public view is never owner in this context (or handled by clone logic)
            />
        </div >
    );
};

export default PublicDeckPage;
