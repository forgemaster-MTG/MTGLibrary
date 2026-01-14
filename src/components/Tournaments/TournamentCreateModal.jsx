import React, { useState } from 'react';
import { api } from '../../services/api';
import { useNavigate } from 'react-router-dom';

const TournamentCreateModal = ({ isOpen, onClose, onCreated }) => {
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [format, setFormat] = useState('swiss');
    const [roundLimit, setRoundLimit] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = {
                name: name || 'New Tournament',
                format,
                settings: {
                    total_rounds: format === 'elimination' && roundLimit ? parseInt(roundLimit, 10) : null,
                    target_points: format === 'swiss' && roundLimit ? parseInt(roundLimit, 10) : null
                }
            };

            const res = await api.post('/api/tournaments', payload);

            setName('');
            setFormat('swiss');
            setRoundLimit('');
            setLoading(false);

            if (onCreated) {
                onCreated(res);
            } else {
                // Default behavior if no callback provided
                onClose();
                navigate(`/tournaments/${res.id}`);
            }
        } catch (err) {
            console.error('Failed to create tournament', err);
            setLoading(false);
            alert('Failed to create tournament. Please try again.');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
                <h2 className="text-2xl font-bold mb-4 text-white">Create Tournament</h2>
                <form onSubmit={handleSubmit}>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Event Name</label>
                    <input
                        autoFocus
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="e.g. Friday Night Magic"
                        className="w-full bg-gray-800 border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-yellow-500 outline-none mb-4"
                        required
                    />

                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Format</label>
                            <select
                                value={format}
                                onChange={e => setFormat(e.target.value)}
                                className="w-full bg-gray-800 border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-yellow-500 outline-none"
                            >
                                <option value="swiss">Swiss (Points)</option>
                                <option value="elimination">Single Elimination</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">
                                {format === 'swiss' ? 'Target Points (Optional)' : 'Round Limit (Optional)'}
                            </label>
                            <input
                                type="number"
                                min="1"
                                value={roundLimit}
                                onChange={e => setRoundLimit(e.target.value)}
                                placeholder={format === 'swiss' ? "e.g. 12" : "Auto"}
                                className="w-full bg-gray-800 border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-yellow-500 outline-none"
                            />
                        </div>
                    </div>

                    {format === 'swiss' && (
                        <div className="text-xs text-gray-500 mb-6 bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                            <span className="font-bold text-yellow-500">Note:</span> Wins are 3 points, Draws are 1 point.
                            Setting a target will end the tournament once a player reaches this score.
                        </div>
                    )}

                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 hover:bg-gray-800 rounded-lg text-gray-400 font-medium transition-colors"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-lg transition-colors disabled:opacity-50"
                            disabled={loading}
                        >
                            {loading ? 'Creating...' : 'Create Event'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default TournamentCreateModal;
