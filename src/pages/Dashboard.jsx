import React, { useState, useEffect, useMemo } from 'react';
import {
    DndContext,
    closestCorners,
    rectIntersection,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    rectSortingStrategy,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDraggable } from '@dnd-kit/core';
import { Switch } from '@headlessui/react';

// Hooks & Context
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useCollection } from '../hooks/useCollection';
import { useDecks } from '../hooks/useDecks';
import { api } from '../services/api';
import { getIdentity } from '../utils/identityRegistry'; // Helper for identity data

// Components
import { TotalCardsWidget as StatsWidget, CollectionValueWidget } from '../components/dashboard/StatsWidget';
import RecentDecksWidget from '../components/dashboard/RecentDecksWidget';
import IdentityWidget from '../components/dashboard/IdentityWidget';
import QuickActionsWidget from '../components/dashboard/QuickActionsWidget';
import WidgetSidebar from '../components/dashboard/WidgetSidebar';

// Modals
import IssueTrackerModal from '../components/modals/IssueTrackerModal';
import DonationModal from '../components/modals/DonationModal';
import BinderGuideModal from '../components/modals/BinderGuideModal';
import PodGuideModal from '../components/modals/PodGuideModal';
import AuditGuideModal from '../components/modals/AuditGuideModal';

import SingleActionWidget from '../components/dashboard/SingleActionWidget';

import WIDGETS from '../components/dashboard/WidgetRegistry';


const DEFAULT_WIDGET_SIZES = {
    'stats_value': 'xs',
    'stats_total': 'xs',
    'stats_decks': 'xs',
    'audit': 'xs',
    'action_browse': 'xs',
    'action_wishlist': 'xs',
    'identity': 'small',
    'quick_actions': 'small',
    'community': 'medium',
    'action_new_deck': 'xs',
    'action_add_cards': 'xs',
    'action_tournaments': 'xs',
    'system_status': 'small',
    'subscription': 'small',
    'social_stats': 'small',
    'trade_matches': 'small',
    'tips': 'small',
    'guides': 'small',
    'recent_decks': 'large',
    'releases': 'large'
};

// Simplified: All widgets in ONE grid zone for free-form placement
const DEFAULT_LAYOUT = {
    grid: [
        'stats_value', 'stats_total', 'stats_decks', 'audit', 'quick_actions', 'identity',
        'recent_decks', 'releases', 'community',
        'action_new_deck', 'action_add_cards', 'action_browse', 'action_wishlist', 'action_tournaments',
        'system_status', 'subscription', 'social_stats', 'trade_matches', 'tips', 'guides'
    ]
};

const PRESETS = {
    'Default': {
        layout: DEFAULT_LAYOUT,
        sizes: DEFAULT_WIDGET_SIZES
    },
    'Decks Focused': {
        layout: {
            grid: [
                'action_new_deck', 'action_add_cards', 'action_tournaments', 'stats_decks', 'quick_actions', 'identity',
                'recent_decks', 'community', 'releases',
                'stats_value', 'stats_total', 'audit', 'action_browse', 'action_wishlist',
                'system_status', 'subscription', 'social_stats', 'tips', 'guides'
            ]
        },
        sizes: {
            ...DEFAULT_WIDGET_SIZES,
            'action_new_deck': 'small',
            'action_add_cards': 'small',
            'action_tournaments': 'small',
            'recent_decks': 'xlarge',
            'community': 'large'
        }
    },
    'Collector': {
        layout: {
            grid: [
                'stats_value', 'stats_total', 'audit', 'action_browse', 'action_wishlist', 'identity',
                'recent_decks', 'releases', 'community',
                'action_new_deck', 'action_add_cards', 'action_tournaments', 'stats_decks', 'quick_actions',
                'system_status', 'subscription', 'social_stats', 'tips', 'guides'
            ]
        },
        sizes: {
            ...DEFAULT_WIDGET_SIZES,
            'stats_value': 'small',
            'stats_total': 'small',
            'audit': 'medium',
            'action_browse': 'small',
            'action_wishlist': 'small',
            'recent_decks': 'medium',
            'releases': 'xlarge'
        }
    }
};

