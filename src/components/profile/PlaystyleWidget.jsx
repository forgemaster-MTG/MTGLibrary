import React from 'react';

const PlaystyleWidget = ({ playstyle, isOwnProfile, onRetake }) => {
    if (!playstyle) {
        if (isOwnProfile) {
            return (
                <div className="bg-gray-800 rounded-2xl p-8 border border-gray-700/50 text-center space-y-4">
                    <h2 className="text-xl font-bold text-white">Discover Your Playstyle</h2>
                    <p className="text-gray-400 max-w-lg mx-auto">
                        Take the magical identity assessment to uncover your archetypes and get personalized recommendations.
                    </p>
                    <button
                        onClick={onRetake}
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shadow-lg hover:shadow-indigo-500/25 transition-all"
                    >
                        Start Assessment
                    </button>
                </div>
            );
        }
        return null;
    }

    const { summary, tags, scores, archetypes } = playstyle;

    return (
        <div className="bg-gray-800 rounded-2xl border border-gray-700/50 overflow-hidden flex flex-col md:flex-row">
            {/* Sidebar like section for High Level Tags */}
            <div className="w-full md:w-64 bg-gray-800/80 p-6 border-b md:border-b-0 md:border-r border-gray-700 flex flex-col items-center text-center">
                <h2 className="text-xl font-bold text-white mb-4">Playstyle</h2>

                <div className="flex flex-wrap justify-center gap-2 mb-6">
                    {tags && tags.map((tag, i) => (
                        <span key={i} className="px-3 py-1 bg-indigo-500/20 text-indigo-300 text-xs font-bold uppercase rounded-full border border-indigo-500/30">
                            {tag}
                        </span>
                    ))}
                </div>

                {isOwnProfile && (
                    <button
                        onClick={onRetake}
                        className="mt-auto text-xs text-gray-500 hover:text-white underline"
                    >
                        Retake Assessment
                    </button>
                )}
            </div>

            {/* Main Content */}
            <div className="flex-1 p-6 md:p-8 space-y-6">

                {/* Summary */}
                <div className="relative">
                    <div className="absolute top-0 bottom-0 left-0 w-1 bg-indigo-500 rounded-full"></div>
                    <p className="pl-4 text-gray-300 italic font-serif leading-relaxed text-lg">
                        "{summary}"
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Psychographic Profile */}
                    <div>
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Psychographic Profile</h3>
                        <div className="space-y-3">
                            {scores && Object.entries(scores).map(([key, value]) => (
                                <div key={key}>
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="text-gray-400 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                        <span className="text-white font-mono">{value}/100</span>
                                    </div>
                                    <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full ${getValueColor(value)}`}
                                            style={{ width: `${value}%` }}
                                        ></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Recommended Archetypes */}
                    <div>
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Affinity Archetypes</h3>
                        <div className="flex flex-col gap-2">
                            {archetypes && archetypes.map((arch, i) => (
                                <div key={i} className="bg-gray-900/50 px-4 py-3 rounded-lg border border-gray-700/50 flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]"></div>
                                    <span className="text-gray-200 text-sm font-medium">{arch}</span>
                                </div>
                            ))}
                        </div>
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

export default PlaystyleWidget;
