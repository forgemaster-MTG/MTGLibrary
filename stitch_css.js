const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'Public/styles.css');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split(/\r?\n/);

console.log(`Total lines: ${lines.length}`);

// Chunk 1: Lines 1-308 (Indices 0-307)
// slice(0, 308) takes indices 0 to 307
const chunk1 = lines.slice(0, 308);

// Chunk 2: Lines 351-505 (Indices 350-504)
// slice(350, 505) takes indices 350 to 504
const chunk2 = lines.slice(350, 505);

// Chunk 3: Lines 548-end (Indices 547-end)
// slice(547) takes indices 547 to end
const chunk3 = lines.slice(547);

const newLines = [...chunk1, ...chunk2, ...chunk3];
const newContent = newLines.join('\n');

fs.writeFileSync(filePath, newContent, 'utf8');
console.log(`New total lines: ${newLines.length}`);
console.log('Successfully stitched styles.css');
