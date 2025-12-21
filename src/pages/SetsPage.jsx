import React, { useState, useMemo } from 'react';
import { useSets } from '../hooks/useSets';
import { Link, useNavigate } from 'react-router-dom';

const SetsPage = () => {
    const { sets, loading, error } = useSets();
    const [searchTerm, setSearchTerm] = useState('');
    const navigate = useNavigate();

    // Grouping Logic
    const groupedSets = useMemo(() => {
        if (!sets) return {};

        const groups = {
            'Expansion': [],
            'Core': [],
            'Commander': [],
            'Masters': [],
            'Draft Innovation': [],
            'Duel Deck': [],
            'Box Set': [],
            'Other': []
        };

        const typeMapping = {
            'expansion': 'Expansion',
            'core': 'Core',
            'commander': 'Commander',
            'masters': 'Masters',
            'draft_innovation': 'Draft Innovation',
            'duel_deck': 'Duel Deck',
            'box': 'Box Set'
        };

        sets.forEach(set => {
            // Filter by search
            if (searchTerm && !set.name.toLowerCase().includes(searchTerm.toLowerCase()) && !set.code.includes(searchTerm.toLowerCase())) {
                return;
            }

            const groupName = typeMapping[set.set_type] || 'Other';

            // Push to group (create if doesn't exist dynamically? No, strict groups are cleaner for UI)
            if (groups[groupName]) {
                groups[groupName].push(set);
            } else {
                groups['Other'].push(set);
            }
        });

        // Sort inside groups by release date (newest first)
        Object.keys(groups).forEach(key => {
            groups[key].sort((a, b) => new Date(b.released_at) - new Date(a.released_at));
        });

        return groups;
    }, [sets, searchTerm]);

    /* 
     * Handler for clicking a set
     * Ideally, this goes to Collection Page with a filter applied.
     * Since implementation plan suggested linking to Collection, we'll do that via query param or state.
     * For now, standard link, we need to update CollectionPage to read query params later? 
     * Or just use client side state passing if routed via useNavigate state.
     */
    const handleSetClick = (setCode) => {
        // Navigate to dedicated set details page
        navigate(`/sets/${setCode}`);
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center text-red-500 mt-20">Error loading sets: {error.message}</div>
        );
    }

    const sections = ['Expansion', 'Core', 'Commander', 'Masters', 'Draft Innovation', 'Other'];

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <h1 className="text-3xl font-bold text-white">Browse Sets</h1>

                <div className="relative w-full md:w-80">
                    <input
                        type="text"
                        className="block w-full px-4 py-2 border border-gray-700 rounded-lg bg-gray-800 text-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="Search sets..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="space-y-12">
                {sections.map(section => (
                    groupedSets[section] && groupedSets[section].length > 0 && (
                        <div key={section}>
                            <h2 className="text-xl font-bold text-indigo-400 mb-4 border-b border-gray-700 pb-2 flex items-center gap-2">
                                {section}
                                <span className="text-xs text-gray-500 font-normal bg-gray-800 px-2 py-0.5 rounded-full">
                                    {groupedSets[section].length}
                                </span>
                            </h2>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                                {groupedSets[section].map(set => (
                                    <div
                                        key={set.id}
                                        onClick={() => handleSetClick(set.code)}
                                        className="bg-gray-800 p-4 rounded-xl border border-gray-700 hover:border-indigo-500 transition-all hover:bg-gray-750 cursor-pointer group flex flex-col items-center text-center gap-3 relative overflow-hidden"
                                    >
                                        <div className="w-12 h-12 flex items-center justify-center text-gray-400 group-hover:text-white transition-colors">
                                            {set.icon_svg_uri ? (
                                                <img src={set.icon_svg_uri} alt={set.name} className="w-8 h-8 filter invert opacity-70 group-hover:opacity-100 transition-opacity" />
                                            ) : (
                                                <span className="text-lg font-bold">{set.code.toUpperCase()}</span>
                                            )}
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-gray-200 group-hover:text-white leading-tight">{set.name}</h3>
                                            <p className="text-xs text-gray-500 mt-1">{set.released_at?.split('-')[0]} • {set.card_count} cards</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                ))}
            </div>
        </div>
    );
};

export default SetsPage;
