
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const assetsDir = path.join(__dirname, '../public/assets/mana');

if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
}

// Scryfall symbol codes for standard and hybrid mana
// Standard: W, U, B, R, G, C
// Hybrid: WU, UB, BR, RG, GW, WB, UR, BG, RW, GU
// Also might need phyrexian or others, but user asked for "split color".
const symbols = [
    'W', 'U', 'B', 'R', 'G', 'C',
    'WU', 'UB', 'BR', 'RG', 'GW',
    'WB', 'UR', 'BG', 'RW', 'GU'
];

const downloadFile = (symbol) => {
    // Scryfall uses {WU} for hybrid in text, but URL for svg is usually just WU.svg or similar.
    // Actually Scryfall symbols are often {W/U}. Checking scryfall docs:
    // https://svgs.scryfall.io/card-symbols/WU.svg works?
    // Let's verify commonly used filenames. The previous attempt assumed X.svg. 
    // For hybrid, scryfall usually documents them as {W/U}. 
    // The SVGs hosted at svgs.scryfall.io/card-symbols/ usually strip the slash. e.g. WU.svg.
    // If this fails, we might need to try U-B.svg etc, but standard is WU.

    const url = `https://svgs.scryfall.io/card-symbols/${symbol}.svg`;
    const dest = path.join(assetsDir, `${symbol}.svg`);

    if (fs.existsSync(dest)) {
        console.log(`Skipping ${symbol}, already exists.`);
        return;
    }

    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
        if (response.statusCode !== 200) {
            console.error(`Failed to download ${symbol}: ${response.statusCode}`);
            fs.unlink(dest, () => { }); // Delete empty file
            return;
        }
        response.pipe(file);
        file.on('finish', () => {
            file.close();
            console.log(`Downloaded ${symbol}`);
        });
    }).on('error', (err) => {
        fs.unlink(dest, () => { });
        console.error(`Error downloading ${symbol}: ${err.message}`);
    });
};

console.log(`Downloading ${symbols.length} symbols to ${assetsDir}...`);
symbols.forEach(downloadFile);
