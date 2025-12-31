import React, { useState, useEffect } from 'react';
import { useCardModal } from '../../contexts/CardModalContext';
import { useCollection } from '../../hooks/useCollection';
import { useDecks } from '../../hooks/useDecks'; // For deck context if needed
import { deckService } from '../../services/deckService';
import { api } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const CardDetailsModal = () => {
    const { isOpen, selectedCard, closeCardModal } = useCardModal();
    const { cards: allUserCards, removeCard, updateCard, refreshCollection } = useCollection();
    const { addToast } = useToast();

    // Local state
    const [isFlipped, setIsFlipped] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    // Edit Form State
    const [editForm, setEditForm] = useState({
        quantity: 1,
        finish: 'nonfoil',
        deckId: '',
        price_bought: '',
        tags: [],
        currentTag: ''
    });

    const [deckList, setDeckList] = useState([]); // To populate deck dropdown if needed

    // Reset state when card changes
    useEffect(() => {
        if (isOpen && selectedCard) {
            setIsFlipped(false);
            setIsEditing(false);
            setEditForm({
                quantity: selectedCard.count || selectedCard.quantity || 1,
                finish: selectedCard.finish || 'nonfoil',
                deckId: selectedCard.deckId || selectedCard.deck_id || '',
                price_bought: selectedCard.price_bought || '',
                tags: typeof selectedCard.tags === 'string' ? JSON.parse(selectedCard.tags) : (selectedCard.tags || []),
                currentTag: ''
            });
            // Fetch decks for dropdown? (Optional optimization: fetch only if editing)
            api.get('/decks').then(setDeckList).catch(err => console.error("Failed to load decks", err));
        }
    }, [isOpen, selectedCard]);

    if (!isOpen || !selectedCard) return null;

    // --- Helpers ---
    const data = selectedCard.data || selectedCard;
    const faces = data.card_faces;
    const isDoubleSided = faces && faces.length > 1 && !!faces[1].image_uris;

    const getFace = (faceIndex) => {
        if (!isDoubleSided) return data;
        return data.card_faces[faceIndex];
    };

    const currentFaceIndex = isFlipped ? 1 : 0;
    const currentFace = getFace(currentFaceIndex);

    // Images
    const getScryfallImage = (faceData) => {
        return faceData.image_uris?.normal || faceData.image_uris?.large || null;
    };

    const getArtCrop = (faceData) => {
        return faceData.image_uris?.art_crop || faceData.image_uris?.large || faceData.image_uris?.normal || null;
    };

    const frontImage = isDoubleSided
        ? getScryfallImage(data.card_faces[0])
        : (data.image_uris?.normal || data.image_uris?.large || selectedCard.image_uri);

    const backImage = isDoubleSided
        ? getScryfallImage(data.card_faces[1])
        : null;

    const frontArt = isDoubleSided
        ? getArtCrop(data.card_faces[0])
        : (data.image_uris?.art_crop || data.image_uris?.large || selectedCard.image_uri);

    const backArt = isDoubleSided
        ? getArtCrop(data.card_faces[1])
        : null;

    const currentImage = isFlipped ? backImage : frontImage;
    const activeArtBackground = (isFlipped ? backArt : frontArt) || 'https://placehold.co/1000x800?text=No+Art';

    // Formatting Helpers
    const formatMana = (mana_cost) => {
        if (!mana_cost) return '';
        return mana_cost.replace(/\{/g, '').replace(/\}/g, ' ');
    };

    const getLegalityBadge = (format, status) => {
        const colors = {
            legal: 'bg-green-600 text-white border-green-700',
            not_legal: 'bg-gray-700 text-gray-400 border-gray-600',
            banned: 'bg-red-600 text-white border-red-700',
            restricted: 'bg-yellow-600 text-white border-yellow-700'
        };
        const colorClass = colors[status] || colors.not_legal;
        return (
            <div key={format} className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${colorClass} flex justify-center items-center shadow-sm`}>
                <span>{format}</span>
            </div>
        );
    };

    // --- Actions ---
    const handleDelete = async () => {
        if (window.confirm(`Are you sure you want to delete ${selectedCard.name} from your collection?`)) {
            try {
                await removeCard(selectedCard.id || selectedCard.firestoreId);
                addToast('Card deleted', 'success');
                closeCardModal();
            } catch (err) {
                console.error(err);
                addToast('Failed to delete card', 'error');
            }
        }
    };

    const handleSaveDetails = async () => {
        try {
            const updatePayload = {
                count: parseInt(editForm.quantity),
                finish: editForm.finish,
                deck_id: editForm.deckId ? parseInt(editForm.deckId) : null,
                price_bought: editForm.price_bought ? parseFloat(editForm.price_bought) : null,
                tags: editForm.tags
            };

            await updateCard(selectedCard.id || selectedCard.firestoreId, updatePayload);
            addToast('Card details updated', 'success');
            setIsEditing(false);
            // Optionally close or just stay open with new data
        } catch (err) {
            console.error(err);
            addToast('Failed to update details', 'error');
        }
    };

    // Tag Helpers
    const addTag = (e) => {
        if (e.key === 'Enter' && editForm.currentTag.trim()) {
            e.preventDefault();
            if (!editForm.tags.includes(editForm.currentTag.trim())) {
                setEditForm(prev => ({ ...prev, tags: [...prev.tags, prev.currentTag.trim()], currentTag: '' }));
            }
        }
    };

    const removeTag = (tag) => {
        setEditForm(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden animate-fade-in" role="dialog">
            {/* Standard Dark Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
                onClick={closeCardModal}
            ></div>

            {/* Modal Container */}
            <div className="relative z-10 w-full max-w-6xl h-full md:h-[90vh] max-h-[90vh] rounded-2xl shadow-2xl flex flex-col md:flex-row overflow-y-auto md:overflow-hidden bg-gray-900/50 border border-gray-700">

                {/* Modal Background using Card Art - FIXED VARIABLE NAME */}
                <div className="absolute inset-0 z-0 overflow-hidden rounded-2xl">
                    <div
                        className="absolute inset-0 bg-cover bg-center transition-all duration-700 ease-in-out transform scale-110 opacity-100"
                        style={{ backgroundImage: `url('${activeArtBackground}')` }}
                    ></div>
                    <div className="absolute inset-0 bg-black/40"></div>
                </div>

                {/* Close Button */}
                <button
                    onClick={closeCardModal}
                    className="absolute top-4 right-4 z-50 p-2 bg-black/30 hover:bg-black/60 rounded-full text-white/70 hover:text-white transition-colors backdrop-blur-md"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>

                {/* LEFT: Card Image Presentation */}
                <div className="w-full md:w-1/2 lg:w-5/12 p-8 flex flex-col items-center justify-center relative shrink-0 z-10">
                    <div className={`relative w-full max-w-xs md:max-w-md aspect-[2.5/3.5] perspective-1000 transition-transform duration-500`}>
                        <img
                            src={currentImage || 'https://placehold.co/250x350?text=No+Image'}
                            alt={selectedCard.name}
                            className="w-full h-full object-contain drop-shadow-2xl rounded-xl shadow-black/50"
                        />
                        {isDoubleSided && (
                            <button
                                onClick={() => setIsFlipped(!isFlipped)}
                                className="absolute top-4 right-4 bg-black/60 hover:bg-indigo-600 text-white p-3 rounded-full shadow-lg border border-white/20 hover:border-indigo-400 transition-all group backdrop-blur-md"
                                title="Flip Card"
                            >
                                <svg className={`w-6 h-6 transform transition-transform duration-500 ${isFlipped ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            </button>
                        )}
                    </div>
                    {data.artist && (
                        <div className="mt-4 text-white/80 text-xs flex items-center gap-1 bg-black/30 px-3 py-1 rounded-full backdrop-blur-sm border border-white/10">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            Illustrated by <span className="font-medium">{data.artist}</span>
                        </div>
                    )}
                </div>

                {/* RIGHT: Data & Details */}
                <div className="flex-1 flex flex-col md:h-full bg-gray-900/60 backdrop-blur-xl min-h-0 z-10 border-l border-white/10">

                    {/* Header Info */}
                    <div className="p-6 border-b border-gray-700 bg-gray-900/50 shrink-0 relative group">
                        {/* Edit Action (Pencil) */}
                        <button
                            onClick={() => setIsEditing(!isEditing)}
                            className={`absolute top-6 right-16 p-2 rounded-full transition-all ${isEditing ? 'text-indigo-400 bg-indigo-500/20' : 'text-gray-500 hover:text-white hover:bg-gray-700'}`}
                            title={isEditing ? "Cancel Editing" : "Edit Card Details"}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>

                        <h2 className="text-3xl font-bold text-white mb-1 pr-10">{data.name}</h2>
                        <div className="flex flex-wrap items-center gap-4 text-gray-400 text-sm mt-2">
                            <span className="font-medium text-gray-300">{currentFace.type_line}</span>
                            {currentFace.mana_cost && (
                                <span className="bg-gray-800 px-2 py-0.5 rounded border border-gray-700 text-gray-200 font-mono tracking-wider">
                                    {formatMana(currentFace.mana_cost)}
                                </span>
                            )}
                            <div className="flex items-center gap-1">
                                <span className="text-indigo-400 font-bold">{data.set_name || data.set?.toUpperCase()}</span>
                                <span className="text-gray-600">•</span>
                                <span className="capitalize">{data.rarity}</span>
                                <span className="text-gray-600">•</span>
                                <span>#{data.collector_number}</span>
                            </div>
                        </div>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-visible md:overflow-y-auto p-6 space-y-8 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">

                        {/* Gameplay Section */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                                Gameplay & Rules
                            </h3>

                            {/* Oracle Text */}
                            <div className="bg-gray-900/50 rounded-xl p-5 border border-gray-700/50 shadow-inner">
                                {currentFace.oracle_text ? (
                                    <div className="text-gray-200 whitespace-pre-wrap font-serif leading-relaxed text-lg">
                                        {currentFace.oracle_text.split('\n').map((line, i) => (
                                            <p key={i} className="mb-2 last:mb-0">{line}</p>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="text-gray-500 italic">No rules text.</span>
                                )}

                                {currentFace.flavor_text && (
                                    <div className="mt-4 pt-4 border-t border-gray-700/50 text-gray-400 italic font-serif text-sm">
                                        "{currentFace.flavor_text}"
                                    </div>
                                )}
                            </div>

                            {/* PT / Loyalty */}
                            {(currentFace.power || currentFace.loyalty) && (
                                <div className="flex justify-end">
                                    <div className="bg-gray-800 border border-gray-600 px-4 py-2 rounded-lg text-xl font-bold text-white shadow-lg">
                                        {currentFace.power ? `${currentFace.power} / ${currentFace.toughness}` : `Loyalty: ${currentFace.loyalty}`}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Legalities Section */}
                        {data.legalities && (
                            <div className="space-y-4">
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Legalities</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                    {getLegalityBadge('Commander', data.legalities.commander)}
                                    {getLegalityBadge('Standard', data.legalities.standard)}
                                    {getLegalityBadge('Modern', data.legalities.modern)}
                                    {getLegalityBadge('Pauper', data.legalities.pauper)}
                                    {getLegalityBadge('Legacy', data.legalities.legacy)}
                                    {getLegalityBadge('Vintage', data.legalities.vintage)}
                                </div>
                            </div>
                        )}

                        {/* Collection Section */}
                        <div className="space-y-4 pt-4 border-t border-gray-700/50">
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                Status & Ownership {isEditing && <span className="text-indigo-400 text-[10px] ml-2 font-normal animate-pulse">(Editing)</span>}
                            </h3>

                            {/* Wishlist Indicator Badge */}
                            {selectedCard.is_wishlist && !isEditing && (
                                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 flex items-center gap-3 animate-pulse">
                                    <div className="p-2 bg-orange-500 rounded-full text-white">
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                                    </div>
                                    <div>
                                        <div className="text-orange-400 font-black text-xs uppercase tracking-wider">In Wishlist</div>
                                        <div className="text-gray-400 text-[10px]">This card is on your want list.</div>
                                    </div>
                                </div>
                            )}

                            {/* Aggregation Logic / Display */}
                            {(() => {
                                const scryfallId = data.id;
                                const userCopies = allUserCards.filter(c => c.scryfall_id === scryfallId || c.scryfallId === scryfallId || c.id === scryfallId);

                                const ownedNormal = userCopies.filter(c => !c.is_wishlist && c.finish === 'nonfoil').reduce((sum, c) => sum + (c.count || 1), 0);
                                const ownedFoil = userCopies.filter(c => !c.is_wishlist && c.finish === 'foil').reduce((sum, c) => sum + (c.count || 1), 0);
                                const wishCopies = userCopies.filter(c => c.is_wishlist).reduce((sum, c) => sum + (c.count || 1), 0);

                                return (
                                    <div className="space-y-4">
                                        {/* Status Row */}
                                        <div className="grid grid-cols-3 gap-3">
                                            <div className={`p-2.5 rounded-xl border transition-all ${ownedNormal > 0 ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-gray-800/20 border-gray-700/30 opacity-40'}`}>
                                                <div className="text-[10px] font-black uppercase tracking-tighter text-gray-400 mb-0.5">Normal</div>
                                                <div className="text-xl font-black text-white">{ownedNormal}</div>
                                                <div className="text-[9px] text-gray-500 font-bold uppercase">Owned</div>
                                            </div>
                                            <div className={`p-2.5 rounded-xl border transition-all ${ownedFoil > 0 ? 'bg-purple-500/10 border-purple-500/30' : 'bg-gray-800/20 border-gray-700/30 opacity-40'}`}>
                                                <div className="text-[10px] font-black uppercase tracking-tighter text-gray-400 mb-0.5">Foil</div>
                                                <div className="text-xl font-black text-indigo-400">{ownedFoil}</div>
                                                <div className="text-[9px] text-gray-500 font-bold uppercase">Owned</div>
                                            </div>
                                            <div className={`p-2.5 rounded-xl border transition-all ${wishCopies > 0 ? 'bg-orange-500/10 border-orange-500/30' : 'bg-gray-800/20 border-gray-700/30 opacity-40'}`}>
                                                <div className="text-[10px] font-black uppercase tracking-tighter text-gray-400 mb-0.5">Wishlist</div>
                                                <div className="text-xl font-black text-orange-400">{wishCopies}</div>
                                                <div className="text-[9px] text-gray-500 font-bold uppercase">Wanted</div>
                                            </div>
                                        </div>

                                        {/* Instance Specifics */}
                                        {(isEditing || (selectedCard.firestoreId || selectedCard.firestore_id)) && (
                                            <div className="bg-gray-950/40 rounded-xl overflow-hidden border border-gray-700/50">
                                                <div className="px-3 py-2 bg-gray-800/40 border-b border-gray-700/50 flex justify-between items-center text-[10px] uppercase font-black tracking-widest text-gray-400">
                                                    <span>Selected Item Details</span>
                                                    {selectedCard.is_wishlist && <span className="text-orange-500">Wishlist Copy</span>}
                                                </div>
                                                <table className="w-full text-xs text-left">
                                                    <thead className="bg-gray-900/50 text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                                                        <tr>
                                                            <th className="px-3 py-2">Location</th>
                                                            <th className="px-3 py-2 text-center">Foil</th>
                                                            <th className="px-3 py-2 text-right">Qty</th>
                                                            <th className="px-3 py-2 text-right">Added</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-700/30 text-gray-300">
                                                        <tr>
                                                            <td className="px-3 py-2">
                                                                {isEditing ? (
                                                                    <div className="space-y-2">
                                                                        <select
                                                                            value={editForm.deckId}
                                                                            onChange={(e) => setEditForm({ ...editForm, deckId: e.target.value })}
                                                                            className="bg-gray-800 border border-gray-600 rounded px-2 py-0.5 text-[10px] text-white w-full"
                                                                        >
                                                                            <option value="">Binder</option>
                                                                            {deckList.map(deck => (
                                                                                <option key={deck.id} value={deck.id}>Deck: {deck.name}</option>
                                                                            ))}
                                                                        </select>

                                                                        {/* Price Bought */}
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-gray-500 text-[9px]">PAID $</span>
                                                                            <input
                                                                                type="number"
                                                                                step="0.01"
                                                                                placeholder="0.00"
                                                                                value={editForm.price_bought}
                                                                                onChange={(e) => setEditForm({ ...editForm, price_bought: e.target.value })}
                                                                                className="bg-gray-800 border-none rounded px-2 py-0.5 text-[10px] text-white w-20 focus:ring-1 focus:ring-indigo-500"
                                                                            />
                                                                        </div>

                                                                        {/* Tags */}
                                                                        <div className="space-y-1">
                                                                            <div className="flex flex-wrap gap-1">
                                                                                {editForm.tags && editForm.tags.map(tag => (
                                                                                    <span key={tag} className="bg-indigo-600/50 text-white px-1.5 rounded text-[9px] flex items-center gap-1 border border-indigo-500/30">
                                                                                        {tag}
                                                                                        <button onClick={() => removeTag(tag)} className="hover:text-red-300">×</button>
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                            <input
                                                                                type="text"
                                                                                placeholder="+ Tag..."
                                                                                value={editForm.currentTag}
                                                                                onChange={(e) => setEditForm({ ...editForm, currentTag: e.target.value })}
                                                                                onKeyDown={addTag}
                                                                                className="bg-gray-800 border border-gray-600 rounded px-2 py-0.5 text-[10px] text-white w-full focus:ring-1 focus:ring-indigo-500"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="space-y-1">
                                                                        <div>{selectedCard.deckId ? `Deck #${selectedCard.deckId}` : 'Binder'}</div>
                                                                        {(selectedCard.tags && (typeof selectedCard.tags === 'string' ? JSON.parse(selectedCard.tags) : selectedCard.tags).length > 0) && (
                                                                            <div className="flex flex-wrap gap-1 mt-1">
                                                                                {(typeof selectedCard.tags === 'string' ? JSON.parse(selectedCard.tags) : selectedCard.tags).map(t => (
                                                                                    <span key={t} className="text-[9px] bg-gray-700 px-1 rounded text-gray-300">{t}</span>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2 text-center align-top">
                                                                {isEditing ? (
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={editForm.finish === 'foil'}
                                                                        onChange={(e) => setEditForm({ ...editForm, finish: e.target.checked ? 'foil' : 'nonfoil' })}
                                                                        className="rounded bg-gray-700 border-gray-600 text-indigo-600"
                                                                        title="Is Foil?"
                                                                    />
                                                                ) : (
                                                                    selectedCard.finish === 'foil' ? 'Yes' : '-'
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2 text-right font-black align-top">
                                                                {isEditing ? (
                                                                    <input
                                                                        type="number"
                                                                        min="1"
                                                                        value={editForm.quantity}
                                                                        onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                                                                        className="bg-gray-800 border border-gray-600 rounded px-1 py-0.5 text-[10px] text-white w-12 text-center"
                                                                    />
                                                                ) : (
                                                                    selectedCard.count || selectedCard.quantity || 1
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2 text-right text-gray-500 font-mono text-[10px] align-top">
                                                                <div>{selectedCard.added_at ? new Date(selectedCard.added_at).toLocaleDateString() : 'N/A'}</div>
                                                                {selectedCard.price_bought && (
                                                                    <div className="text-green-500/70 mt-1" title="Price Paid">${parseFloat(selectedCard.price_bought).toFixed(2)}</div>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}

                                        {/* Purchase Action */}
                                        {selectedCard.is_wishlist && !isEditing && (
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        await updateCard(selectedCard.id || selectedCard.firestoreId, { is_wishlist: false });
                                                        addToast("Card moved to collection!", "success");
                                                    } catch (err) {
                                                        addToast("Failed to move card", "error");
                                                    }
                                                }}
                                                className="w-full py-2.5 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-lg shadow-lg shadow-orange-900/30 transition-all flex items-center justify-center gap-2"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>
                                                I Got This Copy!
                                            </button>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Art & Aesthetics */}
                        <div className="space-y-4 pt-4 border-t border-gray-700/50">
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                Art & Aesthetics
                            </h3>
                            <div className="bg-gray-900/30 rounded-xl p-4 border border-gray-700/50 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                                <div className="flex justify-between border-b border-gray-800 py-1">
                                    <span className="text-gray-500">Artist</span>
                                    <span className="text-white font-medium">{data.artist || 'Unknown'}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-800 py-1">
                                    <span className="text-gray-500">Frame</span>
                                    <span className="text-white">{data.frame || '2015'}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-800 py-1">
                                    <span className="text-gray-500">Border Color</span>
                                    <span className="text-white capitalize">{data.border_color || 'Black'}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-800 py-1">
                                    <span className="text-gray-500">Finishes</span>
                                    <span className="text-white capitalize">{data.finishes?.join(', ')}</span>
                                </div>
                                {data.watermark && (
                                    <div className="flex justify-between border-b border-gray-800 py-1">
                                        <span className="text-gray-500">Watermark</span>
                                        <span className="text-white capitalize">{data.watermark}</span>
                                    </div>
                                )}
                                <div className="flex justify-between border-b border-gray-800 py-1">
                                    <span className="text-gray-500">Illustration ID</span>
                                    <span className="text-gray-400 font-mono text-xs">{data.illustration_id?.slice(0, 8)}...</span>
                                </div>
                            </div>
                        </div>

                        {/* Developer / Metadata */}
                        <div className="space-y-4 pt-4 border-t border-gray-700/50">
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                                Developer / Metadata
                            </h3>
                            <div className="bg-gray-900/30 rounded-xl p-4 border border-gray-700/50 space-y-2 text-sm font-mono">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">External Links</span>
                                    <a href={data.scryfall_uri} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">
                                        View on Scryfall
                                    </a>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Scryfall ID</span>
                                    <span className="text-gray-400">{data.id}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Oracle ID</span>
                                    <span className="text-gray-400">{data.oracle_id}</span>
                                </div>
                                {selectedCard.firestoreId && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Database ID</span>
                                        <span className="text-gray-400">{selectedCard.firestoreId}</span>
                                    </div>
                                )}
                                <div className="border-t border-gray-800 pt-2 mt-2">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Released At</span>
                                        <span className="text-gray-300">{data.released_at}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Reserved List</span>
                                        <span className={data.reserved ? "text-red-400" : "text-gray-400"}>{data.reserved ? 'true' : 'false'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Actions Footer - Only visible when editing */}
                        {isEditing && (
                            <div className="pt-6 mt-6 border-t border-gray-700 flex gap-4 animate-fade-in-up">
                                <button
                                    onClick={() => setIsEditing(false)}
                                    className="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-3 rounded-lg border border-gray-500 transition-all font-bold tracking-wide uppercase text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDelete}
                                    className="flex-1 bg-red-600/80 hover:bg-red-600 text-white py-3 rounded-lg shadow-md transition-all font-bold tracking-wide uppercase text-sm"
                                >
                                    Delete Card
                                </button>
                                <button
                                    onClick={handleSaveDetails}
                                    className="flex-1 bg-green-600 hover:bg-green-500 text-white py-3 rounded-lg shadow-lg shadow-green-900/20 transition-all font-bold tracking-wide uppercase text-sm"
                                >
                                    Save Changes
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CardDetailsModal;
