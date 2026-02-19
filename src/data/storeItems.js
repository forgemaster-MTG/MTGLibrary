import { Layers, Box, Square, Dices, BookOpen, Warehouse, Scroll, Shield } from 'lucide-react';

export const STATIC_STORE_ITEMS = [
    {
        id: 'playmats',
        title: "Pro Playmats",
        icon: Layers,
        desc: "High-quality surfaces for smooth gameplay and card protection.",
        query: "magic the gathering playmat",
        directUrl: "https://amzn.to/4qT3NiV",
        color: "text-primary-400",
        bg: "bg-primary-500/10",
        border: "border-primary-500/20",
        category: "accessory"
    },
    {
        id: 'deckboxes',
        title: "Deck Boxes",
        icon: Box,
        desc: "Secure storage for your Commander and constructed decks.",
        query: "mtg deck box",
        directUrl: "https://amzn.to/3ZlhoU3",
        color: "text-orange-400",
        bg: "bg-orange-500/10",
        border: "border-orange-500/20",
        category: "accessory"
    },
    {
        id: 'sleeves',
        title: "Card Sleeves",
        icon: Square,
        desc: "Essential protection against wear, shuffle after shuffle.",
        query: "mtg card sleeves",
        directUrl: "https://amzn.to/4tdR3Ff",
        color: "text-blue-400",
        bg: "bg-blue-500/10",
        border: "border-blue-500/20",
        category: "accessory"
    },
    {
        id: 'dice',
        title: "Dice & Counters",
        icon: Dices,
        desc: "Track life totals, +1/+1 counters, and loyalty with style.",
        query: "mtg dice set",
        directUrl: "https://amzn.to/4aiYrXj", // Specific SiteStripe link
        color: "text-purple-400",
        bg: "bg-purple-500/10",
        border: "border-purple-500/20",
        category: "accessory"
    },
    {
        id: 'binders',
        title: "Premium Binders",
        icon: BookOpen,
        desc: "Showcase your valuable trades and collection highlights.",
        query: "mtg card binder",
        directUrl: "https://amzn.to/3LRVmFv",
        color: "text-emerald-400",
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/20",
        category: "accessory"
    },
    {
        id: 'storage',
        title: "Bulk Storage",
        icon: Warehouse,
        desc: "Organize thousands of cards with heavy-duty storage solutions.",
        query: "mtg card storage box",
        directUrl: "https://amzn.to/4qgRyLO",
        color: "text-slate-400",
        bg: "bg-slate-500/10",
        border: "border-slate-500/20",
        category: "accessory"
    },
    {
        id: 'tubes',
        title: "Mat Cases",
        icon: Scroll,
        desc: "Keep your playmat clean and crisp during travel.",
        query: "playmat tube",
        directUrl: "https://amzn.to/4acMFgN",
        color: "text-cyan-400",
        bg: "bg-cyan-500/10",
        border: "border-cyan-500/20",
        category: "accessory"
    },
    {
        id: 'inners',
        title: "Inner Sleeves",
        icon: Shield,
        desc: "Double-sleeve for maximum protection of foils and rares.",
        query: "mtg inner sleeves",
        directUrl: "https://amzn.to/4qliJoS",
        color: "text-rose-400",
        bg: "bg-rose-500/10",
        border: "border-rose-500/20",
        category: "accessory"
    }
];
