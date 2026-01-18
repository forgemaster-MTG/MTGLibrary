
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useCardModal } from '../../contexts/CardModalContext';
import ForgeLensModal from '../modals/ForgeLensModal';
import { useToast } from '../../contexts/ToastContext';

// --- Sub-Component: Audit Item Card ---
// --- Sub-Component: Audit Item Card ---
const AuditItemCard = React.memo(({ item, onUpdate, onViewDetails, onSwapFoil }) => {
    const [isFlipped, setIsFlipped] = useState(false);

    // Status Logic
    const isReviewed = item.reviewed;
    const isMatched = isReviewed && item.actual_quantity === item.expected_quantity; // Green
    const isMismatch = isReviewed && item.actual_quantity !== item.expected_quantity; // Red
    const isPending = !isReviewed; // Neutral

    const isFoil = item.finish === 'foil';

    // DFC Logic
    const faces = item.card_data?.card_faces;
    const isDFC = faces && faces.length > 1;

    // Resolve Image & Art
    let displayImage = item.image_uri;
    let displayArt = item.art_uri;
    let displayName = item.name;

    if (isDFC) {
        const faceIndex = isFlipped ? 1 : 0;
        const face = faces[faceIndex];
        if (face.image_uris?.art_crop) displayArt = face.image_uris.art_crop;
        if (face.image_uris?.large) displayImage = face.image_uris.large;
        else if (face.image_uris?.normal) displayImage = face.image_uris.normal;
        displayName = face.name;
    }

    // Input Handling
    // Pending: Read-only (shows Expected)
    // Matched: Read-only
    // Mismatch: Editable
    // Editing only allowed if Mismatch or if we just unlocked it.
    // Actually, if it's mismatch, we allow edit.
    const isEditable = isMismatch;

    const handleMismatchClick = (e) => {
        e.stopPropagation();
        // Trigger mismatch mode: Set quantity to 0 (force red) and reviewed=true
        // This will unlock the input.
        if (!isMismatch) {
            onUpdate(item.id, 0, true);
        }
    };

    const handleMatchClick = (e) => {
        e.stopPropagation();
        // "Check" button.
        // Confirm match: Set quantity to expected and reviewed=true.
        if (!isMatched) {
            onUpdate(item.id, item.expected_quantity, true);
        }
    };

    // Auto-save on blur or specific actions? 
    // Here we update on change, but with delay? No, onUpdate updates state immediately.
    const handleInputChange = (e) => {
        const val = parseInt(e.target.value);
        if (isNaN(val) || val < 0) return;
        onUpdate(item.id, val, true);
    };

    return (
        <div
            onClick={() => onViewDetails(item)}
            className={`group relative flex flex-col rounded-xl overflow-hidden border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl cursor-pointer 
                ${isMatched ? 'bg-gray-800/80 border-green-500/30 shadow-green-500/5' : ''}
                ${isMismatch ? 'bg-red-900/20 border-red-500/50 shadow-red-500/10' : ''}
                ${isPending ? 'bg-gray-800/40 border-gray-700/50 hover:border-gray-500/50' : ''}
            `}
        >
            {/* Image Area */}
            <div className="relative aspect-[4/3] bg-gray-900 w-full overflow-hidden">
                {displayArt || displayImage ? (
                    <img
                        src={displayArt || displayImage}
                        alt={displayName}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-700"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-gray-600">No Image</div>
                )}

                {/* Status Bar */}
                <div className={`absolute bottom-0 left-0 right-0 h-1 transition-colors z-20 
                    ${isMatched ? 'bg-green-500' : ''}
                    ${isMismatch ? 'bg-red-500' : ''}
                    ${isPending ? 'bg-gray-700' : ''}
                `} />

                {/* Foil Badge */}
                <div className={`absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider shadow-lg backdrop-blur-md border z-10 
                    ${isFoil ? 'bg-gradient-to-r from-yellow-600/90 to-yellow-400/90 text-white border-yellow-300/50' : 'bg-gray-900/80 text-gray-400 border-gray-600/50'}`}>
                    {isFoil ? 'Foil' : 'Normal'}
                </div>

                {/* DFC Flip (Bottom Center) */}
                {isDFC && (
                    <button
                        onClick={(e) => { e.stopPropagation(); setIsFlipped(!isFlipped); }}
                        className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/60 hover:bg-black/80 text-white text-xs font-bold rounded-full backdrop-blur-sm border border-white/20 shadow-lg flex items-center gap-1 z-30 transition-all hover:scale-105"
                    >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        Flip
                    </button>
                )}
            </div>

            {/* Info */}
            <div className="p-4 flex-1 flex flex-col">
                <h3 className="text-white font-black text-lg leading-tight mb-1 truncate" title={displayName}>{displayName}</h3>
                <div className="text-xs text-gray-500 font-mono mb-4 flex items-center justify-between">
                    <span>#{item.collector_number} · {item.set_code.toUpperCase()}</span>
                    <span className="text-gray-400 font-bold">Goal: {item.expected_quantity}</span>
                </div>

                {/* Actions */}
                <div className="mt-auto flex items-center justify-between gap-3" onClick={e => e.stopPropagation()}>
                    {/* Mismatch Button (X) */}
                    <button
                        onClick={handleMismatchClick}
                        disabled={isMismatch} // Disabled if already mismatch? No, maybe they want to verify 0.
                        // Actually, if it's mismatch, input is editable. Button not strictly needed, but good for Reset-to-0.
                        className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors 
                            ${isMismatch ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'text-gray-500 hover:text-red-400 hover:bg-red-500/10'}`}
                        title="Mark Mismatch (Set to 0)"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>

                    {/* Input */}
                    <div className="relative flex-1">
                        <input
                            type="number"
                            min="0"
                            value={item.actual_quantity}
                            disabled={!isEditable}
                            onChange={handleInputChange}
                            className={`w-full bg-gray-900 border rounded-lg px-3 py-1.5 font-mono text-center focus:outline-none focus:ring-2 transition-colors 
                                ${isMatched ? 'border-green-500/50 text-green-400 opacity-90 cursor-not-allowed' : ''}
                                ${isMismatch ? 'border-red-500/50 text-white focus:ring-red-500' : ''}
                                ${isPending ? 'border-gray-700 text-gray-400 cursor-not-allowed' : ''}
                            `}
                        />
                    </div>

                    {/* Match Button (Check) */}
                    <button
                        onClick={handleMatchClick}
                        disabled={isMatched} // Disabled if already matched
                        className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors 
                            ${isMatched ? 'bg-green-500 text-white shadow-lg shadow-green-500/20' : 'text-gray-500 hover:text-green-400 hover:bg-green-500/10'}`}
                        title="Confirm Match"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    </button>
                </div>
            </div>
        </div>
    );
});

