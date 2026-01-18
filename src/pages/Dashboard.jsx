import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import DeleteConfirmationModal from '../components/modals/DeleteConfirmationModal';
import { LayoutImportModal, LayoutShareModal, LayoutSaveModal } from '../components/modals/DashboardLayoutModals';

// Modals
import IssueTrackerModal from '../components/modals/IssueTrackerModal';
import DonationModal from '../components/modals/DonationModal';
import BinderGuideModal from '../components/modals/BinderGuideModal';
import PodGuideModal from '../components/modals/PodGuideModal';
import AuditGuideModal from '../components/modals/AuditGuideModal';

import SingleActionWidget from '../components/dashboard/SingleActionWidget';

import WIDGETS from '../components/dashboard/WidgetRegistry';


import { DEFAULT_PRESETS, DEFAULT_WIDGET_SIZES, DEFAULT_LAYOUT } from '../constants/dashboardPresets';

const PRESETS = DEFAULT_PRESETS;

// --- Sortable Widget Wrapper ---
const SortableWidget = ({ id, widgetKey, editMode, data, actions, containerId, size, onResize, onRemove }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const [tempDims, setTempDims] = useState(null); // { w: px, h: px }

    const isLocked = id === 'system_status' || id === 'releases';

    // Grid Spans (Top Zone) - Now with Row Spans for Dense Packing
    const gridSpans = {
        xs: 'col-span-2 row-span-1', // 2 cols, 1 row (dense)
        small: 'col-span-4 row-span-3', // 4 cols, 3 rows (Increased from 2)
        medium: 'col-span-4 row-span-5', // 4 cols, 5 rows (Increased from 4)
        large: 'col-span-6 row-span-8', // 6 cols, 8 rows (Increased from 6)
        xlarge: 'col-span-8 row-span-8' // 8 cols, 8 rows (Increased from 6)
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
    const [isLayoutMenuOpen, setIsLayoutMenuOpen] = useState(false);
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [saveModalOpen, setSaveModalOpen] = useState(false);
    const [shareModalData, setShareModalData] = useState({ isOpen: false, code: '', name: '' });
    const [deleteModalData, setDeleteModalData] = useState({ isOpen: false, name: '' });
    const loadLayoutBtnRef = useRef(null);
    const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });

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


    const handleSaveAs = () => setSaveModalOpen(true);

    const onSaveNewLayout = async (name) => {
        if (!name) return;
        const newLayouts = {
            ...(savedLayouts || {}),
            [name]: { layout: layout, widgetSizes: widgetSizes }
        };
        await saveSavedLayouts(newLayouts);
        addToast(`Layout "${name}" saved!`, 'success');
    };

    const handleLoadLayout = (nameOrPreset) => {
        if (savedLayouts && savedLayouts[nameOrPreset]) {
            const savedLayout = savedLayouts[nameOrPreset].layout;
            setLayout(migrateLayout(savedLayout));
            setWidgetSizes(savedLayouts[nameOrPreset].widgetSizes || {});
            addToast(`Loaded layout: ${nameOrPreset}`, 'success');
        } else if (PRESETS[nameOrPreset]) {
            const { layout: presetLayout, sizes } = PRESETS[nameOrPreset];
            setLayout(migrateLayout(presetLayout));
            if (sizes) setWidgetSizes(sizes);
            addToast(`Loaded preset: ${nameOrPreset}`, 'success');
        }
    };

    const handleShare = () => {
        const data = { l: layout, s: widgetSizes };
        const code = btoa(JSON.stringify(data));
        setShareModalData({ isOpen: true, code, name: 'Current Layout' });
    };

    const handleImport = () => setImportModalOpen(true);

    const onImportLayout = async (name, code, loadAfterImport) => {
        try {
            const data = JSON.parse(atob(code));
            if (!data.l) throw new Error("Invalid layout data");

            const newLayouts = {
                ...(savedLayouts || {}),
                [name]: { layout: data.l, widgetSizes: data.s || {} }
            };
            await saveSavedLayouts(newLayouts);

            if (loadAfterImport) {
                setLayout(data.l);
                setWidgetSizes(data.s || {});
                addToast(`Layout "${name}" imported and loaded!`, 'success');
            } else {
                addToast(`Layout "${name}" imported successfully!`, 'success');
            }
            setImportModalOpen(false);
        } catch (e) {
            console.error(e);
            addToast('Invalid layout code', 'error');
        }
    };

    const handleDeleteLayout = (key) => setDeleteModalData({ isOpen: true, name: key });

    const confirmDeleteLayout = async () => {
        const key = deleteModalData.name;
        if (!key) return;

        const newLayouts = { ...savedLayouts };
        delete newLayouts[key];
        await saveSavedLayouts(newLayouts);
        addToast('Layout deleted', 'success');
        setDeleteModalData({ isOpen: false, name: '' });
    };

    const handleOverwriteLayout = async (name) => {
        if (!window.confirm(`Overwrite "${name}" with current layout?`)) return;
        const newSaved = {
            ...savedLayouts,
            [name]: { layout, widgetSizes }
        };
        setSavedLayouts(newSaved);
        try {
            await updateSettings({ saved_layouts: newSaved });
            addToast('Layout updated', 'success');
        } catch (e) {
            addToast('Failed to update layout', 'error');
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
            const isFoil = (card.finish === 'foil') || card.is_foil || card.val_foil;
            const priceRaw = isFoil ? (card.prices?.usd_foil || card.prices?.usd) : card.prices?.usd;
            const price = parseFloat(priceRaw || 0);
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

    const saveSavedLayouts = async (newLayouts) => {
        setSavedLayouts(newLayouts);
        try {
            await updateSettings({ saved_layouts: newLayouts });
        } catch (e) {
            console.error("Failed to save saved_layouts", e);
            addToast('Failed to sync layouts', 'error');
        }
    };

    // Toggle Edit
    const toggleEditMode = () => {
        if (editMode) {
            // Saving changes
            saveLayout(layout);
            setIsSidebarOpen(false);
        } else {
            // Do not auto open sidebar
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
        <div className="relative min-h-screen" >
            {/* Background */}
            < div className="fixed inset-0 z-0 bg-cover bg-center transition-all duration-1000" style={{ backgroundImage: 'url(/MTG-Forge_Logo_Background.png)' }} >
                <div className="absolute inset-0 bg-gray-950/80 backdrop-blur-sm" />
            </div >

            <div className="relative z-10 max-w-7xl mx-auto px-6 py-12 space-y-8 animate-fade-in w-full">
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
                <div className={`relative z-50 flex flex-col md:flex-row gap-4 ${editMode ? 'justify-center items-center' : 'justify-between items-end'}`}>
                    <div className={`text-center md:text-left ${editMode ? 'opacity-50 scale-90 transition-all' : ''}`}>
                        <h1 className="text-4xl font-black text-white tracking-tight mb-2">Dashboard</h1>
                        <p className="text-gray-400">Welcome back, <span className="text-indigo-400 font-bold">{currentUser ? (currentUser.displayName || currentUser.email) : 'Guest'}</span>.</p>
                    </div>
                    <div className="flex items-center gap-3 bg-gray-900/50 p-2 rounded-xl backdrop-blur-md border border-white/5">
                        <div className="relative">
                            <button onClick={() => setIsLayoutMenuOpen(!isLayoutMenuOpen)} className="bg-gray-800 text-white text-xs rounded-lg border border-gray-700 px-3 py-1.5 hover:bg-gray-700 transition-colors flex items-center gap-2">
                                <span>Load Layout...</span>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>

                            {isLayoutMenuOpen && (
                                <>
                                    <div className="fixed inset-0 z-40 cursor-default" onClick={() => setIsLayoutMenuOpen(false)} />
                                    <div className="absolute top-full right-0 mt-2 w-72 bg-gray-900 border border-indigo-500/30 rounded-xl shadow-2xl z-[100] overflow-hidden flex flex-col animate-fade-in-down">
                                        <div className="p-2 border-b border-white/5 bg-gray-950/50">
                                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-2 py-1">Presets</div>
                                            {Object.keys(PRESETS).map(key => (
                                                <button key={key} onClick={() => { handleLoadLayout(key); setIsLayoutMenuOpen(false); }} className="w-full text-left px-2 py-1.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white rounded-lg transition-colors">
                                                    {key}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="p-2 flex-grow overflow-y-auto max-h-[300px] bg-gray-900">
                                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-2 py-1 flex justify-between items-center">
                                                <span>My Layouts</span>
                                            </div>
                                            {Object.keys(savedLayouts).length === 0 ? (
                                                <div className="px-2 py-2 text-xs text-gray-600 italic">No saved layouts</div>
                                            ) : (
                                                Object.keys(savedLayouts).map(key => (
                                                    <div key={key} className="flex items-center gap-1 group/item rounded-lg hover:bg-white/5 p-1 mb-0.5">
                                                        <button onClick={() => { handleLoadLayout(key); setIsLayoutMenuOpen(false); }} className="flex-grow text-left px-1 text-sm text-gray-300 group-hover/item:text-white truncate transition-colors font-medium">
                                                            {key}
                                                        </button>
                                                        <button onClick={() => handleOverwriteLayout(key)} className="p-1.5 text-gray-600 hover:text-green-400 opacity-0 group-hover/item:opacity-100 transition-all rounded hover:bg-white/5" title="Overwrite with current">
                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                                                        </button>
                                                        <button onClick={() => handleDeleteLayout(key)} className="p-1.5 text-gray-600 hover:text-red-400 opacity-0 group-hover/item:opacity-100 transition-all rounded hover:bg-white/5" title="Delete">
                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                        </button>
                                                    </div>
                                                ))
                                            )}
                                        </div>

                                        <div className="p-2 border-t border-white/5 bg-gray-950/50 grid grid-cols-3 gap-2">
                                            <button onClick={() => { handleImport(); setIsLayoutMenuOpen(false); }} className="p-2 rounded-lg bg-indigo-500/5 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 flex flex-col items-center gap-1 text-[10px] font-bold transition-all border border-indigo-500/10" title="Import">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                                Import
                                            </button>
                                            <button onClick={() => { handleSaveAs(); setIsLayoutMenuOpen(false); }} className="p-2 rounded-lg bg-indigo-500/5 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 flex flex-col items-center gap-1 text-[10px] font-bold transition-all border border-indigo-500/10" title="Save As">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                                Save New
                                            </button>
                                            <button onClick={() => { handleShare(); setIsLayoutMenuOpen(false); }} className="p-2 rounded-lg bg-indigo-500/5 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 flex flex-col items-center gap-1 text-[10px] font-bold transition-all border border-indigo-500/10" title="Share (Copy Code)">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                                                Share
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="h-4 w-px bg-white/10 mx-1" />
                        {editMode && (
                            <div className="flex items-center gap-2 mr-2 border-r border-white/10 pr-4">
                                <button
                                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                                    className={`p-1.5 rounded border transition-all ${editMode && !isSidebarOpen
                                        ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/50 animate-bounce shadow-lg shadow-indigo-500/20'
                                        : 'hover:bg-indigo-600/20 text-indigo-400 hover:text-indigo-300 border-indigo-500/30'
                                        }`}
                                    title="Forge Library"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                                </button>
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
                        <div className="relative w-full min-h-[600px]">
                            {/* Visual Grid & Column Markers (Edit Mode Only) */}
                            {editMode && (
                                <div className="absolute inset-0 grid grid-cols-12 gap-3 pointer-events-none z-0 select-none">
                                    {Array.from({ length: 12 }).map((_, i) => (
                                        <div key={i} className="h-full border-x border-dashed border-indigo-500/10 bg-indigo-500/5 flex items-start justify-center pt-2 -mt-6">
                                            <span className="text-[9px] font-black text-indigo-400/50 uppercase tracking-wider">Col {i + 1}</span>
                                        </div>
                                    ))}
                                    {/* Horizontal Lines (Optional/Simple) - can leave out to reduce noise, or use repeat linear-gradient just for rows if needed */}
                                </div>
                            )}

                            {/* Actual Widget Grid */}
                            <div
                                className="grid grid-cols-12 auto-rows-[50px] gap-3 relative z-10 w-full"
                                style={{
                                    width: '100%',
                                    minWidth: '100%',
                                    minHeight: '600px',
                                    gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
                                    gridAutoRows: '75px',
                                    gap: '12px',
                                    boxSizing: 'border-box'
                                }}
                            >
                                {layout.grid.map((widgetId) => (
                                    <SortableWidget
                                        key={widgetId}
                                        id={widgetId}
                                        widgetKey={widgetId}
                                        containerId="grid"
                                        editMode={editMode}
                                        data={dashboardData}
                                        actions={dashboardActions}
                                        onRemove={handleRemoveWidget}
                                        onResize={handleResize}
                                        size={widgetSizes[widgetId] || 'medium'}
                                    />
                                ))}
                            </div>
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
            {/* Layout Modals */}
            <LayoutImportModal
                isOpen={importModalOpen}
                onClose={() => setImportModalOpen(false)}
                onImport={onImportLayout}
            />
            <LayoutSaveModal
                isOpen={saveModalOpen}
                onClose={() => setSaveModalOpen(false)}
                onSave={onSaveNewLayout}
            />
            <LayoutShareModal
                isOpen={shareModalData.isOpen}
                onClose={() => setShareModalData({ ...shareModalData, isOpen: false })}
                layoutCode={shareModalData.code}
                layoutName={shareModalData.name}
            />
            <DeleteConfirmationModal
                isOpen={deleteModalData.isOpen}
                onClose={() => setDeleteModalData({ isOpen: false, name: '' })}
                onConfirm={confirmDeleteLayout}
                title="Delete Layout"
                message={`Are you sure you want to delete the layout "${deleteModalData.name}"? This cannot be undone.`}
                targetName={deleteModalData.name}
            />
        </div >
    );
};

export default Dashboard;
