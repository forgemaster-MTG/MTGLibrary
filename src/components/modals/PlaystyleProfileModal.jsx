import React from 'react';

const PlaystyleProfileModal = ({ isOpen, onClose, profile, onRetake }) => {
    if (!isOpen) return null;

    // Empty State (No Profile)
    if (!profile) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
                <div className="relative w-full max-w-md bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col p-8 text-center space-y-6">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-gray-400 hover:text-white z-10 p-2 bg-black/20 rounded-full hover:bg-black/40 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>

                    <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mx-auto">
                        <svg className="w-10 h-10 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>

                    <div>
                        <h2 className="text-2xl font-bold text-white mb-2">No Playstyle Found</h2>
                        <p className="text-gray-400 text-sm">
                            You haven't taken the assessment yet. Discover your magical identity and get better recommendations!
                        </p>
                    </div>

                    <button
                        onClick={onRetake}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-6 rounded-lg shadow-lg hover:shadow-indigo-500/25 transition-all transform hover:-translate-y-0.5"
                    >
                        Start Assessment
                    </button>
                </div>
            </div>
        );
    }

    const { summary, tags, scores, archetypes } = profile;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="relative w-full max-w-4xl bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white z-10 p-2 bg-black/20 rounded-full hover:bg-black/40 transition-colors"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>

                <div className="flex flex-col md:flex-row h-full">
                    {/* Sidebar / Header */}
                    <div className="w-full md:w-1/3 bg-gray-800/50 p-8 border-b md:border-b-0 md:border-r border-gray-700 flex flex-col items-center text-center">
                        <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg mb-6 ring-4 ring-gray-800">
                            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">Your Playstyle</h2>
                        <div className="flex flex-wrap justify-center gap-2 mb-6">
                            {tags && tags.map((tag, i) => (
                                <span key={i} className="px-3 py-1 bg-indigo-500/20 text-indigo-300 text-xs font-bold uppercase rounded-full border border-indigo-500/30">
                                    {tag}
                                </span>
                            ))}
                        </div>
                        <button
                            onClick={onRetake}
                            className="mt-auto w-full py-3 px-4 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg text-sm font-bold transition-all border border-gray-600 hover:border-gray-500"
                        >
                            Retake Assessment
                        </button>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 p-8 overflow-y-auto space-y-8">
                        {/* Summary */}
                        <section>
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Analysis Summary</h3>
                            <p className="text-gray-300 leading-relaxed text-lg font-serif italic border-l-4 border-indigo-500 pl-4 bg-gray-800/30 py-2 pr-2 rounded-r">
                                "{summary}"
                            </p>
                        </section>

                        {/* Scores Radar/Bars */}
                        <section>
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Psychographic Profile</h3>
                            <div className="space-y-4">
                                {scores && Object.entries(scores).map(([key, value]) => (
                                    <div key={key}>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-gray-400 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                            <span className="text-white font-mono">{value}/100</span>
                                        </div>
                                        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${getValueColor(value)}`}
                                                style={{ width: `${value}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* Archetypes */}
                        <section>
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Recommended Archetypes</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {archetypes && archetypes.map((arch, i) => (
                                    <div key={i} className="bg-gray-800/80 p-4 rounded-lg border border-gray-700 flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]"></div>
                                        <span className="text-gray-200 font-medium">{arch}</span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
};

function getValueColor(val) {
    if (val > 75) return 'bg-green-500';
    if (val > 50) return 'bg-blue-500';
    if (val > 25) return 'bg-yellow-500';
    return 'bg-red-500';
}

export default PlaystyleProfileModal;
