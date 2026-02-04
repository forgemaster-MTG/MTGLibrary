import React from 'react';
import { STATIC_STORE_ITEMS } from '../data/storeItems';

const StoreSection = () => {
    const affiliateTag = 'mtgsite-20';
    const items = STATIC_STORE_ITEMS;

    return (
        <section className="relative py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
            {/* Section Header */}
            <div className="text-center mb-16">
                <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-4">
                    Official <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-500">Recommended Gear</span>
                </h2>
                <p className="text-gray-400 max-w-2xl mx-auto text-lg">
                    Upgrade your arsenal with our curated selection of top-tier Magic accessories.
                </p>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {items.map((item, idx) => (
                    <a
                        key={idx}
                        href={item.directUrl || `https://www.amazon.com/s?k=${encodeURIComponent(item.query)}&tag=${affiliateTag}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`group relative p-6 rounded-3xl border ${item.border} ${item.bg} backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:bg-gray-800/80 hover:border-white/20 hover:shadow-2xl hover:shadow-${item.color.split('-')[1]}-500/10 flex flex-col justify-between h-full`}
                    >
                        <div>
                            <div className={`w-12 h-12 rounded-xl ${item.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                                <item.icon className={`w-7 h-7 ${item.color}`} strokeWidth={2} />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2 group-hover:text-orange-400 transition-colors">
                                {item.title}
                            </h3>
                            <p className="text-sm text-gray-400 font-medium mb-6 leading-relaxed">
                                {item.desc}
                            </p>
                        </div>

                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500 group-hover:text-white transition-colors">
                            <span>Browse Amazon</span>
                            <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                            </svg>
                        </div>
                    </a>
                ))}
            </div>

            <div className="mt-12 text-center">
                <p className="text-xs text-gray-600">
                    As an Amazon Associate we earn from qualifying purchases. This helps support MTG Forge server costs.
                </p>
            </div>
        </section>
    );
};

export default StoreSection;
