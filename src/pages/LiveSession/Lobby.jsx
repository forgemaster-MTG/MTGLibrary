import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import { useAuth } from '../../contexts/AuthContext';

const Lobby = () => {
    const navigate = useNavigate();
    const { currentUser, userProfile } = useAuth();
    const [joinPin, setJoinPin] = useState('');
    const [isHosting, setIsHosting] = useState(false);
    const [error, setError] = useState(null);
    const [socket, setSocket] = useState(null);

    // Initialize socket connection on mount
    useEffect(() => {
        const s = io();
        setSocket(s);

        s.on('connect_error', (err) => {
            console.error("Socket Connection Error:", err);
            setError("Connection to Game Server failed.");
        });

        return () => {
            if (s) s.disconnect();
        };
    }, []);

    const handleHostGame = () => {
        if (!socket || !socket.connected) {
            setError('Connecting to server... please wait.');
            if (socket) socket.connect();
            return;
        }

        const pin = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit PIN

        socket.emit('host-game', { pin }, (response) => {
            if (response.success) {
                // Navigate to room as host
                navigate(`/play/room/${response.roomId}`, { state: { pin, isHost: true } });
            } else {
                setError('Failed to create game: ' + (response.error || 'Unknown'));
            }
        });
    };

    const handleJoinGame = (e) => {
        e.preventDefault();
        if (joinPin.length !== 6) {
            setError('PIN must be 6 digits');
            return;
        }

        // Just navigate to the room, let the room component handle the socket 'join' event
        navigate(`/play/room/game-found-via-pin`, { state: { pin: joinPin, isHost: false } });
    };

    return (
        <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* Background Ambience */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary-900/20 via-gray-900 to-black z-0" />

            <div className="relative z-10 w-full max-w-md space-y-8">
                <div className="text-center space-y-2">
                    <h1 className="text-4xl font-black text-white uppercase tracking-wider">The War Room</h1>
                    <p className="text-primary-300 font-medium">MTG Live Session</p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-200 p-3 rounded-lg text-center text-sm font-bold">
                        {error}
                    </div>
                )}

                <div className="grid gap-6">
                    {/* Join Section */}
                    <div className="bg-white/5 backdrop-blur-sm border border-white/10 p-6 rounded-2xl space-y-4">
                        <h2 className="text-xl font-bold text-white mb-2">Join a Battle</h2>
                        <form onSubmit={handleJoinGame} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Session PIN</label>
                                <input
                                    type="text"
                                    maxLength="6"
                                    placeholder="000000"
                                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-4 text-center text-3xl font-mono text-white tracking-[0.5em] focus:outline-none focus:border-primary-500 transition-colors"
                                    value={joinPin}
                                    onChange={(e) => setJoinPin(e.target.value.replace(/\D/g, ''))}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={joinPin.length !== 6}
                                className="w-full bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl shadow-lg shadow-primary-500/20 transition-all transform active:scale-95 uppercase tracking-wider"
                            >
                                Enter Battlefield
                            </button>
                        </form>
                    </div>

                    <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-white/10"></div>
                        <span className="flex-shrink-0 mx-4 text-gray-500 text-xs font-bold uppercase tracking-widest">OR</span>
                        <div className="flex-grow border-t border-white/10"></div>
                    </div>

                    {/* Host Section */}
                    <button
                        onClick={handleHostGame}
                        className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold py-4 rounded-xl transition-all flex flex-col items-center justify-center gap-1 group"
                    >
                        <span className="uppercase tracking-wider">Host New Session</span>
                        <span className="text-[10px] text-gray-400 font-normal group-hover:text-primary-300">Generate a PIN for friends to join</span>
                    </button>
                </div>

                <div className="text-center pt-8">
                    <button onClick={() => navigate('/')} className="text-gray-500 hover:text-white text-sm font-bold uppercase tracking-widest transition-colors">
                        &larr; Back to Base
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Lobby;
