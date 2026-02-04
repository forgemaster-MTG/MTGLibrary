import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { STATIC_STORE_ITEMS } from '../data/storeItems';
import { Search, ShoppingBag, ExternalLink } from 'lucide-react';

const ProductsPage = () => {
    const [featured, setFeatured] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');

    useEffect(() => {
        const loadData = async () => {
            try {
                const data = await api.getFeaturedProducts();
                setFeatured(data);
            } catch (err) {
                console.error("Failed to load featured products:", err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    const normalizedFeatured = featured.map(item => ({
        id: `featured-${item.id}`,
        title: item.title,
        image: item.image_url,
        url: item.link_url,
        // Ensure consistent casing/naming if needed, or rely on API
        category: item.category || 'Sealed',
        price: item.price_label,
        isFeatured: true,
        description: "Latest Release"
    }));

    const normalizedStatic = STATIC_STORE_ITEMS.map(item => ({
        id: item.id,
        title: item.title,
        icon: item.icon,
        url: item.directUrl || `https://www.amazon.com/s?k=${encodeURIComponent(item.query)}&tag=mtgsite-20`,
        category: 'Accessories', // Explicitly group these as Accessories
        price: null,
        isFeatured: false,
        description: item.desc,
        color: item.color,
        bg: item.bg,
        border: item.border
    }));

    const allProducts = [...normalizedFeatured, ...normalizedStatic];

    // Dynamically derive categories from distinct values in logic + generic fallbacks
    // We prioritize specific order: Sealed, Commander, Bundle, Accessories
    // Then any others found in the data.
    const knownCategories = ['Sealed', 'Commander', 'Bundle'];
    const dataCategories = [...new Set(normalizedFeatured.map(p => p.category))].filter(c => !knownCategories.includes(c));
    // Accessories is manually added to the filter list, but handled separately in render
    const categories = ['All', ...knownCategories, ...dataCategories, 'Accessories'];

    // Filter Logic
    const getFilteredProducts = () => {
        return allProducts.filter(item => {
            const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.description?.toLowerCase().includes(searchQuery.toLowerCase());

            let matchesCategory = true;
            if (selectedCategory !== 'All') {
                if (selectedCategory === 'Accessories') {
                    // Catch variations like "Accessory" if they exist
                    matchesCategory = item.category.toLowerCase().includes('access') || item.category === 'Accessories';
                } else {
                    matchesCategory = item.category === selectedCategory;
                }
            }

            return matchesSearch && matchesCategory;
        });
    };

    const filteredProducts = getFilteredProducts();

    // 1. Dynamic Item Card (Matches User Screenshot)
    const renderFeaturedCard = (item) => (
        <a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`
                group relative flex flex-col h-full bg-[#0B0C15] rounded-3xl border border-gray-800/60 
                overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:border-gray-700
            `}
        >
            {/* Image Area - Top Half with Fade */}
            <div className="relative w-full aspect-[4/3] bg-[#13141f] overflow-hidden">
                <img
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />

                {/* Gradient Fade to Content */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0B0C15] via-transparent to-transparent opacity-90" />

                {/* Badge */}
                <div className="absolute top-4 left-4 bg-[#a82dfc] text-white text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-wider shadow-lg shadow-purple-900/40">
                    New Arrival
                </div>
            </div>

            {/* Content Area */}
            <div className="px-5 pb-6 pt-2 flex-1 flex flex-col justify-between relative z-10">
                <div>
                    <h3 className="text-xl font-black text-white mb-1 leading-tight">
                        {item.title}
                    </h3>
                    <p className="text-sm text-gray-400 font-medium">
                        Latest Release
                    </p>
                </div>

                <div className="flex items-end justify-between mt-auto pt-6 border-t border-gray-800/50">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Price</span>
                        <span className="text-xl font-black text-white">{item.price}</span>
                    </div>

                    <div className="w-10 h-10 rounded-full bg-gray-800/80 border border-gray-700 flex items-center justify-center text-gray-400 group-hover:bg-white group-hover:text-black transition-all">
                        <ExternalLink className="w-5 h-5" />
                    </div>
                </div>
            </div>
        </a>
    );

    // 2. Static Item Card (Tile Based - Matches Home Page)
    const renderStaticCard = (item) => (
        <a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`
                group relative p-6 rounded-3xl border ${item.border} ${item.bg} backdrop-blur-sm 
                transition-all duration-300 hover:scale-105 hover:bg-gray-800/80 hover:border-white/20 
                hover:shadow-2xl flex flex-col justify-between h-full min-h-[300px]
            `}
        >
            <div>
                <div className={`w-12 h-12 rounded-xl ${item.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform border border-white/5`}>
                    <item.icon className={`w-7 h-7 ${item.color}`} strokeWidth={2} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-amber-400 transition-colors">
                    {item.title}
                </h3>
                <p className="text-sm text-gray-400 font-medium mb-6 leading-relaxed">
                    {item.description}
                </p>
            </div>

            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500 group-hover:text-white transition-colors">
                <span>Browse Amazon</span>
                <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
            </div>
        </a>
    );

    const renderEmptyState = () => (
        <div className="text-center py-24 bg-gray-900/40 rounded-3xl border border-gray-800 backdrop-blur-sm">
            <ShoppingBag className="w-16 h-16 text-gray-700 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-300">No products found for "{searchQuery}"</h3>
            <p className="text-gray-500 mb-8">Try adjusting your filters or search terms.</p>

            <a
                href={`https://www.amazon.com/s?k=${encodeURIComponent(searchQuery || 'magic the gathering')}&tag=mtgsite-20`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-amber-900/20"
            >
                Search Amazon Instead <ExternalLink className="w-4 h-4" />
            </a>
        </div>
    );

    const renderContent = () => {
        if (loading) {
            return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                        <div key={i} className="h-96 bg-gray-900/50 rounded-2xl border border-gray-800"></div>
                    ))}
                </div>
            );
        }

        // If filtering/searching, show flat grid
        if (searchQuery || selectedCategory !== 'All') {
            if (filteredProducts.length === 0) return renderEmptyState();

            return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {filteredProducts.map(item =>
                        item.isFeatured ? renderFeaturedCard(item) : renderStaticCard(item)
                    )}
                </div>
            );
        }

        // Default "All" View - Grouped by CATEGORY
        // Main Sections: Everything EXCEPT Accessories (which are handled by static items essentially)
        const mainCategories = categories.filter(c => c !== 'All' && c !== 'Accessories');

        return (
            <div className="space-y-24">
                {/* Main Dynamic Sections */}
                {mainCategories.map(category => {
                    const categoryItems = normalizedFeatured.filter(p => p.category === category);
                    if (categoryItems.length === 0) return null;

                    return (
                        <section key={category}>
                            <div className="flex items-center gap-3 mb-8">
                                <h2 className="text-2xl font-black text-white flex items-center gap-2">
                                    <span className="text-indigo-400">
                                        {category === 'Sealed' ? '📦' :
                                            category === 'Commander' ? '⚔️' : '✨'}
                                    </span>
                                    {category}
                                </h2>
                                <div className="h-px bg-gray-800 flex-1"></div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                {categoryItems.map(item => renderFeaturedCard(item))}
                            </div>
                        </section>
                    );
                })}

                {/* Bottom Section: Accessories / Affiliate Links */}
                {/* This corresponds to the static "Recommended Gear" items */}
                <section className="pt-8 border-t border-gray-800">
                    <div className="text-center mb-10">
                        <h2 className="text-3xl font-black text-white mb-2">Looking for other items?</h2>
                        <p className="text-gray-400">Check out our recommended gear and accessories on Amazon.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {normalizedStatic.map(renderStaticCard)}
                    </div>
                </section>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-950 relative">
            {/* Background Image - Fixed to viewport */}
            <div className="fixed inset-0 z-0 select-none pointer-events-none">
                <img
                    src="/MTG-Forge_Logo_Background.png"
                    alt=""
                    className="w-full h-full object-cover opacity-30 filter blur-[2px]"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-gray-950/0 via-gray-950/60 to-gray-950" />
            </div>

            <div className="relative z-10 pt-20 pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
                {/* Header */}
                <div className="text-center mb-16">
                    <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter mb-6 drop-shadow-2xl">
                        OFFICIAL <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">STORE</span>
                    </h1>
                    <p className="text-gray-300 text-xl max-w-2xl mx-auto leading-relaxed border-l-4 border-indigo-500 pl-6 text-left md:text-center md:border-none md:pl-0">
                        Browse our curated selection of sealed product, commander decks, and essential accessories.
                    </p>
                </div>

                {/* Controls */}
                <div className="sticky top-20 z-30 bg-gray-950/70 backdrop-blur-xl py-4 mb-12 border-y border-white/5 shadow-2xl">
                    <div className="flex flex-col md:flex-row gap-4 justify-between items-center max-w-7xl mx-auto px-4">
                        {/* Search */}
                        <div className="relative w-full md:w-96 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-indigo-400 transition-colors" />
                            <input
                                type="text"
                                placeholder="Search the store..."
                                className="w-full bg-gray-900/50 border border-gray-700 rounded-2xl pl-12 pr-4 py-3 text-white focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all placeholder-gray-600"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        {/* Categories */}
                        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto scrollbar-hide">
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`
                                        px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all border
                                        ${selectedCategory === cat
                                            ? 'bg-indigo-600 text-white border-indigo-400 shadow-[0_0_20px_rgba(79,70,229,0.3)]'
                                            : 'bg-gray-800/50 text-gray-400 border-gray-700 hover:bg-gray-700 hover:text-white hover:border-gray-600'}
                                    `}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {renderContent()}

            </div>
        </div>
    );
};

export default ProductsPage;
