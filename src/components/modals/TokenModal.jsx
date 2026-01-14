import React, { useMemo } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';

const TokenModal = ({ isOpen, onClose, deckCards }) => {

    const tokens = useMemo(() => {
        if (!deckCards) return [];

        const tokenMap = new Map(); // id -> { tokenData, sources: [] }

        deckCards.forEach(card => {
            const data = card.data || card;
            if (!data.all_parts) return;

            data.all_parts.forEach(part => {
                if (part.component === 'token') {
                    // Use oracle_id or scryfall id as key to dedup
                    const tokenId = part.id;
                    if (!tokenMap.has(tokenId)) {
                        tokenMap.set(tokenId, {
                            id: tokenId,
                            name: part.name,
                            uri: part.uri, // API uri
                            image_uri: `https://api.scryfall.com/cards/${part.id}?format=image`, // Direct image link
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
                            <Dialog.Panel className="w-full max-w-5xl transform overflow-hidden rounded-2xl bg-gray-900 border border-white/10 p-6 text-left align-middle shadow-xl transition-all">
                                <Dialog.Title
                                    as="h3"
                                    className="text-lg font-black leading-6 text-white uppercase tracking-widest mb-6 flex items-center justify-between"
                                >
                                    <span>Required Tokens</span>
                                    <button onClick={onClose} className="text-gray-500 hover:text-white">
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </Dialog.Title>

                                {tokens.length === 0 ? (
                                    <div className="text-center py-20 text-gray-500 italic">
                                        No tokens identified for this deck.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                        {tokens.map(token => (
                                            <div key={token.id} className="bg-white/5 rounded-xl border border-white/5 overflow-hidden group hover:border-indigo-500/50 transition-all">
                                                <div className="aspect-[2.5/3.5] relative overflow-hidden bg-gray-950">
                                                    <img
                                                        src={token.image_uri}
                                                        alt={token.name}
                                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                        loading="lazy"
                                                    />
                                                </div>
                                                <div className="p-3">
                                                    <h4 className="font-bold text-white text-sm mb-1 truncate" title={token.name}>{token.name}</h4>
                                                    <div className="text-[10px] text-gray-400">
                                                        <span className="uppercase tracking-wider font-bold text-indigo-400 block mb-1">Produced By:</span>
                                                        <ul className="list-disc list-inside space-y-0.5">
                                                            {token.sources.slice(0, 3).map(source => (
                                                                <li key={source} className="truncate" title={source}>{source}</li>
                                                            ))}
                                                            {token.sources.length > 3 && (
                                                                <li className="italic text-gray-500">+{token.sources.length - 3} more</li>
                                                            )}
                                                        </ul>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
};

export default TokenModal;
