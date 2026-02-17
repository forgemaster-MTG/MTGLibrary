import React from 'react';



const GuidesWidget = ({ size, actions }) => {
    const { setShowBinderGuide, setShowPodGuide, setShowAuditGuide } = actions;


    const isXS = size === 'xs';
    const isSmall = size === 'small';
    const isLarge = size === 'large';
    const isXL = size === 'xlarge';
    const isLargePlus = isLarge || isXL;
    
    const handleOpenGuide = (guideId) => {
        window.dispatchEvent(new CustomEvent('open-help-center', { detail: { guide: guideId } }));
    }

    if (isXS) {
        return (
            <div
                onClick={() => handleOpenGuide('/binders')}
                className="bg-blue-900/10 border border-blue-500/20 rounded-3xl h-full flex items-center justify-center cursor-pointer hover:bg-blue-500/20 transition-all group"
            >
                <svg className="w-6 h-6 text-blue-400 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            </div>
        );
    }

    const items = [
        { title: "Smart Binders", desc: "Automate your collection logic", icon: "✨", color: "indigo", progress: 80, onClick: () => handleOpenGuide('/binders') },
        { title: "Pods & Sharing", desc: "Manage permissions & social", icon: "🤝", color: "purple", progress: 40, onClick: () => handleOpenGuide('/social') },
        { title: "Verification", desc: "Maintain inventory accuracy", icon: "🛡️", color: "green", progress: 0, onClick: () => handleOpenGuide('/audit') },
    ];

    return (
        <div className={`bg-gray-900/40 border border-white/5 rounded-3xl ${isSmall ? 'p-4' : 'p-6'} backdrop-blur-md h-full flex flex-col group relative overflow-hidden`}>
            <div className="flex justify-between items-center mb-4 relative z-10">
                <h2 className="font-black text-white flex items-center gap-2 uppercase tracking-widest text-[10px]">
                    <span className="p-1.5 bg-blue-500/10 rounded-lg text-blue-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.247 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                    </span>
                    Learning Center
                </h2>
                {isXL && <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">Community Knowledge Base</span>}
            </div>

            <div className={`flex-grow relative z-10 ${isLargePlus ? 'grid grid-cols-3 gap-4' : isSmall ? 'grid grid-cols-3 gap-2' : 'grid grid-cols-3 gap-3'}`}>
                {items.map((item, i) => {
                    const isMedium = !isSmall && !isLargePlus;
                    return (
                        <button
                            key={i}
                            onClick={item.onClick}
                            className={`w-full text-left ${isSmall || isMedium ? 'p-2' : 'p-4'} rounded-2xl bg-gray-950/40 hover:bg-gray-800 border border-white/5 hover:border-${item.color}-500/30 transition-all group/item flex ${isXL ? 'flex-col justify-between' : isSmall || isMedium ? 'flex-col items-center justify-center text-center' : 'items-center'} gap-3 h-full`}
                        >
                            <div className={`flex ${isSmall || isMedium ? 'flex-col' : ''} items-center ${isSmall || isMedium ? 'gap-1' : 'gap-3'}`}>
                                <div className={`${isSmall || isMedium ? 'p-1.5' : 'p-2'} bg-${item.color}-500/10 rounded-xl ${isSmall ? 'text-base' : isMedium ? 'text-lg' : 'text-xl'} group-hover/item:scale-110 transition-transform`}>
                                    {item.icon}
                                </div>
                                <div className="block text-center">
                                    <div className={`${isSmall || isMedium ? 'text-[10px] leading-tight' : 'text-xs'} font-black text-gray-200 group-hover/item:text-white uppercase tracking-wide`}>
                                        {isSmall ? (
                                            // Short labels for small size
                                            i === 0 ? 'Binders' : i === 1 ? 'Pods' : 'Audit'
                                        ) : isMedium ? (
                                            // Split titles for medium stacking
                                            <>
                                                {item.title.split(' ').map((word, idx) => (
                                                    <span key={idx} className="block">{word}</span>
                                                ))}
                                            </>
                                        ) : item.title}
                                    </div>
                                    {isLargePlus && !isXL && <div className="text-[9px] text-gray-500 font-bold mt-0.5 line-clamp-1">{item.desc}</div>}
                                </div>
                            </div>

                            {isXL && (
                                <div className="mt-4 w-full">
                                    <div className="text-[9px] text-gray-500 font-bold uppercase mb-2 line-clamp-2 leading-relaxed">{item.desc}</div>
                                    <div className="flex justify-between items-center mb-1 text-[9px] font-mono">
                                        <span className="text-gray-600 uppercase">Progress</span>
                                        <span className={`text-${item.color}-400`}>{item.progress}%</span>
                                    </div>
                                    <div className="w-full bg-gray-900 rounded-full h-1 overflow-hidden">
                                        <div className={`h-full bg-${item.color}-500 transition-all duration-1000 delay-${i * 100}`} style={{ width: `${item.progress}%` }} />
                                    </div>
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {!isLargePlus && !isSmall && (
                <button
                    onClick={() => setShowBinderGuide(true)}
                    className="mt-4 text-[10px] font-black text-blue-400 hover:text-blue-300 uppercase tracking-widest flex items-center gap-1 justify-center relative z-10 group/all"
                >
                    View All Resources <svg className="w-3 h-3 group-hover/all:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
            )}

            {/* Subtle Gradient background on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-blue-500/5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-700" />
        </div>
    );
};

export default GuidesWidget;
