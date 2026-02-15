const axios = require('axios');

const url = 'https://archidekt.com/decks/10777161/kudo_king_among_bears';
const id = '10777161';

async function test() {
    try {
        console.log(`Fetching ${url}...`);
        const response = await axios.get(`https://archidekt.com/api/decks/${id}/`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        console.log('Status:', response.status);
        if (response.data.cards) {
            console.log('Cards found:', response.data.cards.length);
        } else {
            console.log('No cards property found in response.');
            console.log('Keys:', Object.keys(response.data));
        }
    } catch (err) {
        console.error('Error:', err.message);
        if (err.response) {
            console.error('Response Status:', err.response.status);
            console.error('Response Data:', err.response.data);
        }
    }
}

test();
