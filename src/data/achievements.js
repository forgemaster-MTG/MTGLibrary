
import {
    Box, Trophy, DollarSign, Star, Zap, Crown,
    Shield, Target, Layers, Book, Search, Briefcase,
    Flame, Droplets, Mountain, Skull, Leaf, Asterisk,
    Scroll, Sword, Landmark, Sparkles
} from 'lucide-react';

// Categories for filtering
export const ACHIEVEMENT_CATEGORIES = {
    COLLECTION: { id: 'collection', label: 'Collection', icon: Box },
    WEALTH: { id: 'wealth', label: 'Wealth', icon: DollarSign },
    MASTERY: { id: 'mastery', label: 'Mastery', icon: Crown },
    DEDICATION: { id: 'dedication', label: 'Dedication', icon: Trophy },
    AUDIT: { id: 'audit', label: 'Audit', icon: Search },
    COLORS: { id: 'colors', label: 'Colors', icon: Layers },
    TYPES: { id: 'types', label: 'Types', icon: Book },
    ONBOARDING: { id: 'onboarding', label: 'Onboarding', icon: Sparkles }
};

export const ACHIEVEMENTS = [
    // --- ONBOARDING (New) ---
    { id: 'ai_setup', title: 'Technical Alliance', description: 'Configure your Personal AI Companion.', metric: 'ai_setup_complete', target: 1, xp: 150, category: 'onboarding', icon: Zap },
    { id: 'onboarding_done', title: 'Planeswalker Spark', description: 'Complete the Forge onboarding process.', metric: 'onboarding_finished', target: 1, xp: 100, category: 'onboarding', icon: Flame },

    // --- COLLECTION COUNT MILESTONES ---
    { id: 'col_count_1', title: 'Starter Deck', description: 'Collect your first 60 cards.', metric: 'total_cards', target: 60, xp: 50, category: 'collection' },
    { id: 'col_count_2', title: 'Binder Filler', description: 'Collect 500 cards.', metric: 'total_cards', target: 500, xp: 150, category: 'collection' },
    { id: 'col_count_3', title: 'Library Builder', description: 'Collect 1,000 cards.', metric: 'total_cards', target: 1000, xp: 300, category: 'collection' },
    { id: 'col_count_4', title: 'Hoarder', description: 'Collect 5,000 cards.', metric: 'total_cards', target: 5000, xp: 1000, category: 'collection' },
    { id: 'col_count_5', title: 'Dragon\'s Hoard', description: 'Collect 10,000 cards.', metric: 'total_cards', target: 10000, xp: 2500, category: 'collection' },

    // --- WEALTH MILESTONES ---
    { id: 'val_1', title: 'Pocket Change', description: 'Collection value exceeds $100.', metric: 'total_value', target: 100, xp: 50, category: 'wealth' },
    { id: 'val_2', title: 'Investment Portfolio', description: 'Collection value exceeds $1,000.', metric: 'total_value', target: 1000, xp: 250, category: 'wealth' },
    { id: 'val_3', title: 'High Roller', description: 'Collection value exceeds $5,000.', metric: 'total_value', target: 5000, xp: 1000, category: 'wealth' },
    { id: 'val_4', title: 'Black Lotus Status', description: 'Collection value exceeds $10,000.', metric: 'total_value', target: 10000, xp: 2500, category: 'wealth' },

    // --- FOIL COLLECTING ---
    { id: 'foil_1', title: 'Shiny!', description: 'Collect 10 Foil cards.', metric: 'foil_count', target: 10, xp: 50, category: 'collection' },
    { id: 'foil_2', title: 'Magpie', description: 'Collect 100 Foil cards.', metric: 'foil_count', target: 100, xp: 200, category: 'collection' },
    { id: 'foil_3', title: 'Chrome Plated', description: 'Collect 500 Foil cards.', metric: 'foil_count', target: 500, xp: 1000, category: 'collection' },

    // --- AUDITING ---
    { id: 'audit_1', title: 'Bean Counter', description: 'Complete your first Audit.', metric: 'audits_completed', target: 1, xp: 100, category: 'audit' },
    { id: 'audit_streak_1', title: 'Inventory Manager', description: 'Complete 5 Audits.', metric: 'audits_completed', target: 5, xp: 500, category: 'audit' },
    { id: 'audit_perfect', title: 'Perfectionist', description: 'Complete an audit with 100% accuracy (min 50 cards).', metric: 'perfect_audits', target: 1, xp: 300, category: 'audit' },

    // --- DECK BUILDING ---
    { id: 'deck_1', title: 'Brewery Open', description: 'Create 1 Deck.', metric: 'decks_created', target: 1, xp: 50, category: 'mastery' },
    { id: 'deck_5', title: 'Decksmith', description: 'Create 5 Decks.', metric: 'decks_created', target: 5, xp: 200, category: 'mastery' },
    { id: 'deck_10', title: 'Grand Architect', description: 'Create 10 Decks.', metric: 'decks_created', target: 10, xp: 500, category: 'mastery' },

    // --- COLOR MASTERY (New) ---
    // Requires 'count_white', 'count_blue' etc metrics from backend or calculated on FE
    { id: 'color_w_1', title: 'Plains Walker', description: 'Collect 50 White cards.', metric: 'count_white', target: 50, xp: 50, category: 'colors', icon: Star },
    { id: 'color_w_2', title: 'Order of the White', description: 'Collect 200 White cards.', metric: 'count_white', target: 200, xp: 200, category: 'colors', icon: Star },

    { id: 'color_u_1', title: 'Island Hopper', description: 'Collect 50 Blue cards.', metric: 'count_blue', target: 50, xp: 50, category: 'colors', icon: Droplets },
    { id: 'color_u_2', title: 'Mind Mage', description: 'Collect 200 Blue cards.', metric: 'count_blue', target: 200, xp: 200, category: 'colors', icon: Droplets },

    { id: 'color_b_1', title: 'Swamp Thing', description: 'Collect 50 Black cards.', metric: 'count_black', target: 50, xp: 50, category: 'colors', icon: Skull },
    { id: 'color_b_2', title: 'Necromancer', description: 'Collect 200 Black cards.', metric: 'count_black', target: 200, xp: 200, category: 'colors', icon: Skull },

    { id: 'color_r_1', title: 'Mountain Climber', description: 'Collect 50 Red cards.', metric: 'count_red', target: 50, xp: 50, category: 'colors', icon: Flame },
    { id: 'color_r_2', title: 'Pyromancer', description: 'Collect 200 Red cards.', metric: 'count_red', target: 200, xp: 200, category: 'colors', icon: Flame },

    { id: 'color_g_1', title: 'Forest Ranger', description: 'Collect 50 Green cards.', metric: 'count_green', target: 50, xp: 50, category: 'colors', icon: Leaf },
    { id: 'color_g_2', title: 'Force of Nature', description: 'Collect 200 Green cards.', metric: 'count_green', target: 200, xp: 200, category: 'colors', icon: Leaf },

    // --- TYPE MASTERY (New) ---
    { id: 'type_creature_1', title: 'Beast Master', description: 'Collect 100 Creatures.', metric: 'count_creature', target: 100, xp: 100, category: 'types' },
    { id: 'type_sorcery_1', title: 'Spell Slinger', description: 'Collect 50 Instants or Sorceries.', metric: 'count_spell', target: 50, xp: 75, category: 'types' },
    { id: 'type_artifact_1', title: 'Artificer', description: 'Collect 50 Artifacts.', metric: 'count_artifact', target: 50, xp: 75, category: 'types' },
    { id: 'type_land_1', title: 'Real Estate Mogul', description: 'Collect 100 Non-Basic Lands.', metric: 'count_land_special', target: 100, xp: 150, category: 'types' },

    // --- RARITY ---
    { id: 'rarity_mythic_1', title: 'Mythic Hunter', description: 'Collect 20 Mythic Rares.', metric: 'count_mythic', target: 20, xp: 250, category: 'collection' },

    // --- SPECIAL ---
    { id: 'early_adopter', title: 'Pioneer', description: 'Joined during the Alpha/Beta phase.', metric: 'account_age_days', target: 1, xp: 100, category: 'dedication' }
];
