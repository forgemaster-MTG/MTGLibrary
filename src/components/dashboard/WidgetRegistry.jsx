import React from 'react';
import SubscriptionWidget from './SubscriptionWidget';
import CommunityWidget from './CommunityWidget';
import TipsWidget from './TipsWidget';
import OrganizationWidget from './OrganizationWidget';
import ReleasesWidget from './ReleasesWidget';
import SocialStatsWidget from './SocialStatsWidget';
import AuditDashboardWidget from '../Audit/AuditDashboardWidget';
import ActionLogWidget from './ActionLogWidget';
import TradeMatchWidget from './TradeMatchWidget';

import { TotalCardsWidget, UniqueDecksWidget, CollectionValueWidget } from './StatsWidget';
import IdentityWidget from './IdentityWidget';
import QuickActionsWidget from './QuickActionsWidget';
import SingleActionWidget from './SingleActionWidget';
import RecentDecksWidget from './RecentDecksWidget';
import SystemStatusWidget from './SystemStatusWidget';
import GuidesWidget from './GuidesWidget';

const WIDGETS = {
    'stats_total': {
        title: 'Total Cards',
        component: TotalCardsWidget,
        description: 'Tracking the total volume of your magical collection.',
        sizes: {
            xs: 'A micro-pill showing just the count and a label.',
            small: 'Standard card count widget with icon.',
            medium: 'Detailed count with growth markers.',
            large: 'Full spread of collection statistics.',
            xlarge: 'Deep dive into total counts and distribution.'
        }
    },
    'stats_decks': {
        title: 'Unique Decks',
        component: UniqueDecksWidget,
        description: 'Your strategic fleet of decks currently active.',
        sizes: {
            xs: 'Compact count of distinct decks.',
            small: 'Standard deck counter.',
            medium: 'Show total decks vs archive.',
            large: 'Stats on deck archetypes and colors.',
            xlarge: 'Advanced deck-building analytics.'
        }
    },
    'stats_value': {
        title: 'Collection Value',
        component: CollectionValueWidget,
        description: 'Real-time market value of your entire assortment.',
        sizes: {
            xs: 'Brief dollar amount with high contrast label.',
            small: 'Value widget with currency symbol.',
            medium: 'Display price change trends.',
            large: 'Breakdown of most valuable items.',
            xlarge: 'Historical value charting and top gainers.'
        }
    },
    'identity': {
        title: 'Color Identity',
        component: IdentityWidget,
        description: 'A visual spectrum of your collection colors.',
        sizes: {
            xs: 'Top color pips in a row.',
            small: 'Pips plus name of identity.',
            medium: 'Flavorful breakdown of colors.',
            large: 'Percentage distribution of mana colors.',
            xlarge: 'Deep meta-analysis and signature staples.'
        }
    },
    'quick_actions': {
        title: 'Quick Actions',
        component: QuickActionsWidget,
        description: 'A dashboard hub for your most common tasks.',
        sizes: {
            xs: 'Icon-only vertical stack.',
            small: 'Balanced grid of action buttons.',
            medium: 'Full width icon row.',
            large: 'Detailed actions with shortcuts.',
            xlarge: 'Admin-style toolbelt for your collection.'
        }
    },
    'action_new_deck': {
        title: 'New Deck',
        component: (props) => <SingleActionWidget {...props} actionType="new_deck" />,
        description: 'Initiate a new deck building session.',
        sizes: {
            xs: 'Simple "New" button pill.',
            small: 'Standard action square.',
            medium: 'Stretched action bar.',
            large: 'Action with creative flavor text.'
        }
    },
    'action_add_cards': {
        title: 'Add Cards',
        component: (props) => <SingleActionWidget {...props} actionType="add_cards" />,
        description: 'Quickly add cards to your library.',
        sizes: {
            xs: 'Add icon pill.',
            small: 'Standard action square.',
            medium: 'Stretched action bar.',
            large: 'Action with collection tips.'
        }
    },
    'action_browse': {
        title: 'Browse Sets',
        component: (props) => <SingleActionWidget {...props} actionType="browse_sets" />,
        description: 'Explore card sets and expansions.',
        sizes: {
            xs: 'Search icon pill.',
            small: 'Standard action square.',
            medium: 'Stretched action bar.',
            large: 'Action with latest set spotlight.'
        }
    },
    'action_wishlist': {
        title: 'Wishlist',
        component: (props) => <SingleActionWidget {...props} actionType="wishlist" />,
        description: 'Access your hunting list for new cards.',
        sizes: {
            xs: 'Heart icon pill.',
            small: 'Standard action square.',
            medium: 'Stretched action bar.',
            large: 'Action with total wishlist value.'
        }
    },
    'action_tournaments': {
        title: 'Tournaments',
        component: (props) => <SingleActionWidget {...props} actionType="tournaments" />,
        description: 'Check upcoming events and pairings.',
        sizes: {
            xs: 'Trophy icon pill.',
            small: 'Standard action square.',
            medium: 'Stretched action bar.',
            large: 'Action with active pairings count.'
        }
    },
    'recent_decks': {
        title: 'Recent Decks',
        component: RecentDecksWidget,
        description: 'Quick access to your latest deck projects.',
        sizes: {
            xs: 'Last active deck name.',
            small: 'Commander art for the latest deck.',
            medium: 'Last two decks with color identities.',
            large: 'Triple deck spread with mini-summaries.',
            xlarge: 'Full chronological deck feed.'
        }
    },
    'system_status': {
        title: 'System Status',
        component: SystemStatusWidget,
        description: 'Real-time health pulse of the forge.',
        sizes: {
            xs: 'Simple status dot.',
            small: 'Current uptime percentage.',
            medium: 'Detailed service status.',
            large: 'Full system health dashboard.'
        }
    },
    'subscription': {
        title: 'Subscription',
        component: SubscriptionWidget,
        description: 'Manage your membership and perks.',
        sizes: {
            xs: 'Tier logo pill.',
            small: 'Current plan summary.',
            medium: 'Plan features and renewal date.',
            large: 'Full tier comparison and billing.'
        }
    },
    'community': {
        title: 'My Pods',
        component: CommunityWidget,
        description: 'Stay connected with your local playgroups.',
        sizes: {
            xs: 'Member count pill.',
            small: 'Active friends avatars.',
            medium: 'Recent group activity feed.',
            large: 'Post to pod wall / social hub.',
            xlarge: 'Full community management center.'
        }
    },
    'social_stats': {
        title: 'Social Battery',
        component: SocialStatsWidget,
        description: 'Monitor your engagement and shared assets.',
        sizes: {
            xs: 'Battery percentage pill.',
            small: 'Standard social gauge.',
            medium: 'Share counts and feedback analytics.',
            large: 'Detailed audience insights.'
        }
    },
    'audit': {
        title: 'Collection Audit',
        component: AuditDashboardWidget,
        description: 'Verify your digital collection against physical cards.',
        sizes: {
            xs: 'Current audit progress %.',
            small: 'Next item in audit queue.',
            medium: 'Audit stats and mismatch count.',
            large: 'Detailed audit results and resume info.',
            xlarge: 'Grand overview of collection integrity.'
        }
    },
    'tips': {
        title: 'Forge Tips',
        component: TipsWidget,
        description: 'Pro tips for mastering the forge.',
        sizes: {
            xs: 'Tip icon pill.',
            small: 'One random pro tip.',
            medium: 'Daily pro trick with icons.',
            large: 'Top 3 tips for your current tier.'
        }
    },
    'releases': {
        title: 'New Sets',
        component: ReleasesWidget,
        description: 'Incoming card sets and set reviews.',
        sizes: {
            xs: 'Release date pill.',
            small: 'Latest set name.',
            medium: 'Next 3 releases with dates.',
            large: 'Detailed set review feed.'
        }
    },
    'guides': {
        title: 'Guides & Resources',
        component: GuidesWidget,
        description: 'Learn how to brew better decks.',
        sizes: {
            xs: 'Book icon pill.',
            small: 'Featured guide link.',
            medium: 'Top 3 reading recommendations.',
            large: 'Full resource library access.'
        }
    },
    'action_log': {
        title: 'Session History',
        component: ActionLogWidget,
        description: 'Track your recent deck edits and actions.',
        sizes: {
            xs: 'Last action pill.',
            small: 'Scrollable list of recent actions.',
            medium: 'Extended list with timestamps.',
            large: 'Full session log with analysis.',
            xlarge: 'Detailed history timeline.'
        }
    },
    'trade_matches': {
        title: 'Trade Alerts',
        component: TradeMatchWidget,
        description: 'Notifications for automated trade matches in your Pod.',
        sizes: {
            xs: 'Pill with match count.',
            small: 'Standard widget with count and label.',
            medium: 'Detailed alert box.',
            large: 'Expanded match list preview.',
            xlarge: 'Full trade hub integration.'
        }
    }
};

export default WIDGETS;
