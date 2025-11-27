const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'Public/styles.css');
let content = fs.readFileSync(filePath, 'utf8');

// Define the start and end markers for the block we want to remove
// We'll use a regex to match the whole block including the keyframes
// The block starts with #toast-container and ends after the second keyframe (slideOut)

// We construct a regex that matches from #toast-container down to the end of slideOut
// We need to be careful about greedy matching, but since we know the structure...
// Let's try to match the specific structure we saw.

const blockRegex = /#toast-container\s*\{\s*position:\s*fixed;[\s\S]*?@keyframes\s*slideOut\s*\{[\s\S]*?\}\s*\}/g;

// Check if we find matches
const matches = content.match(blockRegex);
console.log(`Found ${matches ? matches.length : 0} matches.`);

if (matches) {
    const newContent = content.replace(blockRegex, '');
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log('Successfully removed legacy toast CSS blocks.');
} else {
    console.log('No matches found. Dumping a snippet to debug:');
    const idx = content.indexOf('#toast-container');
    if (idx !== -1) {
        console.log(content.substring(idx, idx + 200));
    }
}
