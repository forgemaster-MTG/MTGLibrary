import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

// PDF generation constants
// We use a fallback to indigo hex if CSS variables aren't available to the PDF library
export const BRAND_COLOR = 'rgb(var(--color-primary-600))';
export const BRAND_COLOR_LIGHT = 'rgb(var(--color-primary-300))';
const BG_COLOR = '#111827'; // Gray-900
const TEXT_COLOR = '#f3f4f6'; // Gray-100

export const formatCredits = (val) => {
    if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
    return val;
};

export const PdfService = {
    /**
     * Helper to load an image from a URL
     */
    loadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous"; // Essential for external images in canvas
            img.src = url;
            img.onload = () => resolve(img);
            img.onerror = (e) => {
                console.warn("Failed to load image for PDF", e);
                resolve(null);
            };
        });
    },

    async generateDeckDoctorReport(report, deckName, userProfile) {
        const doc = new jsPDF();
        const primaryColor = BRAND_COLOR;

        // Header
        doc.setFillColor(17, 24, 39); // Gray-900
        doc.rect(0, 0, 210, 40, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.text("FORGE DECK SURGERY", 105, 20, { align: 'center' });
        doc.setFontSize(10);
        doc.text(`Official Blueprint for ${deckName}`, 105, 30, { align: 'center' });

        let y = 50;

        // Metadata
        doc.setTextColor(100, 116, 139); // Gray-500
        doc.setFontSize(8);
        doc.text(`Generated for ${userProfile?.displayName || 'Builder'}`, 20, y);
        doc.text(`Date: ${new Date().toLocaleDateString()}`, 190, y, { align: 'right' });

        y += 15;

        // Executive Summary
        doc.setFillColor(31, 41, 55); // Gray-800
        doc.rect(15, y, 180, 25, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.text("EXECUTIVE SUMMARY", 20, y + 10);
        doc.setFontSize(9);
        doc.setTextColor(200, 200, 200);
        doc.text(report.overall_assessment || "No summary provided.", 20, y + 18, { maxWidth: 170 });

        y += 35;

        // Critical Flaws
        doc.setTextColor(239, 68, 68); // Red-500
        doc.setFontSize(14);
        doc.text("CRITICAL FLAWS", 20, y);
        y += 10;
        doc.setTextColor(50, 50, 50);
        doc.setFontSize(10);
        report.found_flaws?.forEach(flaw => {
            doc.text(`• ${flaw}`, 25, y, { maxWidth: 160 });
            y += (flaw.length > 80 ? 12 : 7);
        });

        y += 10;

        // Recommended Cuts
        doc.setTextColor(17, 24, 39);
        doc.setFontSize(14);
        doc.text("SURGICAL EXCISIONS (CUTS)", 20, y);
        y += 10;
        doc.setFontSize(10);
        report.recommended_cuts?.forEach(cut => {
            doc.text(`- ${cut.card}: ${cut.reason}`, 25, y, { maxWidth: 160 });
            y += 10;
        });

        y += 10;

        // Recommended Additions
        doc.setTextColor(16, 185, 129); // Emerald-500
        doc.setFontSize(14);
        doc.text("AUGMENTATIONS (ADDITIONS)", 20, y);
        y += 10;
        doc.setTextColor(50, 50, 50);
        doc.setFontSize(10);
        report.recommended_additions?.forEach(add => {
            doc.text(`+ ${add.card}: ${add.reason}`, 25, y, { maxWidth: 160 });
            y += 10;
        });

        doc.save(`${deckName.replace(/\s+/g, '_')}_Surgery_Report.pdf`);
    },

    async generateStrategicBlueprintReport(deck, userProfile) {
        const doc = new jsPDF();
        // Placeholder for the strategic report logic
        doc.text("Strategic Blueprint Report", 10, 10);
        doc.save(`${deck.name}_Blueprint.pdf`);
    },

    async generatePlaystyleReport(profile, userProfile) {
        const doc = new jsPDF();
        doc.text("Playstyle Profile Report", 10, 10);
        doc.save("Playstyle_Profile.pdf");
    }
};
