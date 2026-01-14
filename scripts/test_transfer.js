
const axios = require('axios');

const API_URL = 'http://localhost:3001/api';
// You'll need to provide a valid token and user ID for local testing
const TOKEN = 'YOUR_TEST_TOKEN';

async function testTransfer() {
    try {
        // 1. Add a card to binder
        console.log("Adding card to binder...");
        const addResp = await axios.post(`${API_URL}/collection/batch`, {
            cards: [{
                name: "Black Lotus",
                scryfall_id: "bd8fa327-dd41-4737-8f19-2cf5eb1f7cdd",
                set_code: "vma",
                collector_number: "4",
                finish: "nonfoil",
                count: 2
            }],
            mode: 'merge'
        }, { headers: { Authorization: `Bearer ${TOKEN}` } });
        console.log("Added to binder:", addResp.data);

        // 2. Transfer 1 to a deck
        const deckId = 'YOUR_TEST_DECK_ID';
        console.log(`Transferring 1 to deck ${deckId}...`);
        const transferResp = await axios.post(`${API_URL}/collection/batch`, {
            cards: [{
                name: "Black Lotus",
                scryfall_id: "bd8fa327-dd41-4737-8f19-2cf5eb1f7cdd",
                set_code: "vma",
                collector_number: "4",
                finish: "nonfoil",
                count: 1,
                deck_id: deckId
            }],
            mode: 'transfer_to_deck'
        }, { headers: { Authorization: `Bearer ${TOKEN}` } });
        console.log("Transfer response:", transferResp.data);

        // 3. Verify counts (manual check or additional API calls)
        console.log("Test finished. Please check the database/UI for correct counts.");
    } catch (err) {
        console.error("Test failed:", err.response?.data || err.message);
    }
}

// testTransfer();
