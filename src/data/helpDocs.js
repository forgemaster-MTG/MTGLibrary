export const HELP_DOCS = {
    '/dashboard': {
        title: "Dashboard Guide",
        subtitle: "Your command center in MTG Forge.",
        icon: "🏠",
        color: "indigo",
        sections: [
            {
                type: 'text',
                title: "Overview",
                content: "The Dashboard provides a high-level view of your collection, recent activity, and quick actions. It's fully customizable to fit your workflow."
            },
            {
                type: 'grid',
                title: "Key Widgets",
                items: [
                    { title: "Quick Actions", desc: "Shortcuts to create decks or scan cards.", icon: "⚡" },
                    { title: "Stats", desc: "Summary of collection size and value.", icon: "📊" },
                    { title: "Recent Decks", desc: "Quick access to your latest brews.", icon: "⚔️" },
                    { title: "Identity", desc: "Color distribution of your cards.", icon: "🎨" }
                ]
            },
            {
                type: 'text',
                title: "Customization",
                content: "Click the **Customize** toggle to enter Edit Mode. You can drag to rearrange, use handles to resize, and add new widgets from the sidebar. You can also save and share your custom layouts."
            }
        ],
        tips: [
            { icon: "💡", title: "Troubleshooting", text: "If widgets feel stuck, try refreshing the page. Most layout issues are resolved by a quick reload." }
        ],
        footer: { text: "Start Customizing" }
    },

    '/collection': {
        title: "Collection Manager",
        subtitle: "Manage your entire card inventory.",
        icon: "📚",
        color: "blue",
        sections: [
            {
                type: 'grid',
                title: "View Modes",
                items: [
                    { title: "Grid", desc: "Visual display of card art.", icon: "🖼️" },
                    { title: "Table", desc: "Data list for easy sorting.", icon: "📋" },
                    { title: "Folders", desc: "Organize by Color, Set, or Binder.", icon: "📁" }
                ]
            },
            {
                type: 'text',
                title: "Features",
                content: "Use the search bar for names, or click **Filters** to drill down by Color, Rarity, Type, and Set. You can sort by Price, CMC, and Date Added."
            },
            {
                type: 'text',
                title: "Bulk Actions",
                content: "Enter **Select** mode to perform actions on multiple cards at once: Delete, Move to Binder, Add to Deck, or Export to a list."
            }
        ],
        tips: [
            { icon: "📸", title: "Forge Lens", text: "Click the camera icon to scan physical cards directly into your collection using your webcam." },
            { icon: "💰", title: "Live Prices", text: "Sync Prices updates your entire collection value based on the latest Scryfall market data." }
        ],
        footer: { text: "Manage Collection" }
    },

    '/decks': {
        title: "Decks & Binders",
        subtitle: "Your library of strategies and trades.",
        icon: "⚔️",
        color: "purple",
        sections: [
            {
                type: 'grid',
                title: "Organization",
                items: [
                    { title: "Decks", desc: "Your constructed strategies.", icon: "⚔️" },
                    { title: "Binders", desc: "Trade stock and collections.", icon: "📁" },
                    { title: "Folders", desc: "Group by format or theme.", icon: "📂" }
                ]
            },
            {
                type: 'text',
                title: "Creation",
                content: "Start a fresh deck from scratch, or **Import** a decklist from Arena, Moxfield, or TappedOut by pasting the text list."
            }
        ],
        tips: [
            { icon: "✨", title: "Mockup Mode", text: "Decks marked as 'Mockup' don't count towards your collection stats—perfect for brewing with cards you don't own yet." }
        ],
        footer: { text: "Browse Decks" }
    },

    '/decks/new': {
        title: "Deck Architect",
        subtitle: "Craft your perfect 99.",
        icon: "🛠️",
        color: "emerald",
        sections: [
            {
                type: 'text',
                title: "Workflow",
                content: "1. **Choose Commander**: Pick your leader to define identity.\n2. **Select Strategy**: Pick a theme (e.g., Aristocrats, Voltron).\n3. **Build**: Use the AI Companion for suggestions based on your theme."
            },
            {
                type: 'grid',
                title: "AI Tools",
                items: [
                    { title: "Suggestions", desc: "Cards categorized by role.", icon: "🤖" },
                    { title: "Synergy", desc: "Hidden gems from your binder.", icon: "✨" },
                    { title: "Deck Doctor", desc: "Fix curve or synergy issues.", icon: "🏥" }
                ]
            }
        ],
        tips: [
            { icon: "🧪", title: "Solitaire", text: "Use the Solitaire tool to test your draws and opening hands before taking the deck to the table." }
        ],
        footer: { text: "Start Brewing" }
    },

    '/binders': {
        title: "Binder Management",
        subtitle: "Organize your collection like a pro.",
        icon: "📁",
        color: "indigo",
        sections: [
            {
                type: 'grid',
                title: "Two Ways to Build",
                items: [
                    { title: "Manual", desc: "Drag and drop specific cards.", icon: "📂" },
                    { title: "Smart", desc: "Set rules for automatic updates.", icon: "✨" }
                ]
            },
            {
                type: 'text',
                title: "AI Smart Creator",
                content: "Just describe what you want: 'All my red goblins over $5' or 'Cards to trade that I have duplicates of'. The AI handles the logic."
            }
        ],
        tips: [
            { icon: "🎨", title: "Custom Style", text: "Change colors and pick from hundreds of icons to make your binders easily identifiable." }
        ],
        footer: { text: "Open Binders" }
    },

    '/social': {
        title: "Pods & Sharing",
        subtitle: "Connect with your playgroup.",
        icon: "🤝",
        color: "rose",
        sections: [
            {
                type: 'text',
                title: "What is a Pod?",
                content: "A Pod represents your list of Trusted Connections. Linking accounts allows you to share digital resources and track group stats."
            },
            {
                type: 'grid',
                title: "Permissions",
                items: [
                    { title: "Viewer", desc: "Can see decks and collection.", icon: "👁️" },
                    { title: "Editor", desc: "Can help brew and add cards.", icon: "✍️" }
                ]
            },
            {
                type: 'text',
                title: "Shared Collections",
                content: "In the Deck Builder, you can view cards from your friends' collections to brew Team Decks or borrow cards."
            }
        ],
        tips: [
            { icon: "🛡️", title: "Safety First", text: "Only add people you actually trust to your Pod. You can revoke access at any time." }
        ],
        footer: { text: "Connect with Friends" }
    },

    '/sets': {
        title: "Sets Explorer",
        subtitle: "Browse any MTG expansion.",
        icon: "🧭",
        color: "blue",
        sections: [
            {
                type: 'text',
                title: "Global Search",
                content: "Find sets by name (e.g., 'Throne of Eldraine') or code (e.g., 'ELD'). Filter by Main Sets, Commander, Secret Lair, and more."
            },
            {
                type: 'text',
                title: "Analytics",
                content: "Click a set to view its full card list, total value, and your completion percentage for that specific set."
            }
        ],
        tips: [
            { icon: "🎯", title: "Tracking", text: "Completion stats help you identify missing cards if you're aiming to complete a full set collection." }
        ],
        footer: { text: "Explore Sets" }
    },

    '/wishlist': {
        title: "Wishlist Guide",
        subtitle: "Track cards you need to acquire.",
        icon: "💖",
        color: "pink",
        sections: [
            {
                type: 'text',
                title: "Management",
                content: "Add cards from anywhere via the global search. You can filter by price or type to prioritize your next purchases."
            },
            {
                type: 'text',
                title: "Budgeting",
                content: "Use the total value indicator to estimate the cost of your current wishlist."
            }
        ],
        tips: [
            { icon: "⚖️", title: "Theorycraft", text: "Enable Theorycraft Mode in the Deck Builder to include cards from your wishlist in your deck lists." }
        ],
        footer: { text: "View Wishlist" }
    },

    '/audit': {
        title: "Collection Audit",
        subtitle: "Verify your physical inventory.",
        icon: "🛡️",
        color: "emerald",
        sections: [
            {
                type: 'text',
                title: "Verification Flow",
                content: "1. **Start Audit**: Choose a scope (Collection, Binder, or Box).\n2. **Review**: Mark cards as **Found** or **Missing**.\n3. **Sync**: Automatically update your digital records to match."
            },
            {
                type: 'grid',
                title: "Quick Actions",
                items: [
                    { title: "Match", desc: "Confirms physical count.", icon: "✅" },
                    { title: "Mismatch", desc: "Flags discrepancy for fix.", icon: "❌" }
                ]
            }
        ],
        tips: [
            { icon: "📱", title: "Mobile Use", text: "The Audit Wizard is optimized for phones. perfect for carrying to your bulk boxes for scanning!" }
        ],
        footer: { text: "Start Audit" }
    },

    'forge-lens': {
        title: "Forge Lens AI",
        subtitle: "AI-powered card recognition.",
        icon: "📸",
        color: "indigo",
        sections: [
            {
                type: 'text',
                title: "How to Use",
                content: "1. **Open Scanner**: Click the camera icon.\n2. **Position**: Hold device steady over card in good light.\n3. **Scan**: AI detects name and set automatically."
            },
            {
                type: 'image',
                title: "Perfect Alignment",
                src: "/images/forge-lens-tip.png",
                caption: "The AI looks specifically for the set code (e.g. MH2) and collector number in the bottom left for 100% accuracy."
            },
            {
                type: 'grid',
                title: "Best Results",
                items: [
                    { title: "Lighting", desc: "Bright, even light.", icon: "☀️" },
                    { title: "Background", desc: "Dark & contrasting.", icon: "⬛" },
                    { title: "Sleeves", desc: "Clear sleeves are best.", icon: "📄" }
                ]
            }
        ],
        tips: [
            { icon: "⚡", title: "Speed", text: "Once you see the pop up showing you added the correct card, you can just keep scanning!" }
        ],
        footer: { text: "Launch Forge Lens" }
    },

    '/precons': {
        title: "Precon Discovery",
        subtitle: "Explore and upgrade ready-to-play decks.",
        icon: "📦",
        color: "rose",
        sections: [
            {
                type: 'text',
                title: "Browse & Search",
                content: "Discover every Preconstructed deck released by Wizards of the Coast. Filter by **Set**, **Type** (Commander, Challenger, etc.), or use the search for specific names."
            },
            {
                type: 'grid',
                title: "Features",
                items: [
                    { title: "Decklists", desc: "View full original lists.", icon: "📋" },
                    { title: "Price Check", desc: "Real-time value analysis.", icon: "💰" },
                    { title: "Clone & Edit", desc: "Upgrade your own copy.", icon: "🛠️" }
                ]
            }
        ],
        tips: [
            { icon: "🚀", title: "Upgrading", text: "Click 'Add to Collection' or 'Add to Wishlist' on any precon to start making your own upgrades with AI assistance." }
        ],
        footer: { text: "Browse Precons" }
    },

    '/strategy': {
        title: "Strategy AI",
        subtitle: "Deep meta analysis and brewing tips.",
        icon: "🧠",
        color: "violet",
        sections: [
            {
                type: 'text',
                title: "Meta View",
                content: "Scan the current meta across multiple formats. The AI analyzes thousands of top-performing decks to identify trends, key staples, and power shifts."
            },
            {
                type: 'grid',
                title: "Tools",
                items: [
                    { title: "Deck Analysis", desc: "Scan your brews for weaknesses.", icon: "🔬" },
                    { title: "Archetope", desc: "Explore winning archetypes.", icon: "🏔️" },
                    { title: "Price Alerts", desc: "Watch for meta spikes.", icon: "🔔" }
                ]
            }
        ],
        tips: [
            { icon: "🤖", title: "Personalized", text: "The Strategy AI learns your playstyle. The more decks you build, the better it gets at suggesting cards that fit your 'vibe'." }
        ],
        footer: { text: "Explore Meta" }
    },

    '/play': {
        title: "Live Sessions",
        subtitle: "Play Magic with friends in real-time.",
        icon: "🃏",
        color: "emerald",
        sections: [
            {
                type: 'text',
                title: "Lobby & PINs",
                content: "The Lobby is where you create or join live game sessions. Every session has a unique **6-digit PIN**. Share this with your friends for them to join your table instantly."
            },
            {
                type: 'grid',
                title: "Battlefield Tools",
                items: [
                    { title: "Life Tracker", desc: "Real-time sync for life totals.", icon: "❤️" },
                    { title: "Counters", desc: "Track Poison, Energy, and more.", icon: "💀" },
                    { title: "Command Damage", desc: "Built-in commander tracking.", icon: "⚔️" },
                    { title: "Pass Turn", desc: "Easily signal turn changes.", icon: "⏭️" }
                ]
            }
        ],
        tips: [
            { icon: "↩️", title: "Oops Window", text: "Made a mistake? You have a 5-second window to **Undo** any life or counter change before it's finalized in the log." },
            { icon: "📝", title: "Game Notes", text: "Click the message icon to add notes like 'Board Wipe' or 'Cast Commander' to the shared session log." }
        ],
        footer: { text: "Enter Lobby" }
    },

    '/armory': {
        title: "The Armory",
        subtitle: "Trade and manage your physical stock.",
        icon: "🛡️",
        color: "amber",
        sections: [
            {
                type: 'text',
                title: "Trade Dashboard",
                content: "The Armory is your hub for physical trades. Track what you're offering and what you're looking for, and find matches within your Pod."
            },
            {
                type: 'grid',
                title: "Tracking",
                items: [
                    { title: "Haves", desc: "Cards you're willing to trade.", icon: "📤" },
                    { title: "Wants", desc: "Cards you're looking for.", icon: "📥" },
                    { title: "Matches", desc: "Automatic trade suggestions.", icon: "✨" }
                ]
            }
        ],
        tips: [
            { icon: "🤝", title: "Trust", text: "Physical trades are managed between players. Forge helps find matches, but you handle the shipping and handoffs!" }
        ],
        footer: { text: "Open Armory" }
    },

    '/tournaments': {
        title: "Tournaments",
        subtitle: "Compete for glory and prizes.",
        icon: "🏆",
        color: "rose",
        sections: [
            {
                type: 'text',
                title: "Organized Play",
                content: "Join community-run tournaments or host your own. The system handles pairings, standings, and decklist verification automatically."
            },
            {
                type: 'grid',
                title: "Structure",
                items: [
                    { title: "Swiss", desc: "Fair pairings for all rounds.", icon: "⚖️" },
                    { title: "Cut to Top 8", desc: "Elimination finals.", icon: "🔪" },
                    { title: "Prizes", desc: "Claim your rewards.", icon: "🎁" }
                ]
            }
        ],
        tips: [
            { icon: "📅", title: "Schedule", text: "Check the tournament calendar regularly for upcoming Qualifiers and Open events. **COMING SOON**" }
        ],
        footer: { text: "Browse Events" }
    }
};

