import 'dotenv/config';

async function listModels() {
    const key = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!key) {
        console.error('No GEMINI_API_KEY found in environment');
        return;
    }

    console.log(`Checking models for key ending in ...${key.slice(-5)}`);

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
        );

        if (!response.ok) {
            console.error(`Error: ${response.status} ${response.statusText}`);
            console.error(await response.text());
            return;
        }

        const data = await response.json();
        const models = data.models || [];

        console.log('\nAvailable Models:');
        models.forEach(m => {
            console.log(`- ${m.name.replace('models/', '')} (${m.supportedGenerationMethods.join(', ')})`);
        });

        // Test a specific imagen if found
        const imagen = models.find(m => m.name.toLowerCase().includes('imagen'));
        if (imagen) {
            console.log(`\nFound Imagen model: ${imagen.name}`);
        } else {
            console.log('\nNo Imagen models found in the list.');
        }

    } catch (err) {
        console.error('Failed to list models:', err);
    }
}

listModels();
