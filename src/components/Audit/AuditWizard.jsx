
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useCardModal } from '../../contexts/CardModalContext';

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

    const { openCardModal } = useCardModal();
    const [session, setSession] = useState(null);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deckName, setDeckName] = useState(null);

    // Pagination
    const [visibleCount, setVisibleCount] = useState(50);
    const loadMoreRef = useRef(null);

    // Filters
    const [filter, setFilter] = useState('all'); // 'all', 'pending', 'mismatch'

    const navigate = useNavigate();

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
    }, [items?.length]);

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
            const hierarchy = userProfile?.settings?.organization?.sortHierarchy || ['name'];
            setItems(sortAuditItems(auditItems, hierarchy));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const sortAuditItems = (items, hierarchy) => {
        return [...items].sort((a, b) => {
            for (const criterion of hierarchy) {
                let diff = 0;
                if (criterion === 'set') diff = (a.set_code || '').localeCompare(b.set_code || '');
                else if (criterion === 'collector_number') diff = parseInt(a.collector_number || 0) - parseInt(b.collector_number || 0);
                else if (criterion === 'name') diff = (a.name || '').localeCompare(b.name || '');
                if (diff !== 0) return diff;
            }
            return (a.name || '').localeCompare(b.name || '');
        });
    };

    const updateItemQuantity = async (itemId, newQuantity, reviewed = null) => {
        const qty = parseInt(newQuantity);
        if (isNaN(qty) || qty < 0) return;

        setItems(prev => prev.map(item => {
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

    const filteredItems = useMemo(() => {
        if (filter === 'all') return items;
        if (filter === 'pending') return items.filter(i => !i.reviewed);
        if (filter === 'mismatch') return items.filter(i => i.reviewed && i.actual_quantity !== i.expected_quantity);
        return items;
    }, [items, filter]);

    const visibleItems = filteredItems.slice(0, visibleCount);

    if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-indigo-500 rounded-full" /></div>;
    if (!session) return null;

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 animate-fade-in pb-24">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8 bg-gray-900/50 p-6 rounded-2xl border border-white/5 backdrop-blur-md sticky top-20 z-30 shadow-xl">
                <div>
                    <button onClick={() => navigate(`/audit/${session.id}`)} className="text-gray-500 hover:text-white flex items-center gap-2 text-sm font-bold mb-2">Back to Hub</button>
                    <h1 className="text-2xl font-black text-white flex items-center gap-3">
                        <span className="text-indigo-400">Audit:</span> {deckName || group || session.type}
                    </h1>
                </div>

                <div className="flex gap-4 items-center">
                    {/* Filter Toggles */}
                    <div className="bg-gray-800 p-1 rounded-lg flex text-xs font-bold">
                        <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded-md transition-colors ${filter === 'all' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}>All</button>
                        <button onClick={() => setFilter('pending')} className={`px-3 py-1.5 rounded-md transition-colors ${filter === 'pending' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}>Pending</button>
                        <button onClick={() => setFilter('mismatch')} className={`px-3 py-1.5 rounded-md transition-colors ${filter === 'mismatch' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}>Mismatches</button>
                    </div>

                    <button onClick={handleFinishSection} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg shadow-blue-500/20 text-sm flex items-center gap-2">
                        Finish Section
                    </button>
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {visibleItems.map(item => (
                    <AuditItemCard
                        key={item.id}
                        item={item}
                        onUpdate={updateItemQuantity}
                        onViewDetails={(i) => openCardModal({ ...i, data: i.card_data })}
                        onSwapFoil={() => { }} // Not implemented in rewrite yet
                    />
                ))}
            </div>

            {/* Infinite Scroll Trigger */}
            {visibleCount < filteredItems.length && (
                <div ref={loadMoreRef} className="h-24 flex items-center justify-center"><div className="animate-spin w-6 h-6 border-2 border-indigo-500 rounded-full" /></div>
            )}
        </div>
    );
}
