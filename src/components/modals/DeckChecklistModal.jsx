import React, { useMemo, useState, Fragment, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';

const DeckChecklistModal = ({ isOpen, onClose, deckCards, initialTab = 'missing' }) => {
    const [activeTab, setActiveTab] = useState(initialTab);

    useEffect(() => {
        if (isOpen) {
            setActiveTab(initialTab);
        }
    }, [isOpen, initialTab]);

    // --- Missing Cards Logic ---
    const missingCards = useMemo(() => {
        if (!deckCards) return [];
        // In this app, cards in a deck that are marked 'is_wishlist' are considered "needed" / not yet in collection for this deck.
        return deckCards
            .filter(c => c.is_wishlist)
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [deckCards]);

    const missingValue = useMemo(() => {
        return missingCards.reduce((acc, c) => {
            const price = parseFloat(c.prices?.[c.finish === 'foil' ? 'usd_foil' : 'usd']) || (parseFloat(c.data?.prices?.[c.finish === 'foil' ? 'usd_foil' : 'usd']) || 0);
            return acc + (price * (c.countInDeck || 1));
        }, 0);
    }, [missingCards]);

    const handleTCGPlayerMassEntry = () => {
        if (missingCards.length === 0) return;

        const cardLines = missingCards.map(c => {
            const count = c.countInDeck || 1;
            const name = c.name || c.data?.name || '';
            return `${count} ${name}`;
        });

        const list = cardLines.join('\n');
        const encoded = encodeURIComponent(list);
        window.open(`https://www.tcgplayer.com/massentry?c=${encoded}`, '_blank');
    };

    // --- Tokens Logic (Migrated from TokenModal) ---
    const tokens = useMemo(() => {
        if (!deckCards) return [];

        const tokenMap = new Map(); // id -> { tokenData, sources: [] }

        deckCards.forEach(card => {
            const data = card.data || card;
            if (!data.all_parts) return;

            data.all_parts.forEach(part => {
                if (part.component === 'token') {
                    const tokenId = part.id;
                    if (!tokenMap.has(tokenId)) {
                        tokenMap.set(tokenId, {
                            id: tokenId,
                            name: part.name,
                            uri: part.uri,
                            image_uri: `https://api.scryfall.com/cards/${part.id}?format=image`,
                            sources: new Set()
                        });
                    }
                    tokenMap.get(tokenId).sources.add(data.name);
                }
            });
        });

        return Array.from(tokenMap.values()).map(t => ({
            ...t,
            sources: Array.from(t.sources).sort()
        })).sort((a, b) => a.name.localeCompare(b.name));

    }, [deckCards]);


    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-[100]" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-5xl transform overflow-hidden rounded-2xl bg-gray-900 border border-white/10 flex flex-col max-h-[85vh] shadow-2xl transition-all h-[800px]">

                                {/* Header & Tabs */}
                                <div className="p-6 pb-0 border-b border-white/5 bg-gray-900/50 backdrop-blur-md z-10 shrink-0">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 relative">
                                        <Dialog.Title as="h3" className="text-xl font-black leading-6 text-white uppercase tracking-widest flex items-center gap-3">
                                            <span className="text-2xl">📋</span>
                                            Deck Checklist
                                        </Dialog.Title>
                                        <button onClick={onClose} className="absolute -top-2 -right-2 p-2 text-gray-500 hover:text-white transition-colors bg-white/5 rounded-full hover:bg-white/10">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    </div>

                                    <div className="flex space-x-6">
                                        <button
                                            onClick={() => setActiveTab('missing')}
                                            className={`pb-3 text-sm font-bold uppercase tracking-wider transition-all border-b-2 ${activeTab === 'missing'
                                                    ? 'text-indigo-400 border-indigo-400'
                                                    : 'text-gray-500 border-transparent hover:text-gray-300'
                                                }`}
                                        >
                                            Missing Cards ({missingCards.length})
                                        </button>
                                        <button
                                            onClick={() => setActiveTab('tokens')}
                                            className={`pb-3 text-sm font-bold uppercase tracking-wider transition-all border-b-2 ${activeTab === 'tokens'
                                                    ? 'text-pink-400 border-pink-400'
                                                    : 'text-gray-500 border-transparent hover:text-gray-300'
                                                }`}
                                        >
                                            Required Tokens ({tokens.length})
                                        </button>
                                    </div>
                                </div>

                                {/* Content Area */}
                                <div className="p-6 overflow-y-auto custom-scrollbar bg-gray-950/30 flex-1">

                                    {/* --- MISSING CARDS TAB --- */}
                                    {activeTab === 'missing' && (
                                        <div className="space-y-6 animate-fade-in text-left">
                                            {missingCards.length === 0 ? (
                                                <div className="text-center py-20 flex flex-col items-center justify-center opacity-60">
                                                    <span className="text-6xl mb-4">✨</span>
                                                    <h3 className="text-2xl font-bold text-white mb-2">Deck Complete!</h3>
                                                    <p className="text-gray-400">You have successfully collected all cards for this deck.</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-6">
                                                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-indigo-900/10 p-4 rounded-xl border border-indigo-500/20">
                                                        <div className="text-left w-full md:w-auto">
                                                            <h4 className="text-sm font-bold text-indigo-300 uppercase tracking-wider mb-1">Acquisition Summary</h4>
                                                            <p className="text-gray-400 text-xs">You need <span className="text-white font-bold">{missingCards.length}</span> more cards to finish this deck.</p>
                                                        </div>
                                                        <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                                                            <div className="text-right">
                                                                <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Est. Cost</div>
                                                                <div className="text-lg md:text-2xl font-mono font-bold text-white">${missingValue.toFixed(2)}</div>
                                                            </div>
                                                            <button
                                                                onClick={handleTCGPlayerMassEntry}
                                                                className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-bold text-xs md:text-sm shadow-lg shadow-green-900/20 transition-all flex items-center gap-2"
                                                            >
                                                                <span>🛒</span> <span className="hidden md:inline">Buy Missing on</span> TCGPlayer
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                                        {missingCards.map(card => (
                                                            <div key={card.id} className="flex items-center gap-3 p-2 bg-gray-900/50 border border-gray-800 rounded-lg group hover:border-gray-700 transition-colors">
                                                                <div className="relative w-10 h-14 shrink-0 rounded overflow-hidden bg-gray-800">
                                                                    <img
                                                                        src={card.image_uris?.small || card.card_faces?.[0]?.image_uris?.small || ''}
                                                                        alt={card.name}
                                                                        className="w-full h-full object-cover"
                                                                    />
                                                                </div>
                                                                <div className="flex-1 min-w-0 flex items-center justify-between">
                                                                    <div className="min-w-0">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="font-mono text-gray-500 text-xs bg-gray-800 px-1.5 rounded shrink-0">{card.countInDeck}x</span>
                                                                            <h5 className="font-bold text-gray-200 text-sm truncate" title={card.name}>{card.name}</h5>
                                                                        </div>
                                                                        <div className="flex items-center gap-2 mt-1">
                                                                            {card.finish === 'foil' && <span className="text-[9px] bg-yellow-900/30 text-yellow-500 px-1 rounded border border-yellow-800/50 uppercase">FOIL</span>}
                                                                            <span className="text-[10px] text-gray-500 truncate max-w-[100px]">{card.set_name}</span>
                                                                        </div>
                                                                    </div>
                                                                    <span className="text-xs font-mono text-indigo-400 shrink-0 bg-gray-950 px-2 py-1 rounded border border-gray-800 ml-2">
                                                                        ${(parseFloat(card.prices?.[card.finish === 'foil' ? 'usd_foil' : 'usd']) || 0).toFixed(2)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}


                                    {/* --- TOKENS TAB --- */}
                                    {activeTab === 'tokens' && (
                                        <div className="animate-fade-in h-full text-left">
                                            {tokens.length === 0 ? (
                                                <div className="text-center py-20 text-gray-500 italic flex flex-col items-center">
                                                    <span className="text-4xl mb-4 grayscale opacity-30">🪙</span>
                                                    No tokens identified for this deck.
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-4">
                                                    {tokens.map(token => (
                                                        <div key={token.id} className="bg-white/5 rounded-xl border border-white/5 overflow-hidden group hover:border-pink-500/50 transition-all flex flex-col">
                                                            <div className="aspect-[2.5/3.5] relative overflow-hidden bg-gray-950">
                                                                <img
                                                                    src={token.image_uri}
                                                                    alt={token.name}
                                                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                                    loading="lazy"
                                                                />
                                                            </div>
                                                            <div className="p-3">
                                                                <h4 className="font-bold text-white text-xs md:text-sm mb-1 truncate" title={token.name}>{token.name}</h4>
                                                                <div className="text-[10px] text-gray-400">
                                                                    <span className="uppercase tracking-wider font-bold text-pink-400 block mb-1">Source:</span>
                                                                    <ul className="space-y-0.5 list-none">
                                                                        {token.sources.slice(0, 2).map(source => (
                                                                            <li key={source} className="truncate" title={source}>• {source}</li>
                                                                        ))}
                                                                        {token.sources.length > 2 && (
                                                                            <li className="italic text-gray-500 pl-2">+{token.sources.length - 2} more</li>
                                                                        )}
                                                                    </ul>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
};

export default DeckChecklistModal;
