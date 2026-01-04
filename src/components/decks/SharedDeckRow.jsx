import React from 'react';
import { useDecks } from '../../hooks/useDecks';
import DeckRow from './DeckRow';

const SharedDeckRow = ({ friend }) => {
    // Fetch decks for this specific friend ID
    const { decks, loading, error } = useDecks(friend.owner_id);
    const ownerName = friend.owner?.username || friend.owner_username || 'Unknown Friend';

    // Only render if there are actually decks to show (after loading)
    if (!loading && !error && decks.length === 0) return null;

    return (
        <DeckRow
            title={`Decks by ${ownerName}`}
            decks={decks}
            loading={loading}
            error={error}
            isOwner={false}
        />
    );
};

export default SharedDeckRow;
