import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { ExternalLink, Tag } from 'lucide-react';

const LatestReleasesSection = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const data = await api.getFeaturedProducts();
                setProducts(data);
            } catch (err) {
                console.error("Failed to load featured products:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchProducts();
    }, []);

    if (loading) return null; // Or a skeleton loader
    if (products.length === 0) return null;

    return (
        <section className="relative py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-gray-800/50">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                        New Arrivals & <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">Pre-Orders</span>
                    </h2>
                    <p className="text-gray-400 text-sm mt-1">
                        Secure the latest sealed product releases.
                    </p>
                </div>
            </div>

            {/* Horizontal Scroll Container */}
            <div className="flex gap-6 overflow-x-auto pb-8 scrollbar-hide snap-x snap-mandatory">
                {products.map((product) => (
                    <a
                        key={product.id}
                        href={product.link_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group relative flex-none w-[280px] snap-center"
                    >
                        {/* Card */}
                        <div className="relative bg-gray-900/50 rounded-2xl border border-gray-800 overflow-hidden hover:border-purple-500/30 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-900/20 group-hover:-translate-y-1">
                            {/* Image Aspect Ratio Wrapper (Tall for boxes) */}
                            <div className="aspect-[3/4] relative overflow-hidden bg-gray-950">
                                <img
                                    src={product.image_url}
                                    alt={product.title}
                                    className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                                />
                                {/* Category Badge */}
                                <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm border border-white/10 px-2 py-1 rounded-md flex items-center gap-1.5">
                                    <Tag className="w-3 h-3 text-purple-400" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-white">
                                        {product.category}
                                    </span>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-5">
                                <h3 className="text-base font-bold text-white mb-1 line-clamp-2 min-h-[3rem] group-hover:text-purple-400 transition-colors">
                                    {product.title}
                                </h3>

                                <div className="flex items-end justify-between mt-4">
                                    <div className="flex flex-col">
                                        <span className="text-xs text-gray-500">Price</span>
                                        <span className="text-lg font-bold text-white">{product.price_label || 'Check Amazon'}</span>
                                    </div>

                                    <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white shadow-lg group-hover:bg-purple-500 transition-colors">
                                        <ExternalLink className="w-5 h-5" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </a>
                ))}
            </div>
        </section>
    );
};

export default LatestReleasesSection;
