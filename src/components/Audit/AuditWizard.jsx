
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useCardModal } from '../../contexts/CardModalContext';
import ForgeLensModal from '../modals/ForgeLensModal';
import { useToast } from '../../contexts/ToastContext';
import {
    Swords, Mountain, Sparkles, Cog, Zap, Scroll, Crown,
    Box, Ghost, User, Star
} from 'lucide-react';

// --- Sub-Component: Audit Item Card ---
const AuditItemCard = React.memo(({ item, onUpdate, onViewDetails, onSwapFoil }) => {
    const [isFlipped, setIsFlipped] = useState(false);

    // Status Logic
    const isReviewed = item.reviewed;
    const isMatched = isReviewed && item.scanned_qty === item.expected_qty; // Green
    const isMismatch = isReviewed && item.scanned_qty !== item.expected_qty; // Red
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
            onUpdate(item.id, item.expected_qty, true);
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
                    <span className="text-gray-400 font-bold">Goal: {item.expected_qty}</span>
                </div>

                {/* Actions */}
                <div className="mt-auto flex items-center justify-between gap-3" onClick={e => e.stopPropagation()}>
                    {/* Mismatch Button (X) */}
                    <button
                        onClick={handleMismatchClick}
                        disabled={isMismatch}
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
                            value={item.scanned_qty}
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
                        disabled={isMatched}
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

const ScryfallSymbol = ({ symbol, size = 'w-12 h-12' }) => (
    <img
        src={`https://svgs.scryfall.io/card-symbols/${symbol.toUpperCase()}.svg`}
        alt={symbol}
        className={`${size} drop-shadow-md rounded-full bg-gray-900 border-2 border-white/10`}
        onError={(e) => { e.target.style.display = 'none'; }}
    />
);

const ManaPips = ({ items }) => (
    <div className="flex -space-x-4 items-center justify-center p-2">
        {items.split('').map((char, i) => (
            <div key={i} className="z-10 transition-transform hover:scale-125 hover:z-20" title={char}>
                <ScryfallSymbol symbol={char} />
            </div>
        ))}
    </div>
);

const TypeIcon = ({ type }) => {
    const t = type.toLowerCase();
    const className = "w-12 h-12 text-gray-400 group-hover:text-indigo-400 transition-colors";

    // Lucide Icons Mapping
    // Creature: Swords or Ghost or Skull. Using Swords for 'Combat' feel.
    if (t.includes('artifact')) return <Cog className="w-12 h-12 text-gray-400 group-hover:text-slate-300" strokeWidth={1.5} />;

    // Artifact Creature -> Cog or Sword? 
    // Usually Creature type is more defining for gameplay visualization in folders.
    // If it has both, we can default to one. The 'if' order matters. 
    // Putting Artifact first means Artifact Creature gets Cog.
    // Putting Creature first means Artifact Creature gets Swords.
    // User complaint was "Creature is a smile face". 

    if (t.includes('land')) return <Mountain className="w-12 h-12 text-gray-400 group-hover:text-amber-600" strokeWidth={1.5} />;

    if (t.includes('creature')) return <Swords className="w-12 h-12 text-gray-400 group-hover:text-red-400" strokeWidth={1.5} />;

    if (t.includes('enchantment')) return <Sparkles className="w-12 h-12 text-gray-400 group-hover:text-yellow-400" strokeWidth={1.5} />;

    if (t.includes('instant')) return <Zap className="w-12 h-12 text-gray-400 group-hover:text-blue-500" strokeWidth={1.5} fill="currentColor" fillOpacity={0.2} />;

    if (t.includes('sorcery')) return <Scroll className="w-12 h-12 text-gray-400 group-hover:text-orange-500" strokeWidth={1.5} />;

    if (t.includes('planeswalker')) return <Crown className="w-12 h-12 text-gray-400 group-hover:text-purple-500" strokeWidth={1.5} />;

    // Fallback
    return <Box className={className} strokeWidth={1} />;
};

const FolderCard = ({ name, count, reviewed, onClick, type }) => {
    const isMana = (type === 'color' || type === 'color_identity') && name !== 'Unknown';
    const isSet = (type === 'set' || type === 'set_code');
    const isType = (type === 'type' || type === 'type_line');

    const progress = Math.round((reviewed / count) * 100) || 0;
    const isComplete = progress === 100;

    return (
        <div
            onClick={onClick}
            className="group relative flex flex-col aspect-[4/3] bg-gray-800 rounded-xl overflow-hidden border border-gray-700 hover:border-indigo-500/50 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-xl"
        >
            {/* Progress Background Gradient */}
            <div
                className="absolute inset-0 bg-gradient-to-t from-indigo-900/40 to-transparent transition-all duration-500"
                style={{
                    height: `${progress}%`,
                    top: 'auto',
                    bottom: 0,
                    opacity: 0.3
                }}
            />

            <div className="flex-1 flex items-center justify-center bg-gray-900/50 group-hover:bg-gray-800 transition-colors p-4 z-10">
                {isMana ? (
                    <ManaPips items={name} />
                ) : isSet ? (
                    <img
                        src={`https://svgs.scryfall.io/sets/${name.toLowerCase()}.svg`}
                        alt={name}
                        className="w-20 h-20 opacity-70 group-hover:opacity-100 transition-opacity filter drop-shadow-lg"
                        onError={(e) => { e.target.style.display = 'none'; }}
                    />
                ) : isType ? (
                    <TypeIcon type={name} />
                ) : (
                    <svg className="w-16 h-16 text-gray-700 group-hover:text-indigo-500/50 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                )}
            </div>

            <div className="p-4 bg-gray-900/90 border-t border-gray-800 z-10 backdrop-blur-sm">
                <div className="flex justify-between items-start mb-1">
                    <div className="text-white font-bold truncate text-lg uppercase tracking-tight">{name || 'Unknown'}</div>
                    {isComplete && <span className="text-green-400"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></span>}
                </div>

                <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider">
                    <span className={isComplete ? "text-green-400" : "text-gray-500"}>
                        {reviewed} / {count} Verified
                    </span>
                    <span className={`font-bold ${isComplete ? "text-green-400" : "text-indigo-400"}`}>
                        {progress}%
                    </span>
                </div>

                {/* Mini Progress Bar Line */}
                <div className="w-full h-1 bg-gray-800 rounded-full mt-2 overflow-hidden">
                    <div
                        className={`h-full transition-all duration-500 ${isComplete ? 'bg-green-500' : 'bg-indigo-500'}`}
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>
        </div>
    );
};

export default function AuditWizard() {
    const { userProfile } = useAuth();
    const { auditId } = useParams();
    // eslint-disable-next-line
    const [searchParams] = useSearchParams();
    const deckId = searchParams.get('deckId');
    const groupParam = searchParams.get('group');

    const { openCardModal } = useCardModal();
    const { addToast } = useToast();
    const [isForgeLensOpen, setIsForgeLensOpen] = useState(false);
    const [session, setSession] = useState(null);
    const [allItems, setAllItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deckName, setDeckName] = useState(null);

    // Navigation State
    const [currentPath, setCurrentPath] = useState([]); // Array of { type: 'set', value: 'KND' }

    // Pagination for LEAF nodes
    const [visibleCount, setVisibleCount] = useState(50);
    const loadMoreRef = useRef(null);

    const [viewAllOverride, setViewAllOverride] = useState(false);

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
    }, [visibleCount]); // Re-attach when count changes? Or better: just observe.

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

            // Get ALL items for this section (flat list)
            // We will group them client-side based on user's hierarchy prefs
            const auditItems = await api.getAuditItems(active.id, { deckId, group: groupParam });
            setAllItems(auditItems);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // --- hierarchy Logic ---
    const { groupHierarchy, leafSortOrder } = useMemo(() => {
        const rawSettings = userProfile?.settings?.organization?.sortHierarchy;

        // Strict adherence: If no settings, return empty (Flat view)
        if (!rawSettings || rawSettings.length === 0) {
            return { groupHierarchy: [], leafSortOrder: ['name'] };
        }

        const GROUPABLE_KEYS = new Set(['set', 'color', 'color_identity', 'type', 'rarity', 'artist', 'power', 'toughness']);

        const groups = [];
        const sorts = [];

        // Split logic: Groups take precedence until we hit a non-groupable key
        // User requested: "Group -> Sub-group ... rest sorting"
        // This implies MAX 2 levels of grouping.
        let groupCount = 0;

        for (const key of rawSettings) {
            // Strict cap: max 2 groups
            if (groupCount < 2 && GROUPABLE_KEYS.has(key)) {
                groups.push(key);
                groupCount++;
            } else {
                sorts.push(key);
            }
        }

        // Always ensure Name is a tie-breaker at the end if not present
        if (!sorts.includes('name')) sorts.push('name');

        return { groupHierarchy: groups, leafSortOrder: sorts };
    }, [userProfile]);

    const getGroupValue = (item, type) => {
        if (!type) return 'Unknown';
        let val = item[type];

        // Mappings from Settings Wizard keys to Data keys
        if (type === 'type' || type === 'type_line') {
            val = (item.type_line || item.card_data?.type_line || 'Unknown').split('—')[0].trim();
        }
        else if (type === 'set' || type === 'set_code') {
            val = (item.set_code || item.card_data?.set || '???').toUpperCase();
        }
        else if (type === 'color' || type === 'colors') {
            // 'color' usually means colors array
            val = item.colors || item.card_data?.colors;
            if (Array.isArray(val)) val = val.join('') || 'C';
            else if (!val) val = 'C';
        }
        else if (type === 'color_identity') {
            val = item.color_identity || item.card_data?.color_identity;
            if (Array.isArray(val)) val = val.join('') || 'C';
            else if (!val) val = 'C';
        }
        else if (type === 'rarity') {
            val = (item.rarity || item.card_data?.rarity || 'common');
        }
        else if (type === 'artist') {
            val = (item.artist || item.card_data?.artist || 'Unknown');
        }

        return String(val || 'Unknown');
    };

    const getCurrentItems = () => {
        return allItems.filter(item => {
            return currentPath.every(step => {
                const itemValue = getGroupValue(item, step.type);
                return itemValue === step.value;
            });
        });
    };

    const currentFilteredItems = useMemo(() => {
        let items = getCurrentItems();

        // Apply Status Filters
        if (filter === 'pending') items = items.filter(i => !i.reviewed);
        else if (filter === 'mismatch') items = items.filter(i => i.reviewed && i.actual_quantity !== i.expected_quantity);

        // Apply Sort at leaf level based on `leafSortOrder`
        // We use a multi-stage sort helper
        return items.sort((a, b) => {
            for (const key of leafSortOrder) {
                let diff = 0;

                // Mappings
                if (key === 'collector_number') {
                    const cA = parseInt(a.collector_number) || 0;
                    const cB = parseInt(b.collector_number) || 0;
                    diff = cA - cB;
                }
                else if (key === 'price') {
                    // Sorting High to Low for price usually
                    const pA = parseFloat(a.prices?.usd || a.card_data?.prices?.usd || 0);
                    const pB = parseFloat(b.prices?.usd || b.card_data?.prices?.usd || 0);
                    diff = pB - pA;
                }
                else if (key === 'cmc') {
                    const cA = parseFloat(a.cmc || a.card_data?.cmc || 0);
                    const cB = parseFloat(b.cmc || b.card_data?.cmc || 0);
                    diff = cA - cB;
                }
                else if (key === 'name') {
                    diff = (a.name || '').localeCompare(b.name || '');
                }

                if (diff !== 0) return diff;
            }
            return 0;
        });
    }, [allItems, currentPath, filter, leafSortOrder]);

    const isLeaf = viewAllOverride || currentPath.length >= groupHierarchy.length;
    const currentGroupType = groupHierarchy[currentPath.length];

    // Grouping Logic for Folder View
    const folders = useMemo(() => {
        if (isLeaf) return [];

        const groups = {};
        const items = getCurrentItems();

        items.forEach(item => {
            const val = getGroupValue(item, currentGroupType);
            if (!groups[val]) groups[val] = { count: 0, reviewed: 0 };
            groups[val].count++;
            if (item.reviewed) groups[val].reviewed++;
        });

        // Sort folders naturally (alphabetic)
        return Object.entries(groups)
            .map(([name, stats]) => ({
                name,
                count: stats.count,
                reviewed: stats.reviewed,
                type: currentGroupType
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [allItems, currentPath, isLeaf, groupHierarchy]);


    const handleFolderClick = (name) => {
        setViewAllOverride(false);
        setCurrentPath([...currentPath, { type: currentGroupType, value: name }]);
    };

    const handleBreadcrumbClick = (index) => {
        // Go back to that index
        // -1 = root
        setViewAllOverride(false);
        if (index === -1) setCurrentPath([]);
        else setCurrentPath(currentPath.slice(0, index + 1));
    };

    const [addCardState, setAddCardState] = useState({
        collectorNumber: '',
        finish: 'nonfoil',
        setCode: '',
        isSubmitting: false
    });

    // Auto-populate setCode if context is available
    useEffect(() => {
        let foundSet = '';

        // Priority 1: Check if we are drilled down into a Set folder
        const setStep = currentPath.find(step => step.type === 'set' || step.type === 'set_code');
        if (setStep) {
            foundSet = setStep.value;
        }
        // Priority 2: Check URL group param (if it looks like a set code)
        else if (groupParam && groupParam.length <= 4) {
            foundSet = groupParam;
        }
        // Priority 3: Check Audit Session target (if it's a Set Audit)
        else if (session && session.type === 'set' && session.target_id) {
            foundSet = session.target_id;
        }

        if (foundSet) {
            setAddCardState(prev => ({ ...prev, setCode: foundSet.toUpperCase() }));
        }
    }, [groupParam, session, currentPath]);

    const handleAddMissingCard = async (e) => {
        e.preventDefault();
        const { setCode, collectorNumber, finish } = addCardState;
        if (!setCode || !collectorNumber) return;

        setAddCardState(prev => ({ ...prev, isSubmitting: true }));
        try {
            const res = await api.addAuditItem(session.id, {
                setCode,
                collectorNumber,
                finish,
                deckId: deckId || null
            });

            if (res.success && res.item) {
                setAllItems(prev => {
                    const exists = prev.find(i => i.id === res.item.id);
                    if (exists) {
                        return prev.map(i => i.id === res.item.id ? res.item : i);
                    }
                    return [...prev, res.item];
                });
                addToast(`Added ${res.item.name} #${res.item.collector_number}`, 'success');
                // Reset (keep setCode)
                setAddCardState(prev => ({ ...prev, collectorNumber: '', isSubmitting: false }));
            }
        } catch (err) {
            console.error(err);
            addToast(err.message || 'Failed to add card', 'error');
            setAddCardState(prev => ({ ...prev, isSubmitting: false }));
        }
    };

    const updateItemQuantity = async (itemId, newQuantity, reviewed = null) => {
        const qty = parseInt(newQuantity);
        if (isNaN(qty) || qty < 0) return;

        setAllItems(prev => prev.map(item => {
            if (item.id !== itemId) return item;
            return {
                ...item,
                scanned_qty: qty,
                reviewed: reviewed !== null ? reviewed : item.reviewed
            };
        }));

        try {
            await api.updateAuditItem(session.id, itemId, qty, reviewed);
        } catch (err) { console.error(err); }
    };

    const handleFinishSection = async () => {
        // "Finish" in this context now means "Verify all visible items in this folder"
        // Filter for items that are not yet reviewed
        const itemsToVerify = currentFilteredItems.filter(i => !i.reviewed);

        if (itemsToVerify.length === 0) {
            addToast('All items in this section are already reviewed.', 'info');
            return;
        }

        if (!window.confirm(`Mark ${itemsToVerify.length} items as verified?`)) return;

        setLoading(true);

        // Optimistic Update
        const updates = itemsToVerify.map(item => ({
            id: item.id,
            scanned_qty: item.expected_qty,
            reviewed: true
        }));

        setAllItems(prev => prev.map(item => {
            const update = updates.find(u => u.id === item.id);
            return update ? { ...item, ...update } : item;
        }));

        try {
            await api.batchUpdateAuditItems(session.id, updates);
            addToast(`Verified ${itemsToVerify.length} items`, 'success');
        } catch (err) {
            console.error(err);
            addToast('Failed to batch verify items', 'error');
            // Revert? (Not implementing revert for simplicity, user can refresh)
        } finally {
            setLoading(false);
        }
    };

    const visibleLeafItems = currentFilteredItems.slice(0, visibleCount);

    if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-indigo-500 rounded-full" /></div>;
    if (!session) return null;

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 animate-fade-in pb-24">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8 bg-gray-900/50 p-6 rounded-2xl border border-white/5 backdrop-blur-md sticky top-20 z-30 shadow-xl">
                <div className="flex-1">
                    <button onClick={() => navigate(`/audit/${session.id}`)} className="text-gray-500 hover:text-white flex items-center gap-2 text-sm font-bold mb-2">Back to Hub</button>
                    <h1 className="text-2xl font-black text-white flex items-center gap-3">
                        <span className="text-indigo-400">Audit:</span>
                        {deckName ? deckName : (
                            // Show grouping context if available, else session type/name
                            groupHierarchy.length > 0 ?
                                (groupHierarchy[0].replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()))
                                : session.type
                        )}
                    </h1>

                    {/* Breadcrumbs */}
                    <div className="flex flex-wrap items-center gap-2 mt-2 text-sm font-mono">
                        <button
                            onClick={() => handleBreadcrumbClick(-1)}
                            className={`hover:text-white transition-colors py-1 px-2 rounded ${currentPath.length === 0 ? 'text-white font-bold bg-gray-800' : 'text-gray-500'}`}
                        >
                            ROOT
                        </button>
                        {currentPath.map((step, idx) => (
                            <React.Fragment key={idx}>
                                <span className="text-gray-600">/</span>
                                <button
                                    onClick={() => handleBreadcrumbClick(idx)}
                                    className={`hover:text-white transition-colors py-1 px-2 rounded ${idx === currentPath.length - 1 ? 'text-white font-bold bg-gray-800' : 'text-gray-500'}`}
                                >
                                    {step.value}
                                </button>
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                <div className="flex gap-4 items-center">
                    {/* Leaf-only controls */}
                    {isLeaf && (
                        <div className="bg-gray-800 p-1 rounded-lg flex text-xs font-bold">
                            <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded-md transition-colors ${filter === 'all' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}>All</button>
                            <button onClick={() => setFilter('pending')} className={`px-3 py-1.5 rounded-md transition-colors ${filter === 'pending' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}>Pending</button>
                            <button onClick={() => setFilter('mismatch')} className={`px-3 py-1.5 rounded-md transition-colors ${filter === 'mismatch' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}>Mismatches</button>
                        </div>
                    )}

                    <button
                        onClick={() => setIsForgeLensOpen(true)}
                        className="px-4 py-2 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-600/30 font-bold rounded-lg text-sm flex items-center gap-2 transition-all"
                        title="Verify Cards with Camera"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        Scan Verify
                    </button>

                    <button onClick={handleFinishSection} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg shadow-blue-500/20 text-sm flex items-center gap-2">
                        Finish Section
                    </button>
                </div>
            </div>

            {/* Quick Add Sticky Header */}
            {isLeaf && (
                <div className="sticky top-[168px] z-20 bg-gray-800/90 backdrop-blur border border-white/10 rounded-xl p-3 mb-6 flex flex-col md:flex-row items-center gap-4 shadow-lg">
                    <span className="text-xs font-bold uppercase text-gray-400 whitespace-nowrap px-2">Found Missing Card?</span>
                    <form onSubmit={handleAddMissingCard} className="flex-1 flex gap-2 w-full">
                        <input
                            type="text"
                            placeholder="Set (e.g. KND)"
                            className="w-24 bg-gray-900 border border-gray-700 rounded px-3 py-1 text-white text-sm font-mono uppercase focus:border-indigo-500 outline-none"
                            value={addCardState.setCode}
                            onChange={e => setAddCardState({ ...addCardState, setCode: e.target.value.toUpperCase() })}
                        />
                        <input
                            type="text"
                            placeholder="# No."
                            className="w-24 bg-gray-900 border border-gray-700 rounded px-3 py-1 text-white text-sm font-mono focus:border-indigo-500 outline-none"
                            value={addCardState.collectorNumber}
                            onChange={e => setAddCardState({ ...addCardState, collectorNumber: e.target.value })}
                        />
                        <select
                            className="bg-gray-900 border border-gray-700 rounded px-3 py-1 text-white text-sm focus:border-indigo-500 outline-none"
                            value={addCardState.finish}
                            onChange={e => setAddCardState({ ...addCardState, finish: e.target.value })}
                        >
                            <option value="nonfoil">Normal</option>
                            <option value="foil">Foil</option>
                        </select>
                        <button
                            type="submit"
                            disabled={addCardState.isSubmitting}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-1 rounded text-sm transition-colors flex items-center gap-1"
                        >
                            {addCardState.isSubmitting ? '...' : (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                    Add
                                </>
                            )}
                        </button>
                    </form>
                </div>
            )}

            {/* Content Area */}
            {isLeaf ? (
                // --- LEAF VIEW (CARDS) ---
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {visibleLeafItems.map(item => (
                        <AuditItemCard
                            key={item.id}
                            item={item}
                            onUpdate={updateItemQuantity}
                            onViewDetails={(i) => openCardModal({ ...i, data: i.card_data })}
                            onSwapFoil={() => { }}
                        />
                    ))}
                    {visibleCount < currentFilteredItems.length && (
                        <div ref={loadMoreRef} className="h-24 flex items-center justify-center col-span-full"><div className="animate-spin w-6 h-6 border-2 border-indigo-500 rounded-full" /></div>
                    )}
                </div>
            ) : (
                // --- FOLDER VIEW ---
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {/* View All Option */}
                    <div
                        onClick={() => setViewAllOverride(true)}
                        className="group relative flex flex-col aspect-[4/3] bg-gray-800/30 border-2 border-dashed border-gray-700/50 hover:border-indigo-500/50 hover:bg-gray-800 rounded-xl overflow-hidden cursor-pointer transition-all hover:-translate-y-1 hover:shadow-xl items-center justify-center p-6 text-center"
                    >
                        <div className="w-16 h-16 rounded-full bg-gray-800 group-hover:bg-indigo-600/20 flex items-center justify-center mb-3 transition-colors">
                            <svg className="w-8 h-8 text-gray-500 group-hover:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                        </div>
                        <span className="text-white font-bold text-lg">View All Cards</span>
                        <span className="text-xs text-gray-500 font-mono mt-1 uppercase tracking-wider">In this section</span>
                    </div>

                    {folders.map(f => (
                        <FolderCard
                            key={f.name}
                            name={f.name}
                            count={f.count}
                            reviewed={f.reviewed}
                            type={f.type}
                            onClick={() => handleFolderClick(f.name)}
                        />
                    ))}
                </div>
            )}

            <ForgeLensModal
                isOpen={isForgeLensOpen}
                onClose={() => setIsForgeLensOpen(false)}
                onFinish={async (scannedBatch) => {
                    if (!scannedBatch.length) return;

                    // Simple local match logic
                    let matchCount = 0;
                    const newItems = [...allItems];

                    for (const scanned of scannedBatch) {
                        const index = newItems.findIndex(i =>
                            i.scryfall_id === scanned.scryfall_id &&
                            (scanned.finish ? i.finish === scanned.finish : true)
                        );

                        if (index !== -1) {
                            const item = newItems[index];
                            const newQty = (item.scanned_qty || 0) + scanned.quantity;
                            newItems[index] = { ...item, scanned_qty: newQty, reviewed: true };

                            // Fire API update
                            api.updateAuditItem(session.id, item.id, newQty, true).catch(console.error);
                            matchCount++;
                        }
                    }

                    setAllItems(newItems);
                    if (matchCount > 0) addToast(`Verified ${matchCount} cards in this audit session!`, 'success');
                    else addToast('No matching cards found in this session.', 'warning');
                }}
            />
        </div>
    );
}
