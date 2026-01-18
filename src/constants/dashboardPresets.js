
export const DEFAULT_WIDGET_SIZES = {
    'stats_value': 'xs',
    'stats_total': 'xs',
    'stats_decks': 'xs',
    'audit': 'xs',
    'action_browse': 'xs',
    'action_wishlist': 'xs',
    'identity': 'small',
    'quick_actions': 'small',
    'community': 'medium',
    'action_new_deck': 'xs',
    'action_add_cards': 'xs',
    'action_tournaments': 'xs',
    'system_status': 'small',
    'subscription': 'small',
    'social_stats': 'small',
    'trade_matches': 'small',
    'tips': 'small',
    'guides': 'small',
    'recent_decks': 'large',
    'releases': 'large'
};

// Simplified: All widgets in ONE grid zone for free-form placement
export const DEFAULT_LAYOUT = {
    grid: [
        'stats_value', 'stats_total', 'stats_decks', 'audit', 'quick_actions', 'identity',
        'recent_decks', 'releases', 'community',
        'action_new_deck', 'action_add_cards', 'action_browse', 'action_wishlist', 'action_tournaments',
        'system_status', 'subscription', 'social_stats', 'trade_matches', 'tips', 'guides'
    ]
};

export const DEFAULT_PRESETS = {
    'Default': {
        layout: DEFAULT_LAYOUT,
        sizes: DEFAULT_WIDGET_SIZES
    },
    'Decks Focused': {
        layout: {
            grid: [
                'action_new_deck', 'action_add_cards', 'action_tournaments', 'stats_decks', 'quick_actions', 'identity',
                'recent_decks', 'community', 'releases',
                'stats_value', 'stats_total', 'audit', 'action_browse', 'action_wishlist',
                'system_status', 'subscription', 'social_stats', 'tips', 'guides'
            ]
        },
        sizes: {
            ...DEFAULT_WIDGET_SIZES,
            'action_new_deck': 'small',
            'action_add_cards': 'small',
            'action_tournaments': 'small',
            'recent_decks': 'xlarge',
            'community': 'large'
        }
    },
    'Collector': {
        layout: {
            grid: ["stats_value", "stats_total", "audit", "action_browse", "action_wishlist", "identity", "recent_decks", "releases", "community", "action_new_deck", "action_add_cards", "action_tournaments", "stats_decks", "quick_actions", "system_status", "subscription", "tips", "guides", "action_log", "trade_matches"]
        },
        sizes: {
            ...DEFAULT_WIDGET_SIZES,
            "tips": "small", "audit": "xs", "guides": "small", "identity": "xs", "releases": "xlarge", "community": "medium", "stats_decks": "xs", "stats_total": "xs", "stats_value": "xlarge", "recent_decks": "medium", "social_stats": "small", "subscription": "small", "action_browse": "xs", "quick_actions": "small", "system_status": "small", "trade_matches": "small", "action_new_deck": "xs", "action_wishlist": "xs", "action_add_cards": "xs", "action_tournaments": "xs"
        }
    }
};
