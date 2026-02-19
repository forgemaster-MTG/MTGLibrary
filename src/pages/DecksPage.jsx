import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useDecks } from '../hooks/useDecks';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { communityService } from '../services/communityService';
import { deckService } from '../services/deckService';
import DeckRow from '../components/decks/DeckRow';
import SharedDeckRow from '../components/decks/SharedDeckRow';
// import MarketTicker from '../components/dashboard/MarketTicker';
import { getTierConfig } from '../config/tiers';
import DeckCard from '../components/decks/DeckCard';

// DnD Kit
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// --- Draggable Wrapper ---
const SortableDeckItem = ({ deck }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: deck.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
        zIndex: isDragging ? 999 : 'auto',
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <DeckCard deck={deck} />
        </div>
    );
};

// --- Helper: Get Tags ---
const getAllTags = (decks) => {
    const tags = new Set();
    decks.forEach(d => {
        if (Array.isArray(d.tags)) {
            d.tags.forEach(t => tags.add(t));
        }
    });
    return Array.from(tags).sort();
};

const DecksPage = () => {
    const { user, userProfile } = useAuth();
    const { addToast } = useToast();
    const [availableSources, setAvailableSources] = useState([]);

    // Fetch My Decks
    const { decks: rawDecks, loading: myLoading, error: myError, refresh } = useDecks(null);

    // Local State for Manipulation
    const [processedDecks, setProcessedDecks] = useState([]);
    const [originalDecks, setOriginalDecks] = useState([]);

    // Filter/Sort State
    const [searchTerm, setSearchTerm] = useState('');
    const [sortMode, setSortMode] = useState('custom'); // 'custom', 'name', 'updated', 'created', 'color'
    const [filterTags, setFilterTags] = useState([]); // Array of selected tags
    const [availableTags, setAvailableTags] = useState([]);

    // Reorder Lock State
    const [isReorderUnlocked, setIsReorderUnlocked] = useState(false);

    // DnD Sensors
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Sync remote data to local state
    useEffect(() => {
        if (rawDecks) {
            // Determine initial sort based on sort_order if available, otherwise updated_at
            // The backend default sort is sort_order asc, updated_at desc
            setOriginalDecks(rawDecks);

            // Extract Tags - assume tags might need parsing if they came as string (JSON), but useDecks/api should handle it? 
            // If the API returns stringified tags, we should parse them.
            // Let's safe-parse just in case.
            const parsed = rawDecks.map(d => ({
                ...d,
                tags: typeof d.tags === 'string' ? JSON.parse(d.tags) : (d.tags || [])
            }));

            setProcessedDecks(parsed);
            setAvailableTags(getAllTags(parsed));
        }
    }, [rawDecks]);

    // Filtering & Sorting Logic
    const displayedDecks = useMemo(() => {
        let result = [...processedDecks];

        // 1. Filter
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            result = result.filter(d =>
                d.name.toLowerCase().includes(lower) ||
                (d.commander && d.commander.name.toLowerCase().includes(lower))
            );
        }

        if (filterTags.length > 0) {
            result = result.filter(d =>
                filterTags.every(tag => (d.tags || []).includes(tag))
            );
        }

        // 2. Sort
        if (sortMode !== 'custom') {
            result.sort((a, b) => {
                switch (sortMode) {
                    case 'name': return a.name.localeCompare(b.name);
                    case 'updated': return new Date(b.updated_at) - new Date(a.updated_at);
                    case 'created': return new Date(b.created_at) - new Date(a.created_at);
                    case 'color':
                        // Simplified Color Sort (WUBRG)
                        const getC = (d) => (d.commander?.color_identity || []).join('');
                        return getC(a).localeCompare(getC(b));
                    default: return 0;
                }
            });
        }
        // If custom, we rely on the array order which matches 'sort_order' from DB initially, 
        // and then drag/drop updates it.

        return result;
    }, [processedDecks, searchTerm, sortMode, filterTags]);

    // Fetch shared sources
    useEffect(() => {
        const fetchSources = async () => {
            if (!user) return;
            try {
                const perms = await communityService.fetchIncomingPermissions();
                const globalShares = (Array.isArray(perms) ? perms : []).filter(p => !p.target_deck_id);
                setAvailableSources(globalShares);
            } catch (err) {
                console.error("Failed to load shared sources", err);
            }
        };
        fetchSources();
    }, [user]);

    // Limit check removed
    const handleCreateDeck = () => {
        // No-op or analytics
    };

    // Auto-Lock if filters change
    useEffect(() => {
        if (searchTerm || filterTags.length > 0) {
            setIsReorderUnlocked(false);
        }
    }, [searchTerm, filterTags]);

    // DnD Handlers
    const handleDragEnd = async (event) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        setProcessedDecks((items) => {
            const oldIndex = items.findIndex(i => i.id === active.id);
            const newIndex = items.findIndex(i => i.id === over.id);

            const newOrder = arrayMove(items, oldIndex, newIndex);

            // Persist new order
            const idOrder = newOrder.map(d => d.id);
            deckService.reorderDecks(user.uid, idOrder).catch(err => {
                console.error("Failed to save deck order", err);
                addToast("Failed to save new order", "error");
            });

            return newOrder;
        });
    };

    const toggleTag = (tag) => {
        setFilterTags(prev =>
            prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
        );
    };

    const toggleReorder = () => {
        if (isReorderUnlocked) {
            setIsReorderUnlocked(false);
        } else {
            setSortMode('custom');
            setSearchTerm('');
            setFilterTags([]);
            setIsReorderUnlocked(true);
            addToast("Reordering unlocked. Drag decks to arrange.", "info");
        }
    };

    return (
        <div className="min-h-screen bg-gray-950 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[500px] bg-primary-900/10 blur-[120px] rounded-full pointer-events-none" />

            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10">

                {/* Header & Toolbar */}
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end mb-12 gap-8">
                    <div>
                        <h1 className="text-4xl font-black text-white tracking-tight mb-2">My Decks</h1>
                        <p className="text-gray-400 font-medium">Manage your collection and view shared decks.</p>
                    </div>

                    <div className="hidden md:flex flex-col md:flex-row gap-4 w-full xl:w-auto items-center">
                        {/* Toggle Reorder Lock */}
                        <button
                            onClick={toggleReorder}
                            className={`p-2 h-10 w-10 flex items-center justify-center rounded-xl border transition-all ${isReorderUnlocked ? 'bg-primary-600 text-white border-primary-500 shadow-lg shadow-primary-500/20' : 'bg-gray-900/50 text-gray-400 border-gray-700 hover:text-white hover:border-gray-500'}`}
                            title={isReorderUnlocked ? "Lock Order" : "Unlock to Reorder"}
                        >
                            {isReorderUnlocked ? (
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                            ) : (
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
                            )}
                        </button>

                        {/* Search */}
                        <div className="relative group flex-1 md:w-64">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg className="h-5 w-5 text-gray-500 group-focus-within:text-primary-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                            <input
                                type="text"
                                className="block w-full pl-10 pr-3 py-2 border border-gray-700 rounded-xl leading-5 bg-gray-900/50 text-gray-300 placeholder-gray-500 focus:outline-none focus:bg-gray-900 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 sm:text-sm transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                placeholder="Search decks..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                disabled={isReorderUnlocked}
                            />
                        </div>

                        {/* Filter Tags */}
                        {availableTags.length > 0 && (
                            <div className="relative group">
                                <select
                                    className="appearance-none block w-full md:w-48 pl-3 pr-10 py-2 border border-gray-700 rounded-xl leading-5 bg-gray-900/50 text-gray-300 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 sm:text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    onChange={(e) => e.target.value && toggleTag(e.target.value)}
                                    value=""
                                    disabled={isReorderUnlocked}
                                >
                                    <option value="">Filter by Tag...</option>
                                    {availableTags.map(tag => (
                                        <option key={tag} value={tag} disabled={filterTags.includes(tag)}>{tag}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Sort */}
                        <div className="relative">
                            <select
                                value={sortMode}
                                onChange={(e) => setSortMode(e.target.value)}
                                className="appearance-none block w-full md:w-40 pl-3 pr-10 py-2 border border-gray-700 rounded-xl leading-5 bg-gray-900/50 text-gray-300 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 sm:text-sm transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={isReorderUnlocked}
                            >
                                <option value="custom">Custom Order</option>
                                <option value="name">Name (A-Z)</option>
                                <option value="updated">Last Updated</option>
                                <option value="created">Newest First</option>
                                <option value="color">Color Identity</option>
                            </select>
                        </div>

                        <Link
                            to="/decks/new"
                            onClick={handleCreateDeck}
                            className="group bg-primary-600 hover:bg-primary-500 text-white px-6 py-2 rounded-xl font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-primary-500/20 flex items-center justify-center gap-2 border border-primary-400/20 hover:border-primary-400 whitespace-nowrap"
                        >
                            <span className="text-xl leading-none font-light">+</span>
                            New Deck
                        </Link>
                    </div>
                </div>

                {/* Active Filters */}
                {filterTags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-8 animate-fade-in">
                        {filterTags.map(tag => (
                            <button
                                key={tag}
                                onClick={() => toggleTag(tag)}
                                className="bg-primary-500/20 border border-primary-500/30 text-primary-300 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-2 hover:bg-primary-500/30 transition-colors"
                            >
                                {tag}
                                <span className="text-primary-400/50 hover:text-white">×</span>
                            </button>
                        ))}
                        <button onClick={() => setFilterTags([])} className="text-gray-500 text-xs hover:text-white transition-colors underline decoration-dotted">
                            Clear Filter
                        </button>
                    </div>
                )}

                {/* MarketTicker Removed per user request */}

                {/* My Decks */}
                {myLoading ? (
                    <DeckRow title="My Decks" decks={[]} loading={true} />
                ) : myError ? (
                    <DeckRow title="My Decks" decks={[]} error={myError} />
                ) : (
                    <div className="mb-12 animate-fade-in relative z-10">
                        <div className="flex justify-between items-end mb-6 border-b border-white/5 pb-4">
                            <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
                                My Decks
                                <span className="text-sm font-medium text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
                                    {displayedDecks.length}
                                </span>
                            </h2>
                            {isReorderUnlocked && (
                                <div className="w-full md:w-auto bg-primary-500/10 border border-primary-500/30 rounded-xl px-4 py-2 flex items-center justify-center gap-3 animate-pulse">
                                    <svg className="w-5 h-5 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                                    <span className="text-sm md:text-base font-bold text-primary-300">
                                        Reordering Enabled - Drag to arrange!
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Render Decks based on Lock State */}
                        {isReorderUnlocked ? (
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleDragEnd}
                            >
                                <SortableContext
                                    items={displayedDecks.map(d => d.id)}
                                    strategy={rectSortingStrategy}
                                >
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                        {displayedDecks.map(deck => (
                                            <SortableDeckItem key={deck.id} deck={deck} />
                                        ))}
                                    </div>
                                </SortableContext>
                                <DragOverlay>
                                    {/* Optional: Add DragOverlay for smoother lifting visuals, 
                                        but for now we just rely on the placeholder */}
                                </DragOverlay>
                            </DndContext>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                {displayedDecks.map(deck => (
                                    <DeckCard key={deck.id} deck={deck} />
                                ))}
                            </div>
                        )}

                        {displayedDecks.length === 0 && (
                            <div className="col-span-full py-20 flex flex-col items-center justify-center text-center bg-gray-900/20 rounded-3xl border border-dashed border-gray-800">
                                <p className="text-gray-500 mb-6">No matching decks found.</p>
                                <Link to="/decks/new" className="px-6 py-2 bg-primary-600 hover:bg-primary-500 text-white font-bold rounded-xl transition-all">
                                    Create Deck
                                </Link>
                            </div>
                        )}
                    </div>
                )}

                {/* Shared Decks Section */}
                {availableSources.length > 0 && (
                    <div className="mt-16 border-t border-white/5 pt-12 pb-32">
                        <h2 className="text-xl font-bold text-gray-500 uppercase tracking-widest mb-8 flex items-center gap-4">
                            <span className="h-px bg-gray-800 flex-1" />
                            Shared Libraries
                            <span className="h-px bg-gray-800 flex-1" />
                        </h2>
                        <div className="space-y-4">
                            {availableSources.map(source => (
                                <SharedDeckRow key={source.id} friend={source} />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Mobile Actions Footer */}
            <div className="fixed bottom-16 inset-x-0 bg-gray-900/95 backdrop-blur-xl border-t border-white/10 z-40 p-4 md:hidden pb-safe pr-24">
                <div className="flex flex-col gap-3">
                    {/* Search */}
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            className="block w-full pl-10 pr-3 py-2 border border-gray-700 rounded-lg bg-gray-800 text-gray-300 placeholder-gray-500 focus:outline-none focus:border-primary-500 text-sm"
                            placeholder="Search decks..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-5 gap-2">
                        <div className="col-span-2 relative">
                            <select
                                value={sortMode}
                                onChange={(e) => setSortMode(e.target.value)}
                                className="appearance-none block w-full pl-2 pr-6 py-2 border border-gray-700 rounded-lg bg-gray-800 text-gray-300 text-xs font-bold focus:outline-none focus:border-primary-500"
                            >
                                <option value="custom">Custom</option>
                                <option value="name">A-Z</option>
                                <option value="updated">Recent</option>
                                <option value="created">New</option>
                                <option value="color">Color</option>
                            </select>
                        </div>

                        <div className="col-span-1 relative">
                            <select
                                className="appearance-none block w-full px-2 py-2 border border-gray-700 rounded-lg bg-gray-800 text-gray-300 text-xs font-bold focus:outline-none focus:border-primary-500 text-center"
                                onChange={(e) => e.target.value && toggleTag(e.target.value)}
                                value=""
                            >
                                <option value="">Tag</option>
                                {availableTags.map(tag => (
                                    <option key={tag} value={tag} disabled={filterTags.includes(tag)}>{tag}</option>
                                ))}
                            </select>
                        </div>

                        <Link
                            to="/decks/new"
                            onClick={handleCreateDeck}
                            className="col-span-2 bg-primary-600 active:bg-primary-700 text-white flex items-center justify-center rounded-lg font-bold text-xs shadow-lg shadow-primary-500/20"
                        >
                            + New Deck
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DecksPage;
