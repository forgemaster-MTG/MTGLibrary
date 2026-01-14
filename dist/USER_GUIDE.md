# MTG Forge - User Guide

Welcome to **MTG Forge**! This guide will walk you through the recommended workflow to get the most out of the application, from setting up AI features to building powerful decks with Gemini-powered suggestions.

> [!IMPORTANT]
> **New to The Forge?** Check out our [AI Strategic Companion Guide](/strategy) for a deep dive into the Actionable Intelligence features that give you the professional edge.

---

## 1. Getting Started: AI Setup (Gemini Key)

To unlock the full potential of MTG Forge—including AI deck blueprints, smart suggestions, and rule lookups—you need to configure your Gemini API key.

1.  **Open Settings**: Click the **Settings** icon (gear) in the navigation bar.
2.  **Locate AI Section**: Find the "AI / Gemini API Key" section.
3.  **Enter Key**: Paste your Google Gemini API key into the input field.
    *   *Note: The key is stored locally in your browser/account settings and is used to make requests on your behalf.*
4.  **Save**: The app will automatically save your key.

> [!TIP]
> Without this key, the "Deck Suggestions", "MTG Chat", and "AI Blueprint" features will not function.

---

## 2. Define Your Playstyle

Before building decks, tell the AI how you like to play. This ensures all suggestions are tailored to your preferences.

1.  **Open Playstyle**: Click the **Playstyle** button in the header.
2.  **Configure Preferences**:
    *   **Format**: Choose your primary format (e.g., Commander, Modern, Standard).
    *   **Budget**: Set a budget preference (e.g., Budget, No Limit).
    *   **Power Level**: Indicate your desired power level.
    *   **Themes**: Add any specific themes or mechanics you enjoy (e.g., "Graveyard recursion", "Aggro").
3.  **Save**: These settings will now influence all AI-generated content.

---

## 3. Build Your Collection

Accurate deck building relies on knowing what cards you own. You can add cards individually or use the powerful "Sets" page for mass entry.

### Method A: The Sets Page (Recommended for Bulk)
This is the fastest way to digitize a binder or set collection.

1.  **Navigate to Sets**: Click **Sets** in the navigation menu.
2.  **Find a Set**: Use the search bar or filters to find the expansion you are working on. Click the set card to open it.
3.  **Mass Update (Table View)**:
    *   Switch to **Table View** using the toggle at the top.
    *   You will see input fields for **Non-Foil** and **Foil** counts for every card.
    *   Simply type the quantities or use the arrow keys to quickly update your collection.
4.  **Quick Add Modal (Visual Entry)**:
    *   Switch to **Grid View**.
    *   Click the **"Add"** button in the control bar to enter "Add Mode".
    *   Click any card to open the **Quick Add Modal**.
    *   **Cycle Through**: Use the **Left/Right Arrow keys** on your keyboard to cycle through the entire set in order.
    *   **Update Counts**: Use the on-screen buttons to add/remove copies as you flip through your physical binder.

### Method B: Individual Search
Best for adding single cards or new acquisitions.

1.  **Go to Collection**: Click **My Collection**.
2.  **Search**: Use the "Add Card" search bar to find a card by name.
3.  **Select Version**: Choose the specific printing (set/art) you have.
4.  **Add**: Set the quantity and finish, then click **Add**.

---

## 4. Create & Manage Decks

Now that your collection is tracked, let's build a deck.

1.  **Create Deck**: Go to **Decks** and click **Create New Deck**.
2.  **Setup**:
    *   **Format**: Select the format (e.g., Commander).
    *   **Commander**: If building for Commander, search for and select your commander card.
3.  **Add Cards**:
    *   In the **Single Deck View**, click **Add Cards**.
    *   The modal shows your **Available Collection**.
    *   Select cards to add. The app automatically updates your "Available" counts so you don't over-assign cards across multiple decks.

---

## 5. AI Deck Suggestions

This is the flagship feature. Let the AI analyze your deck and collection to recommend upgrades.

1.  **Open Deck**: Navigate to the deck you want to improve.
2.  **Run Suggestions**: Click the **Deck Suggestions** button.
3.  **Analysis**:
    *   The AI analyzes your current deck list, your selected Commander, and your **Playstyle**.
    *   It searches your **Collection** for cards that would fit well.
4.  **Review & Apply**:
    *   **Preview**: You will see a list of "Add" and "Remove" recommendations, each with a reasoning and rating.
    *   **Select**: Uncheck any suggestions you don't like.
    *   **Apply**: Click **Add Selected**. The app will automatically move the cards from your collection into the deck and update all counts.

> [!NOTE]
> The AI respects your collection. It only pulls in cards you already own.

---

## 6. MTG Chat Assistant

Need a quick rules clarification or lore check? The **MTG Chat** feature is your always-available AI companion.

1.  **Open Chat**: Click the **Chat** icon (speech bubble) in the bottom-right corner (or navigation bar).
2.  **Ask Anything**:
    *   **Rules**: "How does Trample interact with Deathtouch?"
    *   **Strategy**: "What are good counters to a Cyclonic Rift?"
    *   **Lore**: "Tell me about the Brothers' War."
3.  **Context Aware**: The chat assistant is aware of your **Playstyle** settings, so it will tailor its tone and advice to your preferences (e.g., competitive vs. casual).
4.  **Save & Export**: You can save your conversation history as a text file or JSON for future reference using the buttons in the chat window.

---

## 7. Advanced Features

*   **Import/Export**: Backup your data or transfer it to another device via the Settings page.
*   **Saved Views**: Create custom filters and sorts for your collection (e.g., "High Value Cards", "Commander Staples") in the Settings page.
*   **AI Blueprints**: Generate deck ideas without building them immediately.

---

## 8. Settings Page Reference
The Settings page is the control center for your library. Here is what you can find in each tab:

*   **General**: View your account email, log out, and configure global UI preferences like default grid sizes.
*   **AI & Integrations**: Update or remove your Google Gemini API key.
*   **Display**: Customize exactly what information is shown on the Card Details modal (e.g., show/hide Oracle text, prices, or artist info).
*   **Data**:
    *   **Import/Export**: Backup your entire library to JSON or import decks.
    *   **Deck Management**: A list of all your decks.
    *   **Basic Land Inventory**: Track your pool of basic lands separately from your main collection.
    *   **Collection Maintenance**: Tools like "Cleanup Duplicates" to merge redundant entries.
*   **Saved Views**: Create, edit, and delete your custom collection views (filters, sorts, and grouping).
*   **Advanced**: Contains the "Danger Zone" for clearing all data.

---

## 9. Data Management & Deletion
Managing your data is important. Here is how to remove items from your library:

### Deleting Decks
*   **Standard Delete**: Click the **Trash Icon** on a deck card.
    *   *Effect*: Deletes the deck list but **keeps the cards** in your collection.
*   **Delete Deck & Cards**: Hold **Shift** while clicking the **Trash Icon**.
    *   *Effect*: Deletes the deck **AND removes all cards** in that deck from your collection. Use this if you sold the deck or want to completely dismantle it.

### Deleting Cards
*   Open a card's details and enter **Edit Mode**.
*   Click **Delete** to remove that specific card (or quantity) from your collection.

### Deleting Saved Views
*   Go to **Settings > Saved Views**.
*   Click **Delete** next to the view you want to remove.

### Clear All Data (Danger Zone)
*   Go to **Settings > Data Management**.
*   Click **Clear All Data**.
*   *Effect*: **Permanently deletes** your entire collection, all decks, and user settings. **This cannot be undone.**
