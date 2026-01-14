import React, { useEffect, useState, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import LifeCounter from '../../components/LiveSession/LifeCounter';
import ResourcesModal from '../../components/LiveSession/ResourcesModal';
import GameSummaryModal from '../../components/LiveSession/GameSummaryModal';
import { Skull, Zap, TrendingUp, DollarSign, Shield, Flag, Play, SkipForward } from 'lucide-react';

// Singleton socket for the session
let socket;

const GameRoom = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { userProfile } = useAuth();
    const [gameState, setGameState] = useState(null);
    const [finalGameState, setFinalGameState] = useState(null);
    const [myPlayerId, setMyPlayerId] = useState(null);
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isResourcesOpen, setIsResourcesOpen] = useState(false);
    const [isGameSummaryOpen, setIsGameSummaryOpen] = useState(false);

    const pin = location.state?.pin;
    const isHost = location.state?.isHost;

    // Refs for mutable state in callbacks/effects
    const [selectedDeckId, setSelectedDeckId] = useState(null);
    const [myDecks, setMyDecks] = useState([]);
    const [hasSelectedDeck, setHasSelectedDeck] = useState(false);
    const [joinError, setJoinError] = useState(null);

    // Refs for mutable state in callbacks/effects
    const roomIdRef = useRef(null);

    // Helper to render opponent counters
    const renderOpponentCounters = (opp) => {
        const counters = opp.counters || {};
        const commanderDamage = opp.commanderDamage || {};
        const damageFromMe = commanderDamage[myPlayerId] || 0;

        // If nothing to show
        if (!damageFromMe && !counters.poison && !counters.energy && !counters.experience && !counters.commanderTax) return null;

        return (
            <div className="flex items-center justify-center gap-2 absolute bottom-2 w-full px-2 pointer-events-none">
                {damageFromMe > 0 && (
                    <div className="flex items-center gap-0.5 text-red-500 bg-black/40 px-1.5 py-0.5 rounded-full backdrop-blur-sm shadow-sm border border-white/5">
                        <Shield className="w-3 h-3" />
                        <span className="text-[10px] font-bold">{damageFromMe}</span>
                    </div>
                )}
                {counters.poison > 0 && (
                    <div className="flex items-center gap-0.5 text-green-500 bg-black/40 px-1.5 py-0.5 rounded-full backdrop-blur-sm shadow-sm border border-white/5">
                        <Skull className="w-3 h-3" />
                        <span className="text-[10px] font-bold">{counters.poison}</span>
                    </div>
                )}
                {counters.energy > 0 && (
                    <div className="flex items-center gap-0.5 text-yellow-400 bg-black/40 px-1.5 py-0.5 rounded-full backdrop-blur-sm shadow-sm border border-white/5">
                        <Zap className="w-3 h-3" />
                        <span className="text-[10px] font-bold">{counters.energy}</span>
                    </div>
                )}
                {counters.experience > 0 && (
                    <div className="flex items-center gap-0.5 text-blue-400 bg-black/40 px-1.5 py-0.5 rounded-full backdrop-blur-sm shadow-sm border border-white/5">
                        <TrendingUp className="w-3 h-3" />
                        <span className="text-[10px] font-bold">{counters.experience}</span>
                    </div>
                )}
                {counters.commanderTax > 0 && (
                    <div className="flex items-center gap-0.5 text-gray-400 bg-black/40 px-1.5 py-0.5 rounded-full backdrop-blur-sm shadow-sm border border-white/5">
                        <DollarSign className="w-3 h-3" />
                        <span className="text-[10px] font-bold">{counters.commanderTax}</span>
                    </div>
                )}
            </div>
        );
    };

    // Load Decks Effect
    useEffect(() => {
        if (userProfile) {
            api.get('/api/decks', { limit: 100 })
                .then(data => setMyDecks(Array.isArray(data) ? data : (data.decks || [])))
                .catch(err => {
                    console.error('Failed to load decks:', err);
                    // Add a generic deck option if fetch fails
                    setMyDecks([]);
                });
        }
    }, [userProfile]);

    // Initialization Effect
    useEffect(() => {
        // Wait for deck selection before connecting
        if (!hasSelectedDeck) return;

        // Initialize socket
        if (!socket) {
            socket = io({
                transports: ['websocket', 'polling'],
                reconnectionAttempts: 5
            });
        } else if (socket.disconnected) {
            socket.connect();
        }

        const setupGame = () => {
            if (!pin) {
                setError('No PIN provided. Please join from the lobby.');
                setTimeout(() => navigate('/play/lobby'), 3000);
                return;
            }

            const playerName = userProfile?.username || (isHost ? 'Host' : 'Guest');

            console.log('Emitting join-game...');
            socket.emit('join-game', {
                pin,
                name: playerName,
                userId: userProfile?.id,
                deckId: selectedDeckId === 'generic' ? null : selectedDeckId
            }, (response) => {
                console.log('Join response:', response);
                if (response.success) {
                    roomIdRef.current = response.roomId;
                    setMyPlayerId(response.playerId);
                } else {
                    setJoinError(response.error || 'Failed to join game');
                    setHasSelectedDeck(false); // Go back to deck selection
                }
            });
        };

        const onConnect = () => {
            console.log('Connected to Game Socket:', socket.id);
            setupGame();
        };

        const onGameStateUpdate = (state) => {
            console.log('Game State Update:', state);
            setGameState(state);
            setIsLoading(false);
        };

        const onGameOver = ({ finalState }) => {
            console.log('Game Over!', finalState);
            setFinalGameState(finalState); // Store for modal
            setIsGameSummaryOpen(true);
        };

        const onConnectError = (err) => {
            console.error('Socket Connection Error:', err);
            setJoinError('Connection error. Retrying...');
        };

        socket.on('connect', onConnect);
        socket.on('game-state-update', onGameStateUpdate);
        socket.on('game-over', onGameOver);
        socket.on('connect_error', onConnectError);

        // If already connected, trigger setup immediately
        if (socket.connected) {
            onConnect();
        }

        // Cleanup
        return () => {
            socket.off('connect', onConnect);
            socket.off('game-state-update', onGameStateUpdate);
            socket.off('game-over', onGameOver);
            socket.off('connect_error', onConnectError);
            if (socket) socket.disconnect();
            socket = null; // Clear singleton
        };
    }, [pin, isHost, userProfile, navigate, hasSelectedDeck, selectedDeckId]);

    // Handlers
    const handleLifeChange = (change) => {
        if (!socket || !gameState || !myPlayerId || !roomIdRef.current) return;

        // Optimistic Update
        setGameState(prev => {
            const newPlayers = prev.players.map(p =>
                p.id === myPlayerId ? { ...p, life: p.life + change } : p
            );
            return { ...prev, players: newPlayers };
        });

        socket.emit('update-life', {
            roomId: roomIdRef.current,
            change: change
        });
    };

    const handleCounterChange = (type, value) => {
        const myPlayer = gameState.players.find(p => p.id === myPlayerId);
        const change = value - (myPlayer.counters[type] || 0);
        socket.emit('update-counters', { roomId: roomIdRef.current, type, change });
    };

    const handleCmdDamageChange = (targetId, value) => {
        const myPlayer = gameState.players.find(p => p.id === myPlayerId);
        const current = myPlayer.commanderDamage[targetId] || 0;
        const change = value - current;
        socket.emit('update-commander-damage', { roomId: roomIdRef.current, targetId, change });
    };

    const handleEndGame = () => {
        if (!socket || !roomIdRef.current) return;
        if (window.confirm('Are you sure you want to end the game for everyone?')) {
            socket.emit('end-game', { roomId: roomIdRef.current });
        }
    };

    const handleSaveGame = async (payload) => {
        // Here we call the API to save the match
        try {
            const data = await api.post('/api/matches', payload);
            if (data.success) {
                alert('Game saved successfully!');
                setIsGameSummaryOpen(false);
                navigate('/play/lobby');
            } else {
                alert('Failed to save game: ' + (data.error || 'Unknown error'));
            }
        } catch (err) {
            console.error(err);
            alert('Error saving game');
        }
    };

    const handleStartGame = (firstPlayerId) => {
        if (!socket || !roomIdRef.current) return;
        socket.emit('start-game', { roomId: roomIdRef.current, firstPlayerId });
    };

    const handlePassTurn = () => {
        if (!socket || !roomIdRef.current) return;
        socket.emit('pass-turn', { roomId: roomIdRef.current });
    };

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-950 text-red-400 font-bold p-4 text-center">
                {error}
                <button
                    onClick={() => navigate('/play/lobby')}
                    className="block mt-4 text-sm text-gray-500 hover:text-white underline mx-auto"
                >
                    Return to Lobby
                </button>
            </div>
        );
    }

    if (joinError) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-950 text-red-400 p-4 text-center">
                <div className="space-y-4">
                    <p className="font-bold">{joinError}</p>
                    <button
                        onClick={() => setJoinError(null)}
                        className="text-sm bg-red-500/10 hover:bg-red-500/20 px-4 py-2 rounded text-red-400"
                    >
                        Try Again
                    </button>
                    <button
                        onClick={() => navigate('/play/lobby')}
                        className="block w-full text-sm text-gray-500 hover:text-white underline"
                    >
                        Return to Lobby
                    </button>
                </div>
            </div>
        );
    }

    // New Deck Selection Screen
    if (!hasSelectedDeck) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 p-4 animate-fade-in">
                <div className="w-full max-w-md space-y-8">
                    <div className="text-center space-y-2">
                        <h2 className="text-3xl font-black text-white uppercase tracking-widest">Select Your Deck</h2>
                        <p className="text-gray-400">Choose a deck to play with for this session.</p>
                    </div>

                    <div className="space-y-4">
                        <select
                            value={selectedDeckId || ''}
                            onChange={(e) => setSelectedDeckId(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-white focus:ring-2 focus:ring-indigo-500 outline-none text-lg"
                        >
                            <option value="">-- Select a Deck --</option>
                            <option value="generic">Generic Deck (No stats)</option>
                            {myDecks.map(deck => (
                                <option key={deck.id} value={deck.id}>
                                    {deck.name} ({typeof deck.commander === 'object' ? deck.commander?.name : (deck.commander || 'No Commander')})
                                </option>
                            ))}
                        </select>

                        <button
                            onClick={() => {
                                if (selectedDeckId) {
                                    setHasSelectedDeck(true);
                                    setIsLoading(true); // Show loading while connecting
                                }
                            }}
                            disabled={!selectedDeckId}
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-lg shadow-lg shadow-indigo-900/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                            <Play className="w-5 h-5 fill-current" />
                            Join Game
                        </button>
                    </div>

                    <div className="text-center">
                        <button
                            onClick={() => navigate('/play/lobby')}
                            className="text-sm text-gray-600 hover:text-gray-400 transition-colors"
                        >
                            Cancel and Return to Lobby
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (isLoading || !gameState) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
                <div className="text-gray-500 text-xs uppercase tracking-widest font-bold">Connecting to War Room...</div>
            </div>
        );
    }

    const myPlayer = gameState.players.find(p => p.id === myPlayerId);
    const opponents = gameState.players.filter(p => p.id !== myPlayerId);

    if (!myPlayer) return null;

    return (
        <div className="flex flex-col h-[100dvh] bg-black overflow-hidden relative touch-none">
            {/* Top Bar: Opponents */}
            <div className="flex-1 bg-gray-900 grid grid-cols-2 gap-px border-b border-gray-800">
                {opponents.length > 0 ? opponents.map(opp => (
                    <div key={opp.id} className={`relative flex flex-col items-center justify-center bg-gray-900 p-2 border group transition-colors duration-500 ${gameState.activePlayerId === opp.id ? 'border-indigo-500 shadow-[inset_0_0_20px_rgba(79,70,229,0.2)]' : 'border-black/20'}`}>
                        <span className="text-gray-500 text-[10px] font-bold uppercase tracking-widest absolute top-2 w-full text-center truncate px-2">{opp.name}</span>
                        <span className="text-4xl font-black text-white/90 mb-2">{opp.life}</span>

                        {/* Opponent Resources */}
                        {renderOpponentCounters(opp)}
                    </div>
                )) : (
                    <div className="col-span-2 flex flex-col items-center justify-center text-gray-600 space-y-2 p-6 text-center">
                        <div className="animate-pulse">Waiting for opponents...</div>
                        <div className="text-xs font-mono bg-white/5 px-2 py-1 rounded">PIN: {pin}</div>
                    </div>
                )}
            </div>

            {/* Middle Info Bar (Turn, PIN) */}
            <div className="h-12 bg-gray-950 shrink-0 flex items-center justify-between px-4 border-y border-white/5 z-20">
                <div className="text-xs font-bold text-gray-500 flex items-center gap-4">
                    <span>PIN: <span className="text-indigo-400 font-mono tracking-widest ml-1">{pin}</span></span>
                    {gameState.turnCount > 0 && (
                        <span className="bg-white/10 px-2 py-0.5 rounded text-gray-300">Turn {gameState.turnCount}</span>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    {/* End Game Button (Host Only) */}
                    {isHost && (
                        <button
                            onClick={handleEndGame}
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[10px] uppercase font-bold px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors border border-red-500/20"
                        >
                            <Flag className="w-3 h-3" />
                            End Game
                        </button>
                    )}

                    <button onClick={() => navigate('/play/lobby')} className="text-[10px] uppercase font-bold text-gray-600 hover:text-white transition-colors">
                        Leave
                    </button>
                </div>
            </div>

            {/* Bottom Bar: My Stats */}
            <div className={`flex-[2] bg-gray-950 relative group transition-all duration-500 ${gameState.activePlayerId === myPlayerId ? 'shadow-[inset_0_0_30px_rgba(79,70,229,0.15)] border-t-2 border-indigo-500' : ''}`}>
                <LifeCounter
                    life={myPlayer.life}
                    isSelf={true}
                    label={myPlayer.name}
                    onChange={handleLifeChange}
                />

                {/* Resources Button */}
                <button
                    onClick={() => setIsResourcesOpen(true)}
                    className="absolute top-6 right-6 w-10 h-10 bg-gray-800 hover:bg-gray-700 rounded-full flex items-center justify-center border border-white/10 shadow-lg z-20 transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="M12 2v20" /><path d="M2 12h20" /><path d="m4.93 4.93 14.14 14.14" /><path d="m19.07 4.93-14.14 14.14" /></svg>
                </button>
            </div>

            <ResourcesModal
                isOpen={isResourcesOpen}
                onClose={() => setIsResourcesOpen(false)}
                players={gameState.players}
                myPlayerId={myPlayerId}
                myCounters={myPlayer.counters}
                myCommanderDamage={myPlayer.commanderDamage}
                onUpdateCounter={handleCounterChange}
                onUpdateCmdDamage={handleCmdDamageChange}
            />

            {/* Start Game Overlay (Turn 0) */}
            {gameState.turnCount === 0 && (
                <div className="absolute inset-0 z-40 bg-black/90 flex flex-col items-center justify-center p-6 space-y-6">
                    <div className="text-center space-y-2">
                        <h2 className="text-3xl font-black text-white tracking-widest uppercase">Prepare for Battle</h2>
                        <p className="text-gray-400">Waiting for {isHost ? 'you to start' : 'host to start'}...</p>
                        <div className="pt-2">
                            <div className="inline-block bg-white/10 rounded px-4 py-2 border border-white/20">
                                <span className="text-gray-400 text-xs font-bold uppercase tracking-widest mr-2">Session PIN</span>
                                <span className="text-2xl font-mono font-bold text-indigo-400 tracking-widest">{pin}</span>
                            </div>
                        </div>
                    </div>

                    {isHost && (
                        <div className="w-full max-w-sm space-y-4">
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider text-center">
                                Who goes first?
                            </label>
                            <div className="grid gap-2">
                                {gameState.players.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => handleStartGame(p.id)}
                                        className="w-full p-4 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-indigo-500 text-left rounded-xl transition-all flex items-center justify-between group"
                                    >
                                        <span className="font-bold text-gray-200 group-hover:text-white">{p.name}</span>
                                        <Play className="w-4 h-4 text-gray-600 group-hover:text-indigo-400" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Active Turn Overlay / Button */}
            {gameState.turnCount > 0 && gameState.activePlayerId === myPlayerId && (
                <div className="absolute bottom-32 md:bottom-24 left-1/2 -translate-x-1/2 z-50 animate-bounce-message">
                    <button
                        onClick={handlePassTurn}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-full font-bold shadow-lg shadow-indigo-900/50 flex items-center gap-2 transition-transform active:scale-95 border-2 border-indigo-400/50"
                    >
                        <SkipForward className="w-5 h-5" />
                        Pass Turn
                    </button>
                </div>
            )}

            <GameSummaryModal
                isOpen={isGameSummaryOpen}
                onClose={() => setIsGameSummaryOpen(false)}
                finalState={finalGameState}
                onSave={handleSaveGame}
                roomId={roomIdRef.current}
            />
        </div>
    );
};

export default GameRoom;
