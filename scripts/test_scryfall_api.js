
import fetch from 'node-fetch';

async function test() {
    // Aspirant's Ascent (Known valid Scryfall ID)
    const validId = "00010046-601e-4537-8e65-946765790c56";

    const payload = {
        identifiers: [
            { id: validId }
        ]
    };

    console.log("Sending payload with ONLY one known valid ID...");

    const response = await fetch('https://api.scryfall.com/cards/collection', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'MTGForge/1.0'
        },
        body: JSON.stringify(payload)
    });

    console.log("Status:", response.status, response.statusText);
    const data = await response.json();
    console.log("Response:", JSON.stringify(data, null, 2));
}

test();