export const getPageDoc = (path) => {
    // Exact match
    if (HELP_DOCS[path]) return HELP_DOCS[path];

    // Dynamic Routes
    if (path.startsWith('/decks/') && !path.endsWith('/new')) return {
        title: "Deck Details",
        subtitle: "Manage a specific strategy.",
        icon: "⚔️",
        color: "indigo",
        sections: [
            {
                type: 'text',
                title: "Command Center",
                content: "Manage card lists, view stats, and optimize strategy. Flip cards per view, or enter **Selection** mode for bulk removals."
            },
            {
                type: 'grid',
                title: "Analyzer",
                items: [
                    { title: "Power Level", desc: "Estimated deck strength.", icon: "⚡" },
                    { title: "Mana Curve", desc: "Cost distribution.", icon: "📉" },
                    { title: "Identity", desc: "Color and theme analysis.", icon: "🧬" }
                ]
            }
        ],
        tips: [
            { icon: "⚙️", title: "Settings", text: "You can change deck visibility, format, and cover art from the Settings tab within the deck view." }
        ],
        footer: { text: "Back to Decks" }
    };

    if (path.startsWith('/audit')) return HELP_DOCS['/audit'];
    if (path.startsWith('/binders')) return HELP_DOCS['/binders'];
    if (path.startsWith('/sets/')) return {
        title: "Set Analytics",
        subtitle: "Deep dive into an expansion.",
        icon: "🧭",
        color: "blue",
        sections: [
            {
                type: 'grid',
                title: "View Items",
                items: [
                    { title: "Full List", desc: "Every card in the set.", icon: "📋" },
                    { title: "Value", desc: "Current market analytics.", icon: "💰" },
                    { title: "Completion", desc: "Your collection progress.", icon: "🏆" }
                ]
            }
        ],
        tips: [
            { icon: "🎲", title: "Draft Sim", text: "Simulate booster drafts for this set to practice your limited skills (available for major sets)." }
        ],
        footer: { text: "Browse Sets" }
    };

    // Default fallback
    return {
        title: "General Help",
        subtitle: "How can we help you today?",
        icon: "🛟",
        color: "indigo",
        sections: [
            {
                type: 'text',
                title: "Welcome",
                content: "I am here to help you navigate MTG Forge. You can explore guides for collection management, deck building, and more."
            }
        ],
        tips: [
            { icon: "🤖", title: "AI Assistant", text: "If you can't find what you need, use the AI Helper to ask specific questions about the app." }
        ],
        footer: { text: "Close Help" }
    };
};
