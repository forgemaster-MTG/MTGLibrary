import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { tradeService } from '../services/TradeService';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { Dialog } from '@headlessui/react';
import CreateTradeModal from '../components/Trades/CreateTradeModal';

const TradeDashboard = () => {
    const { currentUser, userProfile } = useAuth();
    const navigate = useNavigate();

    const [searchParams] = useSearchParams();

    const [activeTab, setActiveTab] = useState('active'); // active, history, armory
    const [trades, setTrades] = useState([]);
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [preselectedPartner, setPreselectedPartner] = useState(null);

    useEffect(() => {
        const partnerId = searchParams.get('partner');
        if (partnerId) {
            setPreselectedPartner(partnerId);
            setIsCreateModalOpen(true);
        }
    }, [searchParams]);

    useEffect(() => {
        if (!userProfile?.id) return;
        fetchData();
    }, [userProfile, activeTab]);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            if (activeTab === 'armory') {
                const results = await tradeService.findMatches(userProfile.id);
                setMatches(results);
            } else {
                const allTrades = await tradeService.getTrades();
                setTrades(allTrades);
            }
        } catch (err) {
            console.error("Fetch error:", err);
            setError("Failed to load data.");
        } finally {
            setLoading(false);
        }
    };

    const activeTrades = trades.filter(t => ['pending', 'accepted'].includes(t.status));
    const historyTrades = trades.filter(t => ['completed', 'rejected', 'cancelled'].includes(t.status));

    const renderTradeList = (list) => {
        if (list.length === 0) return <div className="text-gray-500 text-center py-10">No trades found.</div>;

        return (
            <div className="grid gap-4">
                {list.map(trade => (
                    <div
                        key={trade.id}
                        onClick={() => navigate(`/trades/${trade.id}`)}
                        className="bg-gray-800 border border-gray-700 hover:border-indigo-500 p-4 rounded-xl cursor-pointer transition-all flex justify-between items-center"
                    >
                        <div>
                            <div className="font-bold text-white">
                                {trade.is_initiator ? `Outgoing to ${trade.receiver_name}` : `Incoming from ${trade.initiator_name}`}
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                                Last updated: {new Date(trade.updated_at || trade.created_at).toLocaleDateString()}
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${trade.status === 'pending' ? 'bg-yellow-500/20 text-yellow-500' :
                                trade.status === 'accepted' ? 'bg-blue-500/20 text-blue-500' :
                                    trade.status === 'completed' ? 'bg-green-500/20 text-green-500' :
                                        'bg-red-500/20 text-red-500'
                                }`}>
                                {trade.status}
                            </span>
                            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in text-gray-200">
            <CreateTradeModal
                isOpen={isCreateModalOpen}
                onClose={() => { setIsCreateModalOpen(false); setPreselectedPartner(null); }}
                onCreated={() => { fetchData(); setActiveTab('active'); }}
                preselectedPartnerId={preselectedPartner}
            />

            {/* Share Modal */}
            <Dialog open={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} className="relative z-50">
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" aria-hidden="true" />
                <div className="fixed inset-0 flex items-center justify-center p-4">
                    <Dialog.Panel className="w-full max-w-sm rounded-2xl bg-gray-900 border border-gray-700 p-6 shadow-2xl flex flex-col items-center text-center">
                        <Dialog.Title className="text-xl font-bold text-white mb-2">Trade Request Code</Dialog.Title>
                        <p className="text-gray-400 text-sm mb-6">Ask others to scan this to start a trade with you.</p>

                        <div className="bg-white p-4 rounded-xl mb-6">
                            <QRCode
                                value={`${window.location.origin}/trades?partner=${userProfile?.id}`}
                                size={200}
                            />
                        </div>

                        <div className="w-full bg-gray-800 p-3 rounded-lg flex items-center gap-2 mb-6">
                            <div className="flex-1 truncate text-xs text-gray-500 font-mono">
                                {`${window.location.origin}/trades?partner=${userProfile?.id}`}
                            </div>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(`${window.location.origin}/trades?partner=${userProfile?.id}`);
                                    alert('Link copied!');
                                }}
                                className="text-indigo-400 hover:text-indigo-300"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                            </button>
                        </div>

                        <button onClick={() => setIsShareModalOpen(false)} className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-bold">Close</button>
                    </Dialog.Panel>
                </div>
            </Dialog>

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <span className="p-2 bg-indigo-500/10 rounded-xl">
                            <span className="text-3xl">🤝</span>
                        </span>
                        Trade Hub
                    </h1>
                    <p className="text-gray-400 mt-1 text-sm">Manage your trades and find new matches</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setIsShareModalOpen(true)}
                        className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-indigo-400 px-4 py-2 rounded-lg font-bold flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        Share Code
                    </button>
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg font-bold shadow-lg shadow-indigo-500/20 flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        New Trade
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-700 mb-6">
                <button onClick={() => setActiveTab('active')} className={`pb-3 px-6 text-sm font-bold border-b-2 transition-colors ${activeTab === 'active' ? 'border-indigo-500 text-white' : 'border-transparent text-gray-400 hover:text-white'}`}>
                    Active Trades {activeTrades.length > 0 && <span className="ml-2 px-2 py-0.5 bg-indigo-600 text-white text-[10px] rounded-full">{activeTrades.length}</span>}
                </button>
                <button onClick={() => setActiveTab('history')} className={`pb-3 px-6 text-sm font-bold border-b-2 transition-colors ${activeTab === 'history' ? 'border-indigo-500 text-white' : 'border-transparent text-gray-400 hover:text-white'}`}>
                    History
                </button>
                <button onClick={() => setActiveTab('armory')} className={`pb-3 px-6 text-sm font-bold border-b-2 transition-colors ${activeTab === 'armory' ? 'border-indigo-500 text-white' : 'border-transparent text-gray-400 hover:text-white'}`}>
                    The Armory (Matches)
                </button>
            </div>

            {/* Content */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-24 bg-gray-800 rounded-xl animate-pulse"></div>
                    ))}
                </div>
            ) : error ? (
                <div className="text-red-400 bg-red-900/20 p-4 rounded-lg border border-red-500/30 text-center">{error}</div>
            ) : (
                <>
                    {activeTab === 'active' && renderTradeList(activeTrades)}
                    {activeTab === 'history' && renderTradeList(historyTrades)}
                    {activeTab === 'armory' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {matches.length === 0 ? (
                                <div className="col-span-full text-center py-20 bg-gray-900/50 rounded-2xl border border-gray-800">
                                    <h2 className="text-xl font-bold text-white mb-2">No Matches Found</h2>
                                    <p className="text-gray-400">Update your wishlist or ask friends to update their binders.</p>
                                </div>
                            ) : matches.map((match, idx) => (
                                <div key={`${match.cardId}-${idx}`} className="bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-indigo-500/50 rounded-xl p-4 flex gap-4 transition-all group relative overflow-hidden">
                                    {/* Background accent */}
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>

                                    {/* Card Image */}
                                    <div className="relative w-24 min-w-[6rem] aspect-[2.5/3.5] rounded-lg overflow-hidden shadow-lg border border-black/50">
                                        {match.image ? (
                                            <img src={match.image} alt={match.cardName} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-gray-900 flex items-center justify-center text-xs text-gray-500">No Img</div>
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex flex-col justify-between flex-1 min-w-0 z-10">
                                        <div>
                                            <div className="flex justify-between items-start">
                                                <h3 className="text-lg font-bold text-white truncate">{match.cardName}</h3>
                                            </div>
                                            <div className="text-xs text-indigo-400 font-mono mt-1">{match.set?.toUpperCase()} • {match.finish}</div>

                                            <div className="mt-3 flex items-center gap-2">
                                                <div className="text-xs text-gray-400">Available from:</div>
                                                <Link
                                                    to={`/profile/${match.friendId}`}
                                                    className="px-2 py-0.5 bg-indigo-900/30 text-indigo-300 rounded text-xs font-bold border border-indigo-500/20 hover:bg-indigo-500 hover:text-white transition-colors cursor-pointer"
                                                >
                                                    {match.friendName}
                                                </Link>
                                            </div>
                                            <div className="mt-1 text-xs text-gray-500">Quantity: {match.quantity}</div>
                                        </div>

                                        <button
                                            onClick={async () => {
                                                if (confirm(`Start a trade with ${match.friendName} for ${match.cardName}?`)) {
                                                    try {
                                                        await tradeService.createTrade({
                                                            receiver_id: match.friendId,
                                                            notes: `Automated request for ${match.cardName}`,
                                                            items: [{
                                                                item_type: 'card',
                                                                // We need to resolve the specific card ID from the friend's collection or just pass metadata
                                                                // For now, let's just create the trade shell and adding the item might need specific ID.
                                                                // The match object has generic info. 
                                                                // Ideally API createTrade could handle "find best match" or we ask user to select.
                                                                // For MVP: Just open trade.
                                                            }]
                                                        });
                                                        setActiveTab('active');
                                                        fetchData();
                                                    } catch (e) { alert(e.message); }
                                                }
                                            }}
                                            className="mt-3 w-full py-2 bg-gray-700 hover:bg-indigo-600 text-white text-xs font-bold uppercase rounded-lg transition-colors flex items-center justify-center gap-2"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                                            Request Trade
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default TradeDashboard;
