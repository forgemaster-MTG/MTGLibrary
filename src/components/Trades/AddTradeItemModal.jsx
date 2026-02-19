import React, { useState, useMemo } from 'react';
import { Dialog } from '@headlessui/react';
import { useCollection } from '../../hooks/useCollection';
import { useDecks } from '../../hooks/useDecks';
import { useBinders } from '../../hooks/useBinders';

const AddTradeItemModal = ({ isOpen, onClose, onAdd, existingItems = new Set(), sourceUserId = null }) => {
    const { cards, loading: cardsLoading } = useCollection({ userId: sourceUserId }); // Fetches specific user's collection
    const { binders } = useBinders(sourceUserId);
    const { decks } = useDecks(sourceUserId);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedBinder, setSelectedBinder] = useState('all');
    const [selectedItems, setSelectedItems] = useState(new Map()); // Map<cardId, quantity>

    // Advanced Filters State
    const [showFilters, setShowFilters] = useState(false);
    const [excludeDecks, setExcludeDecks] = useState(true);
    const [minQuantity, setMinQuantity] = useState(1);
    const [minPrice, setMinPrice] = useState('');
    const [maxPrice, setMaxPrice] = useState('');

    // Advanced Dictionary Search
    const [colors, setColors] = useState(new Set()); // W, U, B, R, G, C
    const [colorLogic, setColorLogic] = useState('OR'); // OR, AND
    const [rarities, setRarities] = useState(new Set()); // common, uncommon, rare, mythic
    const [typeLine, setTypeLine] = useState('');
    const [oracleText, setOracleText] = useState('');
    const [manaValueOp, setManaValueOp] = useState('=');
    const [manaValue, setManaValue] = useState('');
    const [setCode, setSetCode] = useState('');
    const [collectorNumber, setCollectorNumber] = useState('');

    // Filter cards
    const filteredCards = useMemo(() => {
        let result = cards;

        // Filter out already added items (unless we allow adding more copies? Let's hide completely for simplicity to avoid split stacks)
        if (existingItems.size > 0) {
            result = result.filter(c => !existingItems.has(c.id));
        }

        // Binder Filter
        if (selectedBinder !== 'all') {
            result = result.filter(c => c.binder_id === parseInt(selectedBinder));
        }

        // Exclude Decks
        if (excludeDecks) {
            result = result.filter(c => !c.deck_id);
        }

        // Min Quantity
        if (minQuantity > 1) {
            result = result.filter(c => (c.quantity || 1) >= minQuantity);
        }

        // Price Filter
        if (minPrice !== '' || maxPrice !== '') {
            result = result.filter(c => {
                const price = parseFloat(c.details?.prices?.usd || 0);
                if (minPrice !== '' && price < parseFloat(minPrice)) return false;
                if (maxPrice !== '' && price > parseFloat(maxPrice)) return false;
                return true;
            });
        }

        // --- Advanced Configuration ---

        // Colors
        if (colors.size > 0) {
            result = result.filter(c => {
                const cardColors = c.colors || [];
                const hasColorless = colors.has('C');
                const selectedColors = Array.from(colors).filter(col => col !== 'C');

                // Colorless logic: If 'C' is selected, we match if card has NO colors
                const isCardColorless = cardColors.length === 0;

                if (colorLogic === 'OR') {
                    if (hasColorless && isCardColorless) return true;
                    // Check if card has ANY of the selected colors
                    return selectedColors.some(col => cardColors.includes(col));
                } else {
                    // AND logic: Card must include ALL selected colors
                    // If Colorless is selected in AND mode... usually means "Only Colorless"? 
                    // Or "Colorless AND White"? (Impossible)
                    // Let's assume AND with Colorless means "Empty colors" specifically.
                    if (hasColorless) return isCardColorless;

                    // Allow supersets? e.g. Select W, U -> Returns W U G? Yes, usually.
                    return selectedColors.every(col => cardColors.includes(col));
                }
            });
        }

        // Rarity
        if (rarities.size > 0) {
            result = result.filter(c => rarities.has(c.rarity));
        }

        // Type Line
        if (typeLine) {
            result = result.filter(c => c.type_line?.toLowerCase().includes(typeLine.toLowerCase()));
        }

        // Oracle Text
        if (oracleText) {
            result = result.filter(c => c.oracle_text?.toLowerCase().includes(oracleText.toLowerCase()));
        }

        // Mana Value
        if (manaValue !== '') {
            const mvFunc = (op, a, b) => {
                switch (op) {
                    case '=': return a === b;
                    case '>': return a > b;
                    case '<': return a < b;
                    case '>=': return a >= b;
                    case '<=': return a <= b;
                    case '!=': return a !== b;
                    default: return true;
                }
            };
            result = result.filter(c => mvFunc(manaValueOp, c.cmc || 0, parseFloat(manaValue)));
        }

        // Set Code
        if (setCode) {
            result = result.filter(c => c.set_code?.toLowerCase().includes(setCode.toLowerCase()));
        }

        // Collector Number
        if (collectorNumber) {
            result = result.filter(c => c.collector_number === collectorNumber);
        }

        // --- End Advanced Configuration ---

        // Search
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(c =>
                c.name.toLowerCase().includes(term) ||
                c.set_code.toLowerCase().includes(term) ||
                c.item_type?.toLowerCase().includes(term)
            );
        }

        return result.slice(0, 100); // Limit to 100 for performance
    }, [cards, searchTerm, existingItems, selectedBinder, excludeDecks, minQuantity, minPrice, maxPrice, colors, colorLogic, rarities, typeLine, oracleText, manaValueOp, manaValue, setCode, collectorNumber]);

    const handleToggle = (card) => {
        const newMap = new Map(selectedItems);
        if (newMap.has(card.id)) {
            newMap.delete(card.id);
        } else {
            newMap.set(card.id, 1);
        }
        setSelectedItems(newMap);
    };

    const updateQuantity = (e, card, qty) => {
        e.stopPropagation();
        const newMap = new Map(selectedItems);
        const max = card.quantity || 1;
        const val = Math.max(1, Math.min(max, qty));
        newMap.set(card.id, val);
        setSelectedItems(newMap);
    };

    const handleSubmit = () => {
        const items = [];
        selectedItems.forEach((qty, id) => {
            const card = cards.find(c => c.id === id);
            if (card) {
                items.push({
                    item_type: 'card',
                    item_id: card.id,
                    user_id: sourceUserId, // Important for "Request" feature
                    quantity: qty,
                    details: {
                        name: card.name,
                        set_code: card.set_code,
                        collector_number: card.collector_number,
                        finish: card.finish,
                        image_uri: card.image_uri,
                        prices: card.prices
                    }
                });
            }
        });
        onAdd(items);
        onClose();
        setSelectedItems(new Map());
        setSearchTerm('');
    };

    const getDeckName = (deckId) => {
        if (!deckId) return null;
        return decks.find(d => d.id === deckId)?.name || 'Unknown Deck';
    };

    const toggleSet = (set, val, setSetter) => {
        const newSet = new Set(set);
        if (newSet.has(val)) newSet.delete(val);
        else newSet.add(val);
        setSetter(newSet);
    };

    const resetFilters = () => {
        setExcludeDecks(true);
        setMinQuantity(1);
        setMinPrice('');
        setMaxPrice('');
        setColors(new Set());
        setColorLogic('OR');
        setRarities(new Set());
        setTypeLine('');
        setOracleText('');
        setManaValueOp('=');
        setManaValue('');
        setSetCode('');
        setCollectorNumber('');
    };

    return (
        <Dialog open={isOpen} onClose={onClose} className="relative z-50">
            <div className="fixed inset-0 bg-black/70" aria-hidden="true" />
            <div className="fixed inset-0 flex items-center justify-center p-4">
                <Dialog.Panel className="w-full max-w-4xl rounded-2xl bg-gray-900 border border-gray-700 p-6 shadow-xl flex flex-col max-h-[90vh]">
                    <Dialog.Title className="text-xl font-bold text-white mb-4 flex justify-between items-center">
                        <span>{sourceUserId ? "Select Cards" : "Add Cards to Trade"}</span>
                        {selectedItems.size > 0 && (
                            <span className="text-sm font-normal text-primary-400">{selectedItems.size} items selected</span>
                        )}
                    </Dialog.Title>

                    {/* Filters */}
                    <div className="flex flex-col md:flex-row gap-3 mb-4">
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                placeholder="Search card name..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white focus:ring-2 focus:ring-primary-500 outline-none"
                                autoFocus
                            />
                            <svg className="w-5 h-5 text-gray-500 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>

                        <div className="flex gap-2 w-full md:w-auto">
                            <select
                                value={selectedBinder}
                                onChange={e => setSelectedBinder(e.target.value)}
                                className="w-full md:w-48 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-primary-500 outline-none appearance-none cursor-pointer"
                            >
                                <option value="all">All Binders</option>
                                <option value="0">Unbindered</option>
                                {binders.map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={`px-3 py-2 rounded-lg border transition-colors ${showFilters ? 'bg-primary-600 text-white border-primary-500' : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-white'}`}
                                title="Advanced Filters"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                            </button>
                        </div>
                    </div>

                    {/* Advanced Filters Panel */}
                    {showFilters && (
                        <div className="mb-4 p-5 bg-gray-800/80 rounded-xl border border-gray-700 animate-fade-in space-y-4">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Advanced Configuration</h3>
                                <button onClick={resetFilters} className="text-xs font-bold text-orange-500 hover:text-orange-400 uppercase tracking-wider">Reset Filters</button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Colors */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Colors</label>
                                    <div className="flex items-center gap-4">
                                        <div className="flex gap-1">
                                            {['W', 'U', 'B', 'R', 'G', 'C'].map(c => (
                                                <button
                                                    key={c}
                                                    onClick={() => toggleSet(colors, c, setColors)}
                                                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${colors.has(c) ? 'bg-primary-600 ring-2 ring-primary-400 transform scale-110' : 'bg-gray-700 hover:bg-gray-600 grayscale opacity-60 hover:opacity-100 hover:grayscale-0'}`}
                                                >
                                                    <i className={`ms ms-${c.toLowerCase()} ms-cost text-lg shadow-black drop-shadow-md`} />
                                                </button>
                                            ))}
                                        </div>
                                        <div className="flex bg-gray-700 rounded-lg p-0.5 border border-gray-600">
                                            <button
                                                onClick={() => setColorLogic('OR')}
                                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${colorLogic === 'OR' ? 'bg-primary-500 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                                            >OR</button>
                                            <button
                                                onClick={() => setColorLogic('AND')}
                                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${colorLogic === 'AND' ? 'bg-primary-500 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                                            >AND</button>
                                        </div>
                                    </div>
                                </div>

                                {/* Rarity */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Rarity</label>
                                    <div className="flex gap-2">
                                        {[
                                            { id: 'common', label: 'C', color: 'bg-black border-white/20' },
                                            { id: 'uncommon', label: 'U', color: 'bg-gray-300 text-black' },
                                            { id: 'rare', label: 'R', color: 'bg-amber-400 text-black' },
                                            { id: 'mythic', label: 'M', color: 'bg-orange-600 text-white' }
                                        ].map(r => (
                                            <button
                                                key={r.id}
                                                onClick={() => toggleSet(rarities, r.id, setRarities)}
                                                className={`w-8 h-8 rounded-lg font-bold border-2 transition-all flex items-center justify-center ${rarities.has(r.id) ? 'border-primary-500 ring-1 ring-primary-500 transform scale-105 ' + r.color : 'border-transparent bg-gray-700 text-gray-400 opacity-60'}`}
                                            >
                                                {r.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Type */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Type</label>
                                    <input
                                        type="text"
                                        value={typeLine}
                                        onChange={e => setTypeLine(e.target.value)}
                                        placeholder="Creature, Artifact..."
                                        className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-primary-500 outline-none"
                                    />
                                </div>
                                {/* Text */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Text</label>
                                    <input
                                        type="text"
                                        value={oracleText}
                                        onChange={e => setOracleText(e.target.value)}
                                        placeholder="Rules text..."
                                        className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-primary-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Mana Value */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mana Value</label>
                                    <div className="flex border border-gray-600 rounded-lg overflow-hidden">
                                        <select
                                            value={manaValueOp}
                                            onChange={e => setManaValueOp(e.target.value)}
                                            className="bg-gray-800 text-white px-2 py-2 text-sm font-bold border-r border-gray-600 outline-none cursor-pointer"
                                        >
                                            <option>=</option>
                                            <option>{'>'}</option>
                                            <option>{'<'}</option>
                                            <option>{'>='}</option>
                                            <option>{'<='}</option>
                                            <option>!=</option>
                                        </select>
                                        <input
                                            type="number"
                                            value={manaValue}
                                            onChange={e => setManaValue(e.target.value)}
                                            className="w-full bg-gray-900 px-3 py-2 text-sm text-white outline-none"
                                        />
                                    </div>
                                </div>
                                {/* Set */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Set</label>
                                    <input
                                        type="text"
                                        value={setCode}
                                        onChange={e => setSetCode(e.target.value)}
                                        placeholder="ABC"
                                        className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-primary-500 outline-none uppercase"
                                    />
                                </div>
                                {/* CN */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">CN</label>
                                    <input
                                        type="text"
                                        value={collectorNumber}
                                        onChange={e => setCollectorNumber(e.target.value)}
                                        placeholder="#"
                                        className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-primary-500 outline-none"
                                    />
                                </div>
                            </div>

                            {/* Extra Toggles (Deck/Owned/Price) - Kept small at bottom */}
                            <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-gray-700/50">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${excludeDecks ? 'bg-primary-500 border-primary-500' : 'border-gray-500'}`}>
                                        {excludeDecks && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                    </div>
                                    <input type="checkbox" checked={excludeDecks} onChange={e => setExcludeDecks(e.target.checked)} className="hidden" />
                                    <span className="text-xs font-bold text-gray-400">Exclude Decks</span>
                                </label>

                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-gray-400">Min Qty:</span>
                                    <input
                                        type="number"
                                        min="1"
                                        value={minQuantity}
                                        onChange={e => setMinQuantity(parseInt(e.target.value))}
                                        className="w-12 bg-gray-900 border border-gray-600 rounded px-1 py-0.5 text-xs text-white text-center"
                                    />
                                </div>

                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-gray-400">Price:</span>
                                    <input
                                        type="number"
                                        placeholder="Min"
                                        value={minPrice}
                                        onChange={e => setMinPrice(e.target.value)}
                                        className="w-16 bg-gray-900 border border-gray-600 rounded px-1 py-0.5 text-xs text-white"
                                    />
                                    <span className="text-gray-500">-</span>
                                    <input
                                        type="number"
                                        placeholder="Max"
                                        value={maxPrice}
                                        onChange={e => setMaxPrice(e.target.value)}
                                        className="w-16 bg-gray-900 border border-gray-600 rounded px-1 py-0.5 text-xs text-white"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* List */}
                    <div className="flex-1 overflow-y-auto space-y-2 pr-2 min-h-0 bg-gray-950/30 rounded-lg p-2 border border-gray-800/50">
                        {cardsLoading ? (
                            <div className="text-center text-gray-500 py-10">Loading collection...</div>
                        ) : filteredCards.length === 0 ? (
                            <div className="text-center text-gray-500 py-10">
                                {searchTerm || selectedBinder !== 'all' ? 'No cards match your filters.' : 'Collection is empty.'}
                            </div>
                        ) : (
                            filteredCards.map(card => {
                                const deckName = getDeckName(card.deck_id);
                                const qty = selectedItems.get(card.id);
                                const isSelected = qty !== undefined;
                                const maxQty = card.quantity || 1;

                                return (
                                    <div
                                        key={card.id}
                                        onClick={() => handleToggle(card)}
                                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer border transition-all group ${isSelected
                                            ? 'bg-primary-900/40 border-primary-500'
                                            : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                                            }`}
                                    >
                                        {/* Image Preview */}
                                        <div className="w-12 h-16 bg-gray-900 rounded overflow-hidden flex-shrink-0 border border-gray-700 relative">
                                            {card.image_uri ? (
                                                <img src={card.image_uri} alt={card.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-[8px] text-gray-500 text-center p-1">{card.name}</div>
                                            )}
                                            {card.finish !== 'nonfoil' && (
                                                <div className="absolute top-0 right-0 bg-amber-500 text-black text-[8px] px-1 font-bold shadow-sm">
                                                    FOIL
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-white truncate text-sm">{card.name}</div>
                                            <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                                                <span className="font-mono bg-gray-900 px-1.5 py-0.5 rounded border border-gray-700">{card.set_code.toUpperCase()}</span>
                                                <span>#{card.collector_number}</span>
                                                {card.details?.prices?.usd && <span className="text-green-400">${card.details.prices.usd}</span>}
                                            </div>
                                            {deckName && (
                                                <div className="mt-1">
                                                    <span className="text-[10px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded border border-amber-500/20 truncate max-w-full inline-block">
                                                        In Deck: {deckName}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Status / Controls */}
                                        <div className="flex items-center gap-3">
                                            <div className="text-xs text-gray-500 font-mono">
                                                Owned: {maxQty}
                                            </div>

                                            {isSelected ? (
                                                <div className="flex items-center bg-gray-900 rounded-lg border border-primary-500/50" onClick={e => e.stopPropagation()}>
                                                    <button
                                                        onClick={(e) => updateQuantity(e, card, qty - 1)}
                                                        disabled={qty <= 1}
                                                        className="px-2 py-1 text-gray-400 hover:text-white disabled:opacity-30"
                                                    >-</button>
                                                    <span className="w-8 text-center text-sm font-bold text-white">{qty}</span>
                                                    <button
                                                        onClick={(e) => updateQuantity(e, card, qty + 1)}
                                                        disabled={qty >= maxQty}
                                                        className="px-2 py-1 text-gray-400 hover:text-white disabled:opacity-30"
                                                    >+</button>
                                                </div>
                                            ) : (
                                                <div className="w-6 h-6 rounded-full border border-gray-600 flex items-center justify-center group-hover:border-gray-400">
                                                    <svg className={`w-4 h-4 text-primary-400 opacity-0 group-hover:opacity-100 transition-opacity`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Footer */}
                    <div className="pt-4 border-t border-gray-800 flex justify-between items-center mt-4 bg-gray-900">
                        <div className="text-sm text-gray-400">
                            {/* Summary info could go here */}
                        </div>
                        <div className="flex gap-3">
                            <button onClick={onClose} className="px-5 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">Cancel</button>
                            <button
                                onClick={handleSubmit}
                                disabled={selectedItems.size === 0}
                                className="px-8 py-2 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold shadow-lg shadow-primary-500/20 transition-all transform hover:scale-105 active:scale-95"
                            >
                                {sourceUserId ? 'Propose Selected Items' : 'Add Selected Items'}
                            </button>
                        </div>
                    </div>
                </Dialog.Panel>
            </div>
        </Dialog>
    );
};

export default AddTradeItemModal;