// --- Sortable Widget Wrapper ---
const SortableWidget = ({ id, widgetKey, editMode, data, actions, containerId, size, onResize, onRemove }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const [tempDims, setTempDims] = useState(null); // { w: px, h: px }

    const isLocked = id === 'system_status' || id === 'releases';

    // Grid Spans (Top Zone) - Now with Row Spans for Dense Packing
    const gridSpans = {
        xs: 'col-span-2 row-span-1', // 2 cols, 1 row (dense)
        small: 'col-span-4 row-span-2', // 4 cols, 2 rows
        medium: 'col-span-4 row-span-4', // 4 cols, 4 rows
        large: 'col-span-6 row-span-6', // 6 cols, 6 rows
        xlarge: 'col-span-8 row-span-6' // 8 cols, 6 rows
    };

    // Width mappings for non-grid containers (Main/Sidebar)
    const widthClasses = {
        xs: 'max-w-[150px] mx-auto lg:mx-0',
        small: 'max-w-[300px] mx-auto lg:mx-0',
        medium: 'max-w-md mx-auto lg:mx-0',
        large: 'w-full',
        xlarge: 'w-full'
    };

    const spanClass = containerId === 'grid'
        ? (gridSpans[size || 'small'] || 'md:col-span-3 md:row-span-2')
        : widthClasses[size || 'small'];

    const style = {
        transform: CSS.Transform.toString(transform),
        transition: tempDims ? 'none' : transition, // Disable transition while dragging corner
        zIndex: (isDragging || tempDims) ? 100 : 'auto',
        opacity: isDragging ? 0.3 : 1,
        width: tempDims ? `${tempDims.w}px` : undefined,
        height: tempDims ? `${tempDims.h}px` : undefined,
    };

    const config = WIDGETS[widgetKey] || WIDGETS[id];
    const Component = config?.component;

    const handleResizeStart = (e) => {
        e.stopPropagation();
        onResize(id); // Restored cycle button functionality
    };

    // --- Drag to Resize Logic (Smooth) ---
    const onMouseDownResize = (e) => {
        e.stopPropagation();
        e.preventDefault();

        const startX = e.clientX;
        const startY = e.clientY;
        const startSize = size || 'small';

        // Get initial pixel dimensions of the widget
        const rect = e.currentTarget.closest('.relative').getBoundingClientRect();
        const startWidth = rect.width;
        const startHeight = rect.height;

        setTempDims({ w: startWidth, h: startHeight });

        const onMouseMove = (moveEvent) => {
            const currentX = moveEvent.clientX;
            const currentY = moveEvent.clientY;

            const deltaX = currentX - startX;
            const deltaY = currentY - startY;

            // Apply bounds (Min 100x100, Max ~full width)
            setTempDims({
                w: Math.max(150, startWidth + deltaX),
                h: Math.max(100, startHeight + deltaY)
            });
        };

        const onMouseUp = (upEvent) => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);

            const endX = upEvent.clientX;
            const endY = upEvent.clientY;
            // 12-column micro-grid math: Assuming 1200px wide, each unit is 100px wide, 50px tall
            const totalDeltaX = (endX - startX) / 100;
            const totalDeltaY = (endY - startY) / 50;

            // Map current size to dimensions (Coord units)
            const getDims = (s) => {
                if (s === 'xs') return [2, 1];
                if (s === 'small') return [4, 2];
                if (s === 'medium') return [4, 4];
                if (s === 'large') return [6, 6];
                if (s === 'xlarge') return [8, 6];
                return [4, 2];
            };
            const [startW, startH] = getDims(startSize || 'small');

            let newW = startW + (totalDeltaX > 0.4 ? Math.round(totalDeltaX) : totalDeltaX < -0.4 ? Math.round(totalDeltaX) : 0);
            let newH = startH + (totalDeltaY > 0.4 ? Math.round(totalDeltaY) : totalDeltaY < -0.4 ? Math.round(totalDeltaY) : 0);

            // Snapping Logic (Calibrated for the new 2/4/6/8 system)
            let finalSize = startSize;
            if (newH >= 5) {
                if (newW >= 7) finalSize = 'xlarge';
                else finalSize = 'large';
            } else if (newH >= 2.5) {
                if (newW >= 4) finalSize = 'medium';
                else finalSize = 'small';
            } else if (newH >= 1.5) {
                finalSize = 'small';
            } else {
                finalSize = 'xs';
            }

            setTempDims(null);
            if (finalSize !== startSize) {
                onResize(id, finalSize);
            }
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };


    if (!Component) return null;

    return (
        <div
            ref={setNodeRef}
            style={style}
            // Remove overflow-hidden from here so edit buttons can protrude
            className={`relative h-full ${(!isDragging && !tempDims) ? 'transition-all duration-300' : ''} ${spanClass}`}
        >
            {/* Edit Mode Overlay */}
            {editMode && (
                <div className={`absolute z-50 flex gap-1 origin-top-right transition-all ${size === 'xs' ? '-top-2 -right-2 scale-[0.7]' : '-top-3 -right-3'}`}>
                    {!isLocked && (
                        <div
                            onMouseDown={(e) => { e.stopPropagation(); onRemove(id); }}
                            className={`bg-red-600 rounded-full cursor-pointer hover:bg-red-500 border border-red-400 text-white shadow-lg flex items-center justify-center transition-transform hover:scale-110 ${size === 'xs' ? 'p-1' : 'p-1.5'}`}
                            title="Remove Widget"
                        >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </div>
                    )}

                    <div
                        onMouseDown={handleResizeStart}
                        className={`bg-gray-700 cursor-ew-resize rounded-full hover:bg-gray-600 border border-gray-500 text-white shadow-lg font-bold flex items-center justify-center transition-transform hover:scale-110 ${size === 'xs' ? 'w-5 h-5 text-[9px] p-0.5' : 'w-6 h-6 text-[10px] p-1.5'}`}
                        title="Drag horizontal to resize"
                    >
                        {size === 'xs' ? 'XS' : size === 'xlarge' ? 'XL' : size === 'large' ? 'L' : size === 'medium' ? 'M' : 'S'}
                    </div>

                    <div
                        {...attributes}
                        {...listeners}
                        className={`bg-indigo-600 rounded-full cursor-grab active:cursor-grabbing hover:bg-indigo-500 border border-indigo-400 text-white shadow-lg transition-transform hover:scale-110 ${size === 'xs' ? 'p-1' : 'p-1.5'}`}
                        title="Drag to Move"
                    >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" /></svg>
                    </div>
                </div>
            )}

            {/* Widget Content - Add overflow-hidden here */}
            <div className={`h-full overflow-hidden rounded-3xl ${editMode ? 'ring-2 ring-indigo-500/30 pointer-events-none' : ''}`}>
                <Component data={data} actions={actions} size={size} />
            </div>

            {/* Visual Resize Handle (Bottom-Right Corner) */}
            {editMode && (
                <div
                    onMouseDown={onMouseDownResize}
                    className="absolute bottom-1 right-1 w-10 h-10 cursor-nwse-resize z-50 flex items-end justify-end p-1 group/resize hover:scale-110 transition-transform pointer-events-auto"
                    title="Drag corner to resize"
                >
                    <div className="w-5 h-5 border-r-4 border-b-4 border-indigo-500/50 rounded-br-lg group-hover/resize:border-indigo-400" />
                    {/* Add diagonal lines icon to look like a resize handle */}
                    <div className="absolute inset-0 flex items-end justify-end p-2 opacity-50 group-hover/resize:opacity-100">
                        <svg className="w-3 h-3 text-indigo-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                            <line x1="21" y1="15" x2="15" y2="21" />
                            <line x1="21" y1="9" x2="9" y2="21" />
                        </svg>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Main Dashboard Component ---
const Dashboard = () => {
    const { currentUser, userProfile, updateSettings } = useAuth();
    const { addToast } = useToast();
    const { cards: collection, refresh: refreshCollection } = useCollection();
    const { decks, loading: decksLoading } = useDecks();
    const [isIssueModalOpen, setIsIssueModalOpen] = useState(false); // Kept in state for widget actions

    // Modal visibility handlers
    const [showBinderGuide, setShowBinderGuide] = useState(false);
    const [showPodGuide, setShowPodGuide] = useState(false);
    const [showAuditGuide, setShowAuditGuide] = useState(false);
    const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);

    const [syncLoading, setSyncLoading] = useState(false);

    // Dashboard Layout State
    const [editMode, setEditMode] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [layout, setLayout] = useState(DEFAULT_LAYOUT);
    const [widgetSizes, setWidgetSizes] = useState({}); // { id: 'small' | 'medium' | 'large' }
    const [activeId, setActiveId] = useState(null);
    const [savedLayouts, setSavedLayouts] = useState({});

    // Migration helper: Convert old zone-based layout to new unified grid
    const migrateLayout = (oldLayout) => {
        // If already in new format, return as-is
        if (oldLayout?.grid && Array.isArray(oldLayout.grid)) {
            return oldLayout;
        }

        // If in old format (has top/main/sidebar), merge into grid
        if (oldLayout?.top || oldLayout?.main || oldLayout?.sidebar) {
            return {
                grid: [
                    ...(oldLayout.top || []),
                    ...(oldLayout.main || []),
                    ...(oldLayout.sidebar || [])
                ]
            };
        }

        // Otherwise return default
        return DEFAULT_LAYOUT;
    };

    // Load persisted layout
    useEffect(() => {
        if (!userProfile || editMode) return;

        if (userProfile.settings?.dashboard_layout) {
            const remote = userProfile.settings.dashboard_layout;
            const migrated = migrateLayout(remote);
            setLayout(curr => {
                if (JSON.stringify(curr) === JSON.stringify(migrated)) return curr;
                return migrated;
            });
        }

        if (userProfile.settings?.dashboard_sizes) {
            const remote = userProfile.settings.dashboard_sizes;
            setWidgetSizes(curr => {
                if (JSON.stringify(curr) === JSON.stringify(remote)) return curr;
                return remote;
            });
        } else {
            setWidgetSizes(curr => {
                if (JSON.stringify(curr) === JSON.stringify(DEFAULT_WIDGET_SIZES)) return curr;
                return DEFAULT_WIDGET_SIZES;
            });
        }

        if (userProfile.settings?.saved_layouts) {
            const remote = userProfile.settings.saved_layouts;
            setSavedLayouts(curr => {
                if (JSON.stringify(curr) === JSON.stringify(remote)) return curr;
                return remote;
            });
        }
    }, [userProfile, editMode]);

    const handleSyncPrices = async () => {
        setSyncLoading(true);
        try {
            await api.post('/api/sync/prices');
            await refreshCollection();
        } catch (err) {
            console.error("Sync failed", err);
        } finally {
            setSyncLoading(false);
        }
    };

    const handleSaveAs = async () => {
        const name = window.prompt("Name this layout:");
        if (!name) return;

        const newSaved = {
            ...savedLayouts,
            [name]: { layout, widgetSizes }
        };

        setSavedLayouts(newSaved);

        try {
            await updateSettings({
                saved_layouts: newSaved
            });
            addToast(`Layout "${name}" saved!`, 'success');
        } catch (e) {
            addToast('Failed to save layout', 'error');
        }
    };

    const handleLoadLayout = (nameOrPreset) => {
        if (PRESETS[nameOrPreset]) {
            const { layout: presetLayout, sizes } = PRESETS[nameOrPreset];
            setLayout(migrateLayout(presetLayout));
            if (sizes) setWidgetSizes(sizes);
            addToast(`Loaded preset: ${nameOrPreset}`, 'success');
        } else if (savedLayouts[nameOrPreset]) {
            const savedLayout = savedLayouts[nameOrPreset].layout;
            setLayout(migrateLayout(savedLayout));
            setWidgetSizes(savedLayouts[nameOrPreset].widgetSizes || {});
            addToast(`Loaded layout: ${nameOrPreset}`, 'success');
        }
    };

    const handleShare = () => {
        const code = btoa(JSON.stringify({ l: layout, s: widgetSizes }));
        navigator.clipboard.writeText(code);
        addToast('Layout code copied to clipboard!', 'success');
    };

    const handleImport = () => {
        const code = window.prompt("Paste layout code:");
        if (!code) return;
        try {
            const data = JSON.parse(atob(code));
            if (data.l) { // Just check for layout
                setLayout(data.l);
                setWidgetSizes(data.s || {}); // Use empty if no sizes
                addToast('Layout imported successfully!', 'success');
            } else {
                addToast('Invalid layout code', 'error');
            }
        } catch (e) {
            addToast('Invalid layout code', 'error');
        }
    };

    // --- Stats Calculation (Moved from original) ---
    const stats = useMemo(() => {
        if (!collection || !decks) return { totalCards: 0, uniqueDecks: 0, value: 0, topColor: null };

        // (Simplified logic to match previous implementation)
        const collectionScryfallIds = new Set(collection.map(c => c.scryfall_id || c.id));
        const collectionItems = collection.filter(c => !c.is_wishlist);
        const wishlistItems = collection.filter(c => c.is_wishlist);
        let totalCards = collectionItems.reduce((acc, card) => acc + (card.count || 1), 0);
        let wishlistCount = wishlistItems.reduce((acc, card) => acc + (card.count || 1), 0);
        let collectionCount = totalCards;

        decks.forEach(deck => {
            if (deck.commander) {
                const cid = deck.commander.id || deck.commander.scryfall_id;
                if (cid && !collectionScryfallIds.has(cid)) { totalCards++; collectionScryfallIds.add(cid); }
            }
            if (deck.commander_partner) {
                const pid = deck.commander_partner.id || deck.commander_partner.scryfall_id;
                if (pid && !collectionScryfallIds.has(pid)) { totalCards++; collectionScryfallIds.add(pid); }
            }
        });

        const value = collection.reduce((acc, card) => {
            const price = parseFloat(card.prices?.usd || 0);
            return acc + (price * (card.count || 1));
        }, 0);

        // Top Color Logic
        const colorCounts = {};
        collection.forEach(card => {
            const colors = card.color_identity || [];
            const wubrgOrder = { 'W': 0, 'U': 1, 'B': 2, 'R': 3, 'G': 4 };
            const sortedKey = colors.filter(c => wubrgOrder[c] !== undefined).sort((a, b) => wubrgOrder[a] - wubrgOrder[b]).join('');
            const key = sortedKey.length === 0 ? 'C' : sortedKey;
            colorCounts[key] = (colorCounts[key] || 0) + (card.count || 1);
        });
        const topColorEntries = Object.entries(colorCounts);
        let topColorData = getIdentity('C');
        if (topColorEntries.length > 0) {
            const [bestKey] = topColorEntries.reduce((max, curr) => curr[1] > max[1] ? curr : max);
            topColorData = getIdentity(bestKey);
        }

        return {
            totalCards, collectionCount, wishlistCount, uniqueDecks: decks.length,
            value: value.toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
            topColor: topColorData
        };
    }, [collection, decks]);

    // --- DnD Logic ---
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const findContainer = (id) => {
        // Simplified: Only one zone now - 'grid'
        if (id === 'grid') return 'grid';
        return layout.grid?.includes(id) ? 'grid' : null;
    };

    const handleDragStart = (event) => setActiveId(event.active.id);

    const handleDragOver = (event) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const isFromLibrary = active.data?.current?.fromLibrary;

        // Simplified: everything goes to/from 'grid' zone
        if (isFromLibrary) {
            setLayout((prev) => ({
                ...prev,
                grid: [...(prev.grid || []), active.id]
            }));
        } else {
            // Allow reordering within grid
            const activeIndex = layout.grid.indexOf(active.id);
            const overIndex = layout.grid.indexOf(over.id);

            if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
                setLayout((prev) => ({
                    ...prev,
                    grid: arrayMove(prev.grid, activeIndex, overIndex)
                }));
            }
        }
    };

    const handleDragEnd = (event) => {
        setActiveId(null);
    };

    // Resize Handler
    const handleResize = (id, targetSize) => {
        setWidgetSizes(prev => {
            if (targetSize) {
                return { ...prev, [id]: targetSize };
            }
            const current = prev[id] || 'small';
            const next =
                current === 'xs' ? 'small' :
                    current === 'small' ? 'medium' :
                        current === 'medium' ? 'large' :
                            current === 'large' ? 'xlarge' :
                                'xs';
            return { ...prev, [id]: next };
        });
    };

    // Remove Handler
    const handleRemoveWidget = (id) => {
        setLayout(prev => ({
            ...prev,
            grid: prev.grid.filter(itemId => itemId !== id)
        }));
        addToast('Widget removed from dashboard', 'success');
    };

    // Save Layout
    const saveLayout = async (newLayout) => {
        if (!userProfile?.id) return;
        try {
            await updateSettings({
                dashboard_layout: newLayout,
                dashboard_sizes: widgetSizes
            });
            addToast('Layout saved', 'success');
        } catch (e) {
            console.error(e);
            addToast('Failed to save layout', 'error');
        }
    };

    // Toggle Edit
    const toggleEditMode = () => {
        if (editMode) {
            // Saving changes
            saveLayout(layout);
            setIsSidebarOpen(false);
        } else {
            setIsSidebarOpen(true);
        }
        setEditMode(!editMode);
    };

    // --- Render ---
    const dashboardData = useMemo(() => ({
        stats, decks, decksLoading, collection, userProfile, syncLoading
    }), [stats, decks, decksLoading, collection, userProfile, syncLoading]);

    const dashboardActions = useMemo(() => ({
        handleSyncPrices,
        setIsIssueModalOpen,
        setIsDonationModalOpen,
        setShowBinderGuide,
        setShowPodGuide,
        setShowAuditGuide
    }), [handleSyncPrices]);

    return (
        <div className="relative min-h-screen">
            {/* Background */}
            <div className="fixed inset-0 z-0 bg-cover bg-center transition-all duration-1000" style={{ backgroundImage: 'url(/MTG-Forge_Logo_Background.png)' }}>
                <div className="absolute inset-0 bg-gray-950/80 backdrop-blur-sm" />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-6 py-12 space-y-8 animate-fade-in">
                {/* Feedback Banner */}
                <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-4 flex items-start gap-3 backdrop-blur-md">
                    <span className="text-xl">💡</span>
                    <div>
                        <h3 className="font-bold text-indigo-400 text-sm">Looking for Default Layout suggestions!</h3>
                        <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                            Layouts are awkward atm to promote suggestions. When editing, click the share icon up at the top and send me your suggestion with a description of what it is.
                        </p>
                    </div>
                </div>

                {/* Header & Edit Toggle */}
                <div className={`flex flex-col md:flex-row gap-4 ${editMode ? 'justify-center items-center' : 'justify-between items-end'}`}>
                    <div className={`text-center md:text-left ${editMode ? 'opacity-50 scale-90 transition-all' : ''}`}>
                        <h1 className="text-4xl font-black text-white tracking-tight mb-2">Dashboard</h1>
                        <p className="text-gray-400">Welcome back, <span className="text-indigo-400 font-bold">{currentUser ? (currentUser.displayName || currentUser.email) : 'Guest'}</span>.</p>
                    </div>
                    <div className="flex items-center gap-3 bg-gray-900/50 p-2 rounded-xl backdrop-blur-md border border-white/5">
                        {editMode && (
                            <div className="flex items-center gap-2 mr-2 border-r border-white/10 pr-4">
                                <div className="flex gap-1 mr-2">
                                    <button onClick={handleSaveAs} className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white" title="Save Layout As...">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                                    </button>
                                    <button onClick={handleShare} className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white" title="Share Layout (Copy)">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                                    </button>
                                    <button onClick={handleImport} className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white" title="Import Layout">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                    </button>
                                    <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1.5 hover:bg-indigo-600/20 rounded text-indigo-400 hover:text-indigo-300 border border-indigo-500/30" title="Forge Library">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                                    </button>
                                </div>
                                <select
                                    className="bg-gray-800 text-white text-xs rounded-lg border border-gray-700 p-1.5 focus:ring-2 focus:ring-indigo-500 outline-none max-w-[120px]"
                                    onChange={(e) => handleLoadLayout(e.target.value)}
                                    defaultValue=""
                                >
                                    <option value="" disabled>Load Layout...</option>
                                    <optgroup label="Presets">
                                        {Object.keys(PRESETS).map(key => <option key={key} value={key}>{key}</option>)}
                                    </optgroup>
                                    {Object.keys(savedLayouts).length > 0 && (
                                        <optgroup label="My Layouts">
                                            {Object.keys(savedLayouts).map(key => <option key={`saved_${key}`} value={key}>{key}</option>)}
                                        </optgroup>
                                    )}
                                </select>
                            </div>
                        )}
                        <span className={`text-xs font-bold uppercase tracking-wider ${editMode ? 'text-indigo-400' : 'text-gray-500'}`}>{editMode ? 'Done' : 'Customize'}</span>
                        <Switch
                            checked={editMode}
                            onChange={toggleEditMode}
                            className={`${editMode ? 'bg-indigo-600' : 'bg-gray-700'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
                        >
                            <span className={`${editMode ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                        </Switch>
                    </div>
                </div>

                {/* DnD Context */}
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCorners}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragEnd={handleDragEnd}
                >
                    <WidgetSidebar
                        layout={layout}
                        isOpen={isSidebarOpen && editMode}
                        onClose={() => setIsSidebarOpen(false)}
                        onAddWidget={(id) => {
                            setLayout((prev) => ({
                                ...prev,
                                grid: [...(prev.grid || []), id]
                            }));
                        }}
                        onClearDashboard={() => {
                            setLayout({ grid: [] });
                        }}
                    />

                    {/* Unified Grid - All Widgets */}
                    <SortableContext items={layout.grid || []} strategy={rectSortingStrategy} id="grid">
                        <div className={`grid grid-cols-12 auto-rows-[50px] gap-3 relative min-h-[600px] ${editMode ? 'dashboard-grid-visual' : ''}`}>
                            {/* Column Markers (Edit Mode Only) */}
                            {editMode && (
                                <div className="absolute -top-6 left-0 right-0 grid grid-cols-12 gap-3 pointer-events-none z-0">
                                    {Array.from({ length: 12 }).map((_, i) => (
                                        <div key={i} className="text-center text-[9px] font-black text-indigo-500/50 uppercase tracking-wider">
                                            Col {i + 1}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {(layout.grid || []).map(id => (
                                <SortableWidget
                                    key={id}
                                    id={id}
                                    widgetKey={id}
                                    editMode={editMode}
                                    data={dashboardData}
                                    actions={dashboardActions}
                                    containerId="grid"
                                    size={widgetSizes[id] || 'small'}
                                    onResize={handleResize}
                                    onRemove={handleRemoveWidget}
                                />
                            ))}
                        </div>
                    </SortableContext>


                    {/* Drag Overlay (Visual feedback) */}
                    <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.5' } } }) }}>
                        {activeId ? (
                            (() => {
                                const config = WIDGETS[activeId];
                                const Component = config?.component;
                                const size = widgetSizes[activeId] || 'small';
                                const sizeClass = {
                                    'xs': 'w-[400px] h-[50px]',
                                    'small': 'w-[400px] h-[200px]',
                                    'medium': 'w-[600px] h-[200px]',
                                    'large': 'w-[800px] h-[400px]',
                                    'xlarge': 'w-full max-w-7xl h-[400px]'
                                }[size] || 'w-[400px] h-[200px]';

                                return (
                                    <div className={`${sizeClass} overflow-hidden rounded-3xl shadow-2xl ring-2 ring-indigo-500/50 cursor-grabbing bg-gray-900 z-50`}>
                                        {Component ? (
                                            <div className="h-full pointer-events-none p-1">
                                                <Component data={dashboardData} actions={dashboardActions} size={size} />
                                            </div>
                                        ) : (
                                            <div className="h-full flex items-center justify-center p-4 bg-gray-800 text-white font-bold border border-gray-700 rounded-3xl">
                                                {config?.title || 'Widget'}
                                            </div>
                                        )}
                                    </div>
                                );
                            })()
                        ) : null}
                    </DragOverlay>
                </DndContext>
            </div>

            {/* Context Modals */}
            <IssueTrackerModal
                isOpen={isIssueModalOpen}
                onClose={() => setIsIssueModalOpen(false)}
            />

            <DonationModal
                isOpen={isDonationModalOpen}
                onClose={() => setIsDonationModalOpen(false)}
            />

            <BinderGuideModal
                isOpen={showBinderGuide}
                onClose={() => setShowBinderGuide(false)}
            />

            <PodGuideModal
                isOpen={showPodGuide}
                onClose={() => setShowPodGuide(false)}
            />

            <AuditGuideModal
                isOpen={showAuditGuide}
                onClose={() => setShowAuditGuide(false)}
            />
        </div>
    );
};

export default Dashboard;