export default function AuditWizard() {
    const { userProfile } = useAuth();
    const { auditId } = useParams();
    // eslint-disable-next-line
    const [searchParams] = useSearchParams();
    const deckId = searchParams.get('deckId');
    const group = searchParams.get('group');
    const groupType = searchParams.get('groupType'); // 'set', 'type', etc.

    const { openCardModal } = useCardModal();
    const { addToast } = useToast();
    const [isForgeLensOpen, setIsForgeLensOpen] = useState(false);
    const [session, setSession] = useState(null);
    const [allItems, setAllItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deckName, setDeckName] = useState(null);

    // Navigation State
    const [path, setPath] = useState([]); // Array of { type: 'type', value: 'Creature' }

    // Pagination
    const [visibleCount, setVisibleCount] = useState(50);
    const loadMoreRef = useRef(null);

    // Filters
    const [filter, setFilter] = useState('all'); // 'all', 'pending', 'mismatch'

    const navigate = useNavigate();

    // Derived Logic
    const hierarchy = userProfile?.settings?.organization?.sortHierarchy || ['set', 'type', 'collector_number'];

    // Determine the relevant hierarchy levels for "drilling down"
    // If we entered via a Group (e.g. Set), we skip the 'set' level in the hierarchy.
    // If we entered via Deck, we use the full hierarchy (unless hierarchy has 'set'? Decks usually ignore set grouping preference? OR maybe they want it?)
    // Let's assume we filter out the "Entry Level" from the hierarchy to avoid redundant grouping.
    const navigationLevels = useMemo(() => {
        let levels = hierarchy;
        if (groupType) {
            levels = levels.filter(l => l !== groupType);
        }
        // Also remove leaf nodes that are better for sorting, not grouping
        return levels.filter(l => !['name', 'collector_number'].includes(l));
    }, [hierarchy, groupType]);

    // Current Grouping Level
    const currentLevelIndex = path.length;
    const currentGroupType = navigationLevels[currentLevelIndex]; // e.g. 'type' or undefined if leaf
    const isLeafView = !currentGroupType;

    // Infinite Scroll
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) setVisibleCount(p => p + 50);
            },
            { rootMargin: '200px' }
        );
        if (loadMoreRef.current) observer.observe(loadMoreRef.current);
        return () => observer.disconnect();
    }, [isLeafView]); // Only relevant in leaf view? Or scrolling folders?

    useEffect(() => {
        fetchSession();
        if (deckId) {
            api.get(`/api/decks/${deckId}`).then(d => setDeckName((d.deck || d).name)).catch(() => { });
        }
    }, [auditId, deckId]);

    const fetchSession = async () => {
        try {
            const active = await api.getActiveAudit();
            if (!active) {
                alert('No active audit session found.');
                navigate('/dashboard');
                return;
            }
            setSession(active);
            const auditItems = await api.getAuditItems(active.id, { deckId, group });
            // Sort initially by collector number for stability
            setAllItems(auditItems.sort((a, b) => (parseInt(a.collector_number) || 0) - (parseInt(b.collector_number) || 0)));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // --- Helper: Get Group Key ---
    const getGroupKey = (item, type) => {
        const data = item.card_data || {};
        if (type === 'type') {
            const typeLine = (data.type_line || '').toLowerCase();
            if (typeLine.includes('creature')) return 'Creature';
            if (typeLine.includes('instant')) return 'Instant';
            if (typeLine.includes('sorcery')) return 'Sorcery';
            if (typeLine.includes('artifact')) return 'Artifact';
            if (typeLine.includes('enchantment')) return 'Enchantment';
            if (typeLine.includes('planeswalker')) return 'Planeswalker';
            if (typeLine.includes('land')) return 'Land';
            return 'Other';
        }
        if (type === 'rarity') {
            const r = data.rarity || 'unknown';
            return r.charAt(0).toUpperCase() + r.slice(1);
        }
        if (type === 'color') {
            const colors = data.color_identity || [];
            if (colors.length === 0) return 'Colorless';
            if (colors.length > 1) return 'Multicolor';
            const map = { 'W': 'White', 'U': 'Blue', 'B': 'Black', 'R': 'Red', 'G': 'Green' };
            return map[colors[0]] || 'Unknown';
        }
        if (type === 'set') return (item.set_code || '???').toUpperCase();
        return 'Unknown';
    };

    // --- Filtered Items based on Path ---
    const filteredByPath = useMemo(() => {
        return allItems.filter(item => {
            // Must match every step in the path
            for (const step of path) {
                const itemKey = getGroupKey(item, step.type);
                if (itemKey !== step.value) return false;
            }
            return true;
        });
    }, [allItems, path]);

    // --- VIEW: Folders ---
    const folderGroups = useMemo(() => {
        if (isLeafView) return [];

        const groups = {};
        for (const item of filteredByPath) {
            const key = getGroupKey(item, currentGroupType);
            if (!groups[key]) groups[key] = { name: key, total: 0, reviewed: 0, verified: 0 };

            groups[key].total++;
            if (item.reviewed) groups[key].reviewed++;
            if (item.actual_quantity === item.expected_quantity) groups[key].verified++;
        }
        return Object.values(groups).sort((a, b) => b.total - a.total); // Sort by size
    }, [filteredByPath, isLeafView, currentGroupType]);

    // --- VIEW: Cards (Final Leaf) ---
    const finalDisplayItems = useMemo(() => {
        if (!isLeafView) return [];

        let items = filteredByPath;
        // Filter Status
        if (filter === 'pending') items = items.filter(i => !i.reviewed);
        if (filter === 'mismatch') items = items.filter(i => i.reviewed && i.actual_quantity !== i.expected_quantity);

        // Sort by final preference (usually Name or Collector Number) in Hierarchy
        // We know we consumed grouping levels. The remaining in 'hierarchy' might be sort keys.
        // Actually, let's just use the full hierarchy to sort, it works reliably.

        return [...items].sort((a, b) => {
            // Default sort: Collector Number
            return (parseInt(a.collector_number) || 0) - (parseInt(b.collector_number) || 0);
        });
    }, [filteredByPath, isLeafView, filter]);

    const visibleItems = finalDisplayItems.slice(0, visibleCount);

    const updateItemQuantity = async (itemId, newQuantity, reviewed = null) => {
        const qty = parseInt(newQuantity);
        if (isNaN(qty) || qty < 0) return;

        setAllItems(prev => prev.map(item => {
            if (item.id !== itemId) return item;
            return {
                ...item,
                actual_quantity: qty,
                reviewed: reviewed !== null ? reviewed : item.reviewed
            };
        }));

        try {
            await api.updateAuditItem(session.id, itemId, qty, reviewed);
        } catch (err) { console.error(err); }
    };

    const handleFinishSection = async () => {
        try {
            setLoading(true);
            await api.reviewAuditSection(session.id, { deckId, group });
            navigate(`/audit/${session.id}`);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-indigo-500 rounded-full" /></div>;
    if (!session) return null;

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 animate-fade-in pb-24">
            {/* Header with Breadcrumbs */}
            <div className="flex flex-col gap-4 mb-8 bg-gray-900/50 p-6 rounded-2xl border border-white/5 backdrop-blur-md sticky top-20 z-30 shadow-xl">

                {/* Breadcrumbs */}
                <div className="flex items-center gap-2 text-sm overflow-x-auto whitespace-nowrap pb-2 scrollbar-thin scrollbar-thumb-gray-700">
                    <button onClick={() => navigate(`/audit/${session.id}`)} className="text-gray-500 hover:text-white font-bold flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                        Hub
                    </button>
                    <span className="text-gray-600">/</span>

                    <button
                        onClick={() => setPath([])} // Reset to root of scope
                        className={`font-bold transition-colors ${path.length === 0 ? 'text-indigo-400' : 'text-gray-400 hover:text-white'}`}
                    >
                        {deckName || group || session.type}
                    </button>

                    {path.map((step, index) => (
                        <React.Fragment key={index}>
                            <span className="text-gray-600">/</span>
                            <button
                                onClick={() => setPath(path.slice(0, index + 1))}
                                className={`font-bold transition-colors ${index === path.length - 1 ? 'text-indigo-400' : 'text-gray-400 hover:text-white'}`}
                            >
                                {step.value}
                            </button>
                        </React.Fragment>
                    ))}
                </div>

                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <h1 className="text-2xl font-black text-white flex items-center gap-3">
                        {path.length > 0 ? path[path.length - 1].value : (deckName || group || 'Audit Items')}
                    </h1>

                    <div className="flex gap-4 items-center">
                        {/* Only show filters if we are in Leaf View */}
                        {isLeafView && (
                            <div className="bg-gray-800 p-1 rounded-lg flex text-xs font-bold">
                                <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded-md transition-colors ${filter === 'all' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}>All</button>
                                <button onClick={() => setFilter('pending')} className={`px-3 py-1.5 rounded-md transition-colors ${filter === 'pending' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}>Pending</button>
                                <button onClick={() => setFilter('mismatch')} className={`px-3 py-1.5 rounded-md transition-colors ${filter === 'mismatch' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}>Mismatches</button>
                            </div>
                        )}

                        <button
                            onClick={() => setIsForgeLensOpen(true)}
                            className="px-4 py-2 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-600/30 font-bold rounded-lg text-sm flex items-center gap-2 transition-all"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            Scan
                        </button>

                        <button onClick={handleFinishSection} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg shadow-blue-500/20 text-sm flex items-center gap-2">
                            Finish Section
                        </button>
                    </div>
                </div>
            </div>

            {/* CONTENT AREA */}
            {!isLeafView ? (
                // Folder Grid
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {folderGroups.map(grp => (
                        <button
                            key={grp.name}
                            onClick={() => setPath([...path, { type: currentGroupType, value: grp.name }])}
                            className={`p-6 rounded-xl border border-gray-700 bg-gray-800/40 hover:bg-gray-800/80 hover:border-indigo-500/50 transition-all text-left group`}
                        >
                            <div className="text-3xl mb-2 text-gray-600 group-hover:text-indigo-400 transition-colors">
                                <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                            </div>
                            <h3 className="font-bold text-white text-lg truncate">{grp.name}</h3>
                            <div className="text-xs text-gray-400 mt-2 flex justify-between">
                                <span>{grp.total} items</span>
                                <span className={grp.reviewed >= grp.total ? 'text-green-400' : ''}>
                                    {grp.reviewed}/{grp.total}
                                </span>
                            </div>
                            {/* Progress Bar */}
                            <div className="w-full bg-gray-700 rounded-full h-1 mt-2 overflow-hidden">
                                <div className="bg-indigo-500 h-full transition-all" style={{ width: `${(grp.reviewed / grp.total) * 100}%` }} />
                            </div>
                        </button>
                    ))}
                </div>
            ) : (
                // Card Grid
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {visibleItems.map(item => (
                        <AuditItemCard
                            key={item.id}
                            item={item}
                            onUpdate={updateItemQuantity}
                            onViewDetails={(i) => openCardModal({ ...i, data: i.card_data })}
                            onSwapFoil={() => { }}
                        />
                    ))}
                    {visibleItems.length === 0 && (
                        <div className="col-span-full py-12 text-center text-gray-500">
                            No cards found in this view.
                        </div>
                    )}
                </div>
            )}

            {/* Infinite Scroll Trigger */}
            {isLeafView && visibleCount < finalDisplayItems.length && (
                <div ref={loadMoreRef} className="h-24 flex items-center justify-center"><div className="animate-spin w-6 h-6 border-2 border-indigo-500 rounded-full" /></div>
            )}

            <ForgeLensModal
                isOpen={isForgeLensOpen}
                onClose={() => setIsForgeLensOpen(false)}
                onFinish={async (scannedBatch, options = {}) => {
                    // ... (Existing Forge Lens Logic - unchanged broadly, but needs careful merge if complex)
                    // Since I am replacing the whole file, I will just copy the existing logic back in condensed form or reference it.
                    // The user replaced the file content, so I need to put the full logic back.
                    // Copying logic from previous file view...
                    if (!scannedBatch.length) return;
                    const { targetDeckId, additionMode } = options;

                    const ownedBatch = scannedBatch.filter(c => !c.is_wishlist);
                    const wishlistBatch = scannedBatch.filter(c => c.is_wishlist);

                    // Add wishlist items
                    if (wishlistBatch.length > 0) {
                        try {
                            const pl = wishlistBatch.map(item => ({
                                name: item.name, scryfall_id: item.scryfall_id, set_code: item.set_code, collector_number: item.collector_number,
                                image_uri: item.data.image_uris?.normal || item.data.card_faces?.[0]?.image_uris?.normal,
                                count: item.quantity, data: item.data, is_wishlist: true, tags: []
                            }));
                            await api.batchAddToCollection(pl);
                            addToast(`Saved ${wishlistBatch.length} items to wishlist!`, 'success');
                        } catch (err) { console.error("Wishlist", err); }
                    }

                    let matchCount = 0;
                    const bonusCards = [];
                    const newItems = [...allItems]; // Use allItems instead of local filtered

                    for (const scanned of ownedBatch) {
                        const index = newItems.findIndex(i =>
                            i.scryfall_id === scanned.scryfall_id && (scanned.finish ? i.finish === scanned.finish : true)
                        );

                        if (index !== -1) {
                            const item = newItems[index];
                            const newQty = (item.actual_quantity || 0) + scanned.quantity;
                            newItems[index] = { ...item, actual_quantity: newQty, reviewed: true };
                            try {
                                await api.updateAuditItem(session.id, item.id, newQty, true);
                                matchCount++;
                            } catch (e) {
                                console.error("Failed to update", e);
                            }
                        } else {
                            bonusCards.push(scanned);
                        }
                    }

                    // Bonus Cards
                    if (bonusCards.length > 0) {
                        try {
                            const pl = bonusCards.map(item => ({
                                name: item.name, scryfall_id: item.scryfall_id, set_code: item.set_code, collector_number: item.collector_number,
                                image_uri: item.data.image_uris?.normal || item.data.card_faces?.[0]?.image_uris?.normal,
                                count: item.quantity, data: item.data, finish: item.finish || 'nonfoil',
                                deck_id: targetDeckId || (deckId && deckId !== 'null' ? deckId : null), tags: []
                            }));
                            const apiMode = additionMode === 'transfer' ? 'transfer_to_deck' : 'merge';
                            await api.batchAddToCollection(pl, apiMode);
                            addToast(`Added ${bonusCards.length} bonus cards!`, 'info');
                        } catch (err) { console.error("Bonus", err); }
                    }

                    setAllItems(newItems);
                    if (matchCount > 0) addToast(`Verified ${matchCount} cards!`, 'success');
                }}
            />
        </div>
    );
}
