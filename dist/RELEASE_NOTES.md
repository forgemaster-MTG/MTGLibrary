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
