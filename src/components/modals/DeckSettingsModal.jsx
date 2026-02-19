import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { useAuth } from '../../contexts/AuthContext';
import { deckService } from '../../services/deckService';
import { useToast } from '../../contexts/ToastContext';

const DeckSettingsModal = ({ isOpen, onClose, deck, onUpdate }) => {
    const { currentUser } = useAuth();
    const { addToast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    // Form State
    const [name, setName] = useState(deck?.name || '');
    const [format, setFormat] = useState(deck?.format || 'Commander');
    const [tagsInput, setTagsInput] = useState((deck?.tags || []).join(', '));
    const [isThematic, setIsThematic] = useState(deck?.is_thematic || false);
    const [isPublic, setIsPublic] = useState(deck?.is_public || false);

    // Reset on Open
    React.useEffect(() => {
        if (isOpen && deck) {
            console.log("DeckSettingsModal Opening. Deck:", deck);
            setName(deck.name || '');
            setFormat(deck.format || 'Commander');
            setTagsInput((deck.tags || []).join(', '));
            setIsThematic(deck.is_thematic || false);
            const publicState = !!(deck.is_public || deck.isPublic);
            console.log("Setting isPublic to:", publicState);
            setIsPublic(publicState);
        }
    }, [isOpen, deck]);

    if (!isOpen || !deck) return null;

    const handleSave = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        // Parse Tags
        const tags = tagsInput
            .split(',')
            .map(t => t.trim())
            .filter(t => t.length > 0);

        try {
            console.log("Saving Deck Settings. isPublic:", isPublic);
            await deckService.updateDeck(currentUser.uid, deck.id, {
                name,
                format,
                tags,
                isThematic,
                isPublic
            });
            console.log("Deck Settings Saved.");
            addToast("Deck settings updated!", "success");
            if (onUpdate) onUpdate();
            onClose();
        } catch (err) {
            console.error("Save Error:", err);
            addToast("Failed to update deck settings.", "error");
        } finally {
            setIsLoading(false);
        }
    };

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[50] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
            <div className="bg-gray-900 border border-white/10 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden ring-1 ring-white/5">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                    <h2 className="text-xl font-black text-white uppercase tracking-wider">Deck Settings</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <form onSubmit={handleSave} className="p-6 space-y-6">
                    {/* Name */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Deck Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-gray-950/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all font-bold"
                            placeholder="Enter deck name..."
                            required
                        />
                    </div>

                    {/* Format */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Format</label>
                        <select
                            value={format}
                            onChange={(e) => setFormat(e.target.value)}
                            className="w-full bg-gray-950/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
                        >
                            {['Commander', 'Standard', 'Modern', 'Pioneer', 'Vintage', 'Legacy', 'Pauper', 'Limited'].map(f => (
                                <option key={f} value={f}>{f}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-3">
                        {/* Public Setting */}
                        <div className="flex items-center justify-between p-4 bg-black/20 rounded-xl border border-white/5">
                            <div className="space-y-0.5">
                                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                    Public Deck
                                    {isPublic && <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded uppercase tracking-wider border border-green-500/30">Visible</span>}
                                </h3>
                                <p className="text-[10px] text-gray-500">Allow others to view and share this deck via link.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={isPublic}
                                    onChange={(e) => setIsPublic(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                            </label>
                        </div>

                        {/* Thematic Setting */}
                        <div className="flex items-center justify-between p-4 bg-black/20 rounded-xl border border-white/5">
                            <div className="space-y-0.5">
                                <h3 className="text-sm font-bold text-white">Thematic DeckMode</h3>
                                <p className="text-[10px] text-gray-500">Only suggest cards from the Commander's set/era</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={isThematic}
                                    onChange={(e) => setIsThematic(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                            </label>
                        </div>
                    </div>

                    {/* Tags */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Tags (Comma Separated)</label>
                        <input
                            type="text"
                            value={tagsInput}
                            onChange={(e) => setTagsInput(e.target.value)}
                            className="w-full bg-gray-950/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
                            placeholder="E.g. Competitive, WIP, Tribal..."
                        />
                        <p className="text-[10px] text-gray-500">Separate multiple tags with commas.</p>
                    </div>

                    {/* Actions */}
                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 font-bold text-sm transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="flex-1 px-4 py-3 bg-primary-600 hover:bg-primary-500 rounded-xl text-white font-bold text-sm shadow-lg shadow-primary-500/20 transition-all flex items-center justify-center gap-2"
                        >
                            {isLoading ? 'Saving...' : 'Save Settings'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
        , document.body);
};

export default DeckSettingsModal;
