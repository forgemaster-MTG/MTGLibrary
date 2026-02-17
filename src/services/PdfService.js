import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

const BRAND_COLOR = '#4f46e5'; // Indigo-600
const BG_COLOR = '#111827'; // Gray-900
const TEXT_COLOR = '#f3f4f6'; // Gray-100

export const PdfService = {
    /**
     * Helper to load an image from a URL
     */
    loadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = url;
            img.onload = () => resolve(img);
            img.onerror = (e) => {
                console.warn("Failed to load logo", e); // Don't break report if logo fails
                resolve(null);
            };
        });
    },

    /**
     * Generates a PDF for the Deck Doctor Report
     */
    async generateDeckDoctorReport(report, deckName, userProfile) {
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const logo = await this.loadImage('/logo.png');

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 15;

        // --- Helper Functions ---
        const addHeader = (y) => {
            // Logo / Title
            doc.setFillColor(BG_COLOR);
            doc.rect(0, 0, pageWidth, 25, 'F');
            
            let textX = margin;

            if (logo) {
                // Add Logo (10x10mm approx, adjust aspect ratio)
                const logoSize = 12;
                doc.addImage(logo, 'PNG', margin, 6.5, logoSize, logoSize);
                textX += logoSize + 4; // Shift text
            }
            
            doc.setFontSize(18);
            doc.setTextColor('#ffffff');
            doc.setFont('helvetica', 'bold');
            doc.text("MTG FORGE", textX, 17);
            
            doc.setFontSize(10);
            doc.setTextColor('#a5b4fc'); // Indigo-300
            doc.text("DECK DOCTOR ANALYSIS", pageWidth - margin, 17, { align: 'right' });
        };

        const addFooter = (pageNo) => {
            doc.setFillColor(BG_COLOR);
            doc.rect(0, pageHeight - 15, pageWidth, 15, 'F');
            
            doc.setFontSize(8);
            doc.setTextColor('#6b7280'); // Gray-500
            doc.text(`Generated for ${userProfile?.displayName || 'Planeswalker'}`, margin, pageHeight - 6);
            doc.text(`Page ${pageNo}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
        };


        // --- PAGE 1: OVERVIEW ---
        addHeader();

        let y = 40;

        // Title
        doc.setTextColor('#111827'); // Black text for white paper? Or should we make a dark mode PDF?
        // Printing dark mode PDFs consumes a lot of ink. Let's go with a "Clean White" professional look 
        // but with branded headers.

        doc.setFontSize(24);
        doc.setTextColor('#111827');
        doc.setFont('helvetica', 'bold');
        doc.text(deckName, margin, y);
        y += 10;

        doc.setFontSize(12);
        doc.setTextColor('#4b5563'); // Gray-600
        doc.setFont('helvetica', 'normal');
        doc.text(`Power Level Evaluation`, margin, y);
        y += 20;

        // SCORE CARD
        // Draw a box
        doc.setDrawColor(200, 200, 200);
        doc.setFillColor(249, 250, 251); // Gray-50
        doc.roundedRect(margin, y, pageWidth - (margin*2), 40, 3, 3, 'FD');

        doc.setFontSize(14);
        doc.setTextColor('#4f46e5'); // Brand
        doc.text("OVERALL POWER LEVEL", margin + 10, y + 12);

        doc.setFontSize(36);
        doc.setTextColor('#111827');
        doc.setFont('helvetica', 'bold');
        doc.text(`${Number(report.powerLevel).toFixed(1)} / 10`, margin + 10, y + 28);

        // Bracket
        doc.setFontSize(14);
        doc.setTextColor('#4b5563');
        doc.text(`Bracket ${report.commanderBracket}`, pageWidth - margin - 10, y + 18, { align: 'right' });
        
        y += 55;

        // Metrics
        const metrics = [
            { label: "Efficiency", value: report.metrics.efficiency },
            { label: "Interaction", value: report.metrics.interaction },
            { label: "Win Turn", value: `T${report.metrics.winTurn}` }
        ];

        let xOffset = margin;
        const boxWidth = (pageWidth - (margin*2) - 20) / 3;

        metrics.forEach(m => {
            doc.setFillColor('#eff6ff'); // Blue-50
            doc.roundedRect(xOffset, y, boxWidth, 25, 2, 2, 'F');
            
            doc.setFontSize(10);
            doc.setTextColor('#6b7280');
            doc.text(m.label.toUpperCase(), xOffset + 5, y + 8);

            doc.setFontSize(16);
            doc.setTextColor('#111827');
            doc.setFont('helvetica', 'bold');
            doc.text(String(m.value), xOffset + 5, y + 18);

            xOffset += boxWidth + 10;
        });

        y += 40;

        // Clinical Critique
        doc.setFontSize(14);
        doc.setTextColor('#4f46e5');
        doc.setFont('helvetica', 'bold');
        doc.text("CLINICAL CRITIQUE", margin, y);
        y += 8;

        doc.setFontSize(10);
        doc.setTextColor('#374151');
        doc.setFont('helvetica', 'normal');
        
        // Clean Text Logic (Shared with Strategy Blueprint)
        let cleanCritique = report.critique
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]*>?/gm, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"');

        // Remove Emojis and non-Latin-1 characters
        cleanCritique = cleanCritique.replace(/[^\x20-\x7E\xA0-\xFF\n]/g, '');

        const splitCritique = doc.splitTextToSize(cleanCritique, pageWidth - (margin*2));
        
        // Pagination Loop for Critique
        splitCritique.forEach(line => {
            if (y > pageHeight - 60) {
                addFooter(doc.internal.getNumberOfPages());
                doc.addPage();
                addHeader();
                y = 40;
                
                // Reset font
                doc.setFontSize(10);
                doc.setTextColor('#374151');
                doc.setFont('helvetica', 'normal');
            }
            doc.text(line, margin, y);
            y += 5; // Line height for size 10
        });
        
        y += 15;

        // Mechanical Improvements
        if (y > pageHeight - 60) {
            addFooter(doc.internal.getNumberOfPages());
            doc.addPage();
            addHeader();
            y = 40;
        }

        doc.setFontSize(14);
        doc.setTextColor('#ef4444'); // Red-500
        doc.setFont('helvetica', 'bold');
        doc.text("MECHANICAL IMPROVEMENTS", margin, y);
        y += 8;

        report.mechanicalImprovements.forEach((imp) => {
             doc.setFontSize(10);
             doc.setTextColor('#374151');
             doc.setFont('helvetica', 'normal');
             
             // Clean bullet text too just in case
             let cleanImp = imp.replace(/[^\x20-\x7E\xA0-\xFF\n]/g, '');
             const bullet = `• ${cleanImp}`;
             const splitImp = doc.splitTextToSize(bullet, pageWidth - (margin*2));
             
             splitImp.forEach(line => {
                if (y > pageHeight - 60) {
                    addFooter(doc.internal.getNumberOfPages());
                    doc.addPage();
                    addHeader();
                    y = 40;
                    
                    doc.setFontSize(10);
                    doc.setTextColor('#374151');
                    doc.setFont('helvetica', 'normal');
                }
                doc.text(line, margin, y);
                y += 5;
             });
             y += 3; // Spacing between bullets
        });

        addFooter(doc.internal.getNumberOfPages());

        // --- PAGE 2: SWAPS ---
        doc.addPage();
        addHeader();
        y = 40;

        doc.setFontSize(14);
        doc.setTextColor('#10b981'); // Emerald-500
        doc.setFont('helvetica', 'bold');
        doc.text("SURGICAL SWAPS", margin, y);
        y += 10;

        report.recommendedSwaps.forEach((swap, i) => {
            // Check usage
            if (y > pageHeight - 50) {
                addFooter(doc.internal.getNumberOfPages());
                doc.addPage();
                addHeader();
                y = 40;
            }

            // Box
            doc.setDrawColor(229, 231, 235);
            doc.setFillColor(255, 255, 255);
            doc.roundedRect(margin, y, pageWidth - (margin*2), 35, 2, 2, 'FD');

            // OUT
            doc.setFontSize(8);
            doc.setTextColor('#ef4444'); // Red
            doc.setFont('helvetica', 'bold');
            doc.text("REMOVE", margin + 5, y + 8);
            
            doc.setFontSize(12);
            doc.setTextColor('#111827');
            doc.text(swap.remove, margin + 5, y + 15);

            // Arrow
            doc.setFontSize(16);
            doc.setTextColor('#9ca3af');
            doc.text("→", margin + 60, y + 15);

            // IN
            doc.setFontSize(8);
            doc.setTextColor('#10b981'); // Green
            doc.setFont('helvetica', 'bold');
            doc.text("ADD", margin + 80, y + 8);

            doc.setFontSize(12);
            doc.setTextColor('#111827');
            doc.text(swap.add, margin + 80, y + 15);

            // Reason
            doc.setFontSize(9);
            doc.setTextColor('#6b7280');
            doc.setFont('helvetica', 'italic');
            const reasonSplit = doc.splitTextToSize(`"${swap.reason}"`, pageWidth - (margin*2) - 10);
            doc.text(reasonSplit, margin + 5, y + 25);

            y += 40;
        });

        addFooter(doc.internal.getNumberOfPages());
        doc.save(`${deckName.replace(/\s+/g, '_')}_DeckDoctor.pdf`);
    },

    /**
     * Generates a PDF for the Strategic Blueprint
     */
    async generateStrategicBlueprintReport(deck, userProfile) {
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'pt',
            format: 'a4'
        });

        const logo = await this.loadImage('/logo.png');

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 40;
        let y = margin;

        const themeColor = [79, 70, 229]; // Indigo

        // --- Header ---
        const addHeader = (yPosition) => {
            // Logo Background
            doc.setFillColor(20, 20, 30);
            doc.rect(0, 0, pageWidth, 80, 'F');
            
            let textX = margin;

            if (logo) {
                 // Add Logo (PT units, approx 30x30pt)
                const logoSize = 40;
                doc.addImage(logo, 'PNG', margin, 20, logoSize, logoSize);
                textX += logoSize + 15;
            }

            // Title
            doc.setFont("helvetica", "bold");
            doc.setFontSize(22);
            doc.setTextColor(255, 255, 255);
            doc.text("MTG FORGE", textX, 50);
            
            // Subtitle
            doc.setFontSize(10);
            doc.setTextColor(150, 150, 150);
            doc.text("STRATEGIC BLUEPRINT", pageWidth - margin, 50, { align: 'right' });

            // Accent Line
            doc.setDrawColor(...themeColor);
            doc.setLineWidth(2);
            doc.line(margin, 80, pageWidth - margin, 80);

            return 100; // New Y
        };

        const addFooter = (pageNo) => {
            const footerY = pageHeight - 30;
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.5);
            doc.line(margin, footerY, pageWidth - margin, footerY);
            
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(`Generated for ${userProfile?.displayName || 'Planeswalker'}`, margin, footerY + 15);
            doc.text(`Page ${pageNo}`, pageWidth - margin, footerY + 15, { align: 'right' });
        };

        y = addHeader(y);

        // Deck Title & Commander
        doc.setFontSize(24);
        doc.setTextColor(0, 0, 0);
        doc.text(deck.name || "Untitled Deck", margin, y);
        y += 25;

        doc.setFontSize(12);
        doc.setTextColor(100, 100, 100);
        doc.text(`Commander: ${deck.commander?.name || 'Unknown'}`, margin, y);
        if (deck.commander_partner) {
            y += 15;
            doc.text(`Partner: ${deck.commander_partner.name}`, margin, y);
        }
        y += 30;

        // Theme
        const blueprint = deck.aiBlueprint || {};
        const theme = blueprint.theme || 'Uncharted Strategy';
        
        doc.setFillColor(...themeColor); // Indigo pill
        doc.roundedRect(margin, y, pageWidth - (margin * 2), 40, 10, 10, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        
        // Strip HTML from theme if present
        const cleanTheme = theme.replace(/<[^>]*>?/gm, '');
        doc.text(cleanTheme, pageWidth / 2, y + 25, { align: 'center' });
        y += 60;

        // Content Helper
        const printText = (title, htmlContent) => {
            const lineHeight = 14;
            
            // Check title header space (need approx 60pt for title + spacing)
            if (y > pageHeight - 100) {
                addFooter(doc.internal.getNumberOfPages());
                doc.addPage();
                y = addHeader(0);
            }

            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.setTextColor(0, 0, 0);
            doc.text(title, margin, y);
            y += 20;

            doc.setFont("times", "normal"); // Serif for body
            doc.setFontSize(11);
            doc.setTextColor(50, 50, 50);

            // Clean Text Logic
            // 1. Replace <br> with newlines
            // 2. Strip HTML tags
            // 3. Decode common entities
            // 4. Strip unsupported characters (Standard fonts only support Latin-1)
            let cleanText = htmlContent
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<[^>]*>?/gm, '')
                .replace(/&nbsp;/g, ' ')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"');

            // Remove Emojis and non-Latin-1 characters which break jsPDF standard fonts
            // This regex keeps ASCII printable, newlines, and common Western European characters
            cleanText = cleanText.replace(/[^\x20-\x7E\xA0-\xFF\n]/g, '');

            const splitText = doc.splitTextToSize(cleanText, pageWidth - (margin * 2));
            
            // Print line by line to handle pagination
            splitText.forEach(line => {
                if (y > pageHeight - 60) { // Leave space for footer
                    addFooter(doc.internal.getNumberOfPages());
                    doc.addPage();
                    y = addHeader(0);
                    
                    // Reset font after page break (addHeader uses Helvetica)
                    doc.setFont("times", "normal");
                    doc.setFontSize(11);
                    doc.setTextColor(50, 50, 50);
                }
                doc.text(line, margin, y);
                y += lineHeight;
            });
            
            y += 30; // Spacing after block
        };

        // Strategy
        const strategyHtml = blueprint.strategy || "No strategy generated.";
        printText("TACTICAL OVERVIEW", strategyHtml);

        // Notes (if any)
        if (deck.notes) {
            printText("DECK NOTES", deck.notes);
        }

        addFooter(doc.internal.getNumberOfPages());
        doc.save(`${deck.name.replace(/\s+/g, '_')}_Blueprint.pdf`);
    },

    /**
     * Generates a PDF for the Playstyle Profile
     */
    async generatePlaystyleReport(profile, userProfile) {
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const logo = await this.loadImage('/logo.png');

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 15;

        // Reuse Header/Footer logic
        const addHeader = (y) => {
            doc.setFillColor(BG_COLOR);
            doc.rect(0, 0, pageWidth, 25, 'F');
            
            let textX = margin;
            if (logo) {
                const logoSize = 12;
                doc.addImage(logo, 'PNG', margin, 6.5, logoSize, logoSize);
                textX += logoSize + 4;
            }

            doc.setFontSize(18);
            doc.setTextColor('#ffffff');
            doc.setFont('helvetica', 'bold');
            doc.text("MTG FORGE", textX, 17);
            doc.setFontSize(10);
            doc.setTextColor('#c084fc'); // Purple-400
            doc.text("PSYCHOGRAPHIC PROFILE", pageWidth - margin, 17, { align: 'right' });
        };

        const addFooter = (pageNo) => {
            doc.setFillColor(BG_COLOR);
            doc.rect(0, pageHeight - 15, pageWidth, 15, 'F');
            doc.setFontSize(8);
            doc.setTextColor('#6b7280');
            doc.text(`Generated for ${userProfile?.displayName || 'Planeswalker'}`, margin, pageHeight - 6);
            doc.text(`Page ${pageNo}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
        };

        addHeader();
        let y = 40;

        // Tags
        if (profile.tags && profile.tags.length > 0) {
            let xOffset = margin;
            doc.setFontSize(10);
            doc.setTextColor('#ffffff');
            doc.setFont('helvetica', 'bold');
            
            profile.tags.forEach(tag => {
                const tagWidth = doc.getTextWidth(tag) + 10;
                doc.setFillColor('#4f46e5');
                doc.roundedRect(xOffset, y, tagWidth, 8, 2, 2, 'F');
                doc.text(tag.toUpperCase(), xOffset + 5, y + 5.5);
                xOffset += tagWidth + 5;
            });
            y += 15;
        }

        // Summary
        doc.setFontSize(14);
        doc.setTextColor('#4f46e5');
        doc.setFont('helvetica', 'bold');
        doc.text("IDENTITY", margin, y);
        y += 8;

        doc.setFontSize(11);
        doc.setTextColor('#374151');
        doc.setFont('helvetica', 'italic');
        
        const cleanSummary = profile.summary.replace(/<[^>]*>?/gm, '');
        const splitSummary = doc.splitTextToSize(cleanSummary, pageWidth - (margin*2));
        doc.text(splitSummary, margin, y);
        y += (splitSummary.length * 5) + 15;

        // Archetypes
        doc.setFontSize(14);
        doc.setTextColor('#4f46e5');
        doc.setFont('helvetica', 'bold');
        doc.text("RECOMMENDED ARCHETYPES", margin, y);
        y += 8;

        const archetypes = profile.archetypes || [];
        archetypes.forEach(arch => {
             doc.setFontSize(10);
             doc.setTextColor('#1f2937');
             doc.setFont('helvetica', 'normal');
             doc.text(`• ${arch}`, margin, y);
             y += 6;
        });
        y += 10;

        // Psychographic Scores
        doc.setFontSize(14);
        doc.setTextColor('#4f46e5');
        doc.setFont('helvetica', 'bold');
        doc.text("TRAIT ANALYSIS", margin, y);
        y += 10;

        const scores = profile.scores || {};
        Object.entries(scores).forEach(([key, value]) => {
            const label = key.toUpperCase();
            
            doc.setFontSize(10);
            doc.setTextColor('#6b7280');
            doc.text(label, margin, y);
            
            doc.setTextColor('#111827');
            doc.text(`${value}/100`, pageWidth - margin, y, { align: 'right' });
            
            y += 3;
            
            // Bar background
            doc.setFillColor('#e5e7eb');
            doc.rect(margin, y, pageWidth - (margin*2), 3, 'F');
            
            // Bar fill
            doc.setFillColor('#4f46e5');
            const barWidth = ((pageWidth - (margin*2)) * value) / 100;
            doc.rect(margin, y, barWidth, 3, 'F');
            
            y += 12;
        });

        addFooter(1);
        doc.save(`Playstyle_Profile.pdf`);
    }
};
