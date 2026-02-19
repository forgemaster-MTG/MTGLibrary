import React, { useState, useMemo } from 'react';
import { TableVirtuoso } from 'react-virtuoso';
import LazyImage from './common/LazyImage';

const CollectionTable = ({ cards, isMixed }) => {
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

    const sortedCards = useMemo(() => {
        let sortableItems = [...cards];
        if (sortConfig.key) {
            sortableItems.sort((a, b) => {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];

                // Special handling for nested or complex fields
                if (sortConfig.key === 'price') {
                    aValue = parseFloat(a.prices?.usd || 0);
                    bValue = parseFloat(b.prices?.usd || 0);
                } else if (sortConfig.key === 'type') {
                    aValue = a.type_line || '';
                    bValue = b.type_line || '';
                } else if (sortConfig.key === 'set') {
                    aValue = a.set_name || '';
                    bValue = b.set_name || '';
                }

                if (aValue < bValue) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [cards, sortConfig]);

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIndicator = (name) => {
        if (sortConfig.key !== name) return <svg className="w-3 h-3 text-gray-700 opacity-0 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>;
        return sortConfig.direction === 'asc'
            ? <svg className="w-3 h-3 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
            : <svg className="w-3 h-3 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>;
    };

    const HeaderCell = ({ label, sortKey, className = "" }) => (
        <th
            className={`px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer group hover:text-white transition-colors select-none bg-gray-900 border-b border-gray-800 ${className}`}
            onClick={() => requestSort(sortKey)}
        >
            <div className="flex items-center gap-2">
                {label}
                {getSortIndicator(sortKey)}
            </div>
        </th>
    );

    return (
        <div className="h-[calc(100vh-300px)] w-full bg-gray-950/40 rounded-2xl overflow-hidden border border-white/5 backdrop-blur-md">
            <TableVirtuoso
                data={sortedCards}
                components={{
                    Table: (props) => <table {...props} className="w-full min-w-[1000px] border-collapse" />,
                    TableRow: (props) => <tr {...props} className="group hover:bg-gray-800/30 transition-colors border-b border-gray-800/50" />
                }}
                fixedHeaderContent={() => (
                    <tr className="bg-gray-900">
                        <HeaderCell label="Card Name" sortKey="name" />
                        <HeaderCell label="Set" sortKey="set" />
                        <HeaderCell label="Type" sortKey="type" />
                        <HeaderCell label="Rarity" sortKey="rarity" />
                        <HeaderCell label="Market Price" sortKey="price" />
                        <HeaderCell label="Paid" sortKey="price_bought" />
                        {isMixed && <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-900 border-b border-gray-800">Owner</th>}
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-900 border-b border-gray-800">Tags</th>
                    </tr>
                )}
                itemContent={(index, card) => (
                    <>
                        <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                                <div className="h-10 w-10 flex-shrink-0 relative rounded overflow-hidden mr-4 border border-gray-700 bg-gray-900 group-hover:scale-150 group-hover:z-10 transition-all origin-left">
                                    <LazyImage
                                        src={card.image_uri || card.image_uris?.small}
                                        alt=""
                                        className="h-full w-full object-cover"
                                        placeholder={<div className="w-full h-full bg-gray-800 animate-pulse" />}
                                    />
                                </div>
                                <div className="ml-0">
                                    <div className="text-sm font-bold text-white group-hover:text-primary-300 transition-colors">{card.name}</div>
                                    <div className="text-xs text-gray-500 font-mono">x{card.count}</div>
                                </div>
                            </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-800 text-gray-300 border border-gray-700">
                                <svg className="mr-1.5 h-3 w-3 text-primary-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zm0 9l2.5-1.25L12 8.5l-2.5 1.25L12 11zm0 2.5l-5-2.5-5 2.5L12 22l10-8.5-5-2.5-5 2.5z" /></svg>
                                {card.set_name}
                            </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 truncate max-w-[200px]" title={card.type_line}>
                            {card.type_line}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`
                                    inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide
                                    ${card.rarity === 'mythic' ? 'text-orange-400 bg-orange-900/10 border border-orange-500/20' :
                                    card.rarity === 'rare' ? 'text-yellow-400 bg-yellow-900/10 border border-yellow-500/20' :
                                        card.rarity === 'uncommon' ? 'text-blue-400 bg-blue-900/10 border border-blue-500/20' :
                                            'text-gray-400 bg-gray-800 border border-gray-700'}
                                `}>
                                {card.rarity}
                            </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-green-400 font-mono">
                            ${parseFloat(card.prices?.usd || 0).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 font-mono">
                            {card.price_bought ? `$${parseFloat(card.price_bought).toFixed(2)}` : '-'}
                        </td>
                        {isMixed && (
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-2" title={card.owner_username}>
                                    <div className="w-6 h-6 rounded-full bg-primary-600 flex items-center justify-center text-white text-[10px] font-bold">
                                        {card.owner_username ? card.owner_username[0].toUpperCase() : '?'}
                                    </div>
                                    <span className="text-xs text-gray-400 truncate max-w-[80px]">{card.owner_username}</span>
                                </div>
                            </td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-wrap gap-1">
                                {(card.tags && typeof card.tags === 'string' ? JSON.parse(card.tags) : (card.tags || [])).map((tag, i) => (
                                    <span key={i} className="px-2 py-0.5 rounded text-[10px] bg-primary-500/20 text-primary-300 border border-primary-500/30">
                                        {tag}
                                    </span>
                                ))}
                                {(!card.tags || (Array.isArray(card.tags) && card.tags.length === 0)) && (
                                    <span className="text-gray-600 text-xs italic">No tags</span>
                                )}
                            </div>
                        </td>
                    </>
                )}
            />
        </div>
    );
};

export default CollectionTable;
