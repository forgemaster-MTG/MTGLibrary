# Release Notes - 2026-02-24 (v1.0.5)

## ✨ The AI & UI Overhaul

### 🤖 Advanced AI Personas & Imagery
*   **Imagen 4.0 & Nano Banana Pro (Latest)**: Integrated the state-of-the-art **Imagen 4.0** and **Nano Banana Pro Preview** models. Performance is now split between "Pro AI" for studio-quality 4K visuals and "Fast AI" for rapid, cost-effective generation.
*   **Persona Details Redesign**: Complete visual overhaul of individual AI Helper pages.
    *   **Banner Layout**: Cinematic 21:7 top-banner displays characters with high-contrast text overlays.
    *   **Max-Width Expansion**: Modal width increased to `max-w-5xl` for a more open, premium feel.
    *   **Information Hierarchy**: Refined vertical content flow for biographies and interaction logs.
*   **Emerald Forge Stylized Scrollbars**: Custom emerald-themed scrollbars implemented across the Persona interface for maximum aesthetic consistency.

### 💼 Admin & Infrastructure
*   **Persona Manager 2.0**: 
    *   **PNG-to-Base64 Upload**: Direct upload support for local character art, automatically optimized into Data URLs.
    *   **Collapsible Interface**: Improved management UI with collapsible forms to optimize screen real estate.
*   **Dynamic Pricing Service**: Centralized AI cost management with sustainable credit deduction logic and configurable markups (default 115%).

### 💎 User Experience
*   **Cost Confirmation**: Added real-time credit cost previews and mandatory confirmation dialogs for profile and helper avatar generation.

---

# Release Notes - 2025-11-27

## 📚 Documentation
*   **New User Guide**: Added a comprehensive `USER_GUIDE.md` covering:
    *   Getting Started & AI Setup (Gemini Key)
    *   Defining Playstyles
    *   Collection Management (Sets & Search)
    *   Deck Building & AI Suggestions
    *   MTG Chat Assistant
    *   Settings Page Walkthrough
    *   Data Management & Deletion

## 🐛 Bug Fixes
*   **Exports & Modules**: Fixed broken exports in `ui.js` and `app.js` that were causing runtime errors.
*   **Deck Suggestions**:
    *   Fixed incorrect card counts when adding suggested cards.
    *   Resolved issues where not all suggested cards were being added.
    *   Fixed visual glitches and modal stacking when deleting cards.
    *   Corrected basic land calculation logic to account for existing non-basics.
    *   Prevented duplication of non-basic lands during batch add.
*   **Modal Layering**: Fixed z-index issues where the "AI Blueprint" modal was hidden behind the "Create Deck" modal.
*   **Syntax Errors**: Resolved runtime syntax errors in `singleDeck.js` and `index.html`.

## 🎨 UI/UX Improvements
*   **Decks View**:
    *   Fixed "shrunk" deck cards on desktop; adjusted grid layout.
    *   Improved mobile responsiveness for deck cards (full width).
*   **Set Details**:
    *   Fixed "Back" button functionality.
    *   Added collapsible card groups (defaulting to collapsed).
    *   Enabled closing the "Add Cards" modal by clicking the backdrop.
    *   Refined the "Quick Edit" UI layout.
*   **AI Defaults**: AI Deck Suggestions now default to "Select All" for easier bulk addition.
