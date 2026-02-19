import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../contexts/AuthContext';

const UsernameRequiredModal = ({ isOpen, onClose, onSuccess }) => {
    const { updateProfileFields } = useAuth();
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        if (!username.trim()) {
            setError('Username is required.');
            return;
        }

        setLoading(true);
        try {
            await updateProfileFields({ username: username.trim() });
            onSuccess(); // Callback to retry the original action or just close
            onClose();
        } catch (err) {
            console.error(err);
            setError('Failed to update username. It might be taken.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" />
            <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md relative z-10 shadow-2xl p-8 animate-fade-in-up">

                <h2 className="text-2xl font-bold text-white mb-2">Identify Yourself</h2>
                <p className="text-gray-400 mb-6">
                    To connect with friends and share decks, you need to set a unique username so others can find you.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="e.g. Planeswalker99"
                            className="w-full bg-gray-950 border border-gray-800 text-white px-4 py-3 rounded-xl focus:ring-2 focus:ring-primary-600 focus:border-transparent outline-none transition-all"
                            autoFocus
                        />
                    </div>

                    {error && (
                        <div className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                            {error}
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-primary-600 hover:bg-primary-500 text-white font-bold py-2 px-6 rounded-xl shadow-lg shadow-primary-600/20 transition-all disabled:opacity-50 flex items-center gap-2"
                        >
                            {loading ? 'Saving...' : 'Save & Continue'}
                        </button>
                    </div>
                </form>

            </div>
        </div>,
        document.body
    );
};

export default UsernameRequiredModal;
