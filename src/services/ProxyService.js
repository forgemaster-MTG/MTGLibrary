import { jsPDF } from 'jspdf';

export const proxyService = {
    /**
     * Generates a PDF of proxies for the given cards.
     * @param {Array} cards - Array of card objects (must include image_uri or card_faces)
     * @param {Object} settings - { paperSize: 'letter' | 'a4', cutLines: boolean }
     * @param {Function} onProgress - Callback for progress updates (current, total)
     */
    async generatePDF(cards, settings = { paperSize: 'letter', cutLines: true }, onProgress) {
        // 1. Constants (in mm)
        const CARD_WIDTH = 63;
        const CARD_HEIGHT = 88;
        const GAP = 0; // No gap for easiest cutting, or small gap? Usually 0 for proxies so they share cut lines.

        // Paper Dimensions
        const PAPER = {
            letter: { width: 215.9, height: 279.4 },
            a4: { width: 210, height: 297 }
        };

        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: settings.paperSize
        });

        const pageWidth = PAPER[settings.paperSize].width;
        const pageHeight = PAPER[settings.paperSize].height;

        // 3x3 Grid
        const COLS = 3;
        const ROWS = 3;
        const CARDS_PER_PAGE = COLS * ROWS;

        // Calculate Margins to center the grid
        const gridWidth = COLS * CARD_WIDTH;
        const gridHeight = ROWS * CARD_HEIGHT;
        const startX = (pageWidth - gridWidth) / 2;
        const startY = (pageHeight - gridHeight) / 2;

        let pageCount = 0;
        let cardIndex = 0;


        const loadImage = async (url) => {
            try {
                // Use our own server as a proxy to bypass browser CORS restrictions
                const proxyUrl = `/api/proxy/image?url=${encodeURIComponent(url)}`;
                const response = await fetch(proxyUrl);

                if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
                const blob = await response.blob();

                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result); // Base64 string
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            } catch (error) {
                console.error("Image load failed", url, error);
                return null;
            }
        };

        const total = cards.length;

        for (let i = 0; i < total; i++) {
            if (onProgress) onProgress(i + 1, total);

            // New Page needed?
            if (i > 0 && i % CARDS_PER_PAGE === 0) {
                doc.addPage();
                pageCount++;
            }

            const positionInPage = i % CARDS_PER_PAGE;
            const col = positionInPage % COLS;
            const row = Math.floor(positionInPage / COLS);

            const x = startX + (col * CARD_WIDTH);
            const y = startY + (row * CARD_HEIGHT);

            const card = cards[i];

            // Determine Image URL
            // Check top-level, nested data, and card faces
            const imageUrl =
                card.image_uri ||
                card.image_uris?.normal ||
                card.data?.image_uris?.normal ||
                card.card_faces?.[0]?.image_uris?.normal ||
                card.data?.card_faces?.[0]?.image_uris?.normal;

            let imageAdded = false;

            if (imageUrl) {
                try {
                    // We need base64 or Image element for jspdf
                    const img = await loadImage(imageUrl);
                    if (img) {
                        doc.addImage(img, 'JPEG', x, y, CARD_WIDTH, CARD_HEIGHT);
                        imageAdded = true;
                    }
                } catch (e) {
                    console.error("Error adding image to PDF", e);
                }
            }

            if (!imageAdded) {
                // Draw placeholder text if no image or image failed
                doc.setDrawColor(0); // Black border for placeholder
                doc.rect(x, y, CARD_WIDTH, CARD_HEIGHT);
                doc.setFontSize(10);
                // Simple word wrap or split
                const splitTitle = doc.splitTextToSize(card.name, CARD_WIDTH - 10);
                doc.text(splitTitle, x + 5, y + 10);

                // Optional: Add type/mana if available for better proxy
                doc.setFontSize(8);
                if (card.mana_cost) doc.text(card.mana_cost, x + 5, y + 20);
                if (card.type_line) {
                    const splitType = doc.splitTextToSize(card.type_line, CARD_WIDTH - 10);
                    doc.text(splitType, x + 5, y + 30);
                }


            }

            // Cut Lines
            if (settings.cutLines) {
                doc.setDrawColor(200, 200, 200); // Light Grey
                doc.rect(x, y, CARD_WIDTH, CARD_HEIGHT);
            }
        }

        return doc;
    }
};
