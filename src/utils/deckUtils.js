
/**
 * Extract the art crop image URL from a commander object.
 * Handles normal cards, double-faced cards, and fallbacks.
 */
export const getArtCrop = (commander) => {
    if (!commander) return null;
    const data = commander.data || commander;

    if (data.image_uris?.art_crop) return data.image_uris.art_crop;
    if (data.card_faces?.[0]?.image_uris?.art_crop) return data.card_faces[0].image_uris.art_crop;
    // Fallback to normal if art_crop missing
    if (data.image_uris?.normal) return data.image_uris.normal;

    return null;
};

/**
 * reliable way to get deck colors from commander(s)
 */
export const getDeckColors = (deck) => {
    const mainColors = deck?.commander?.color_identity || [];
    const partnerColors = deck?.commander_partner?.color_identity || [];
    const unique = [...new Set([...mainColors, ...partnerColors])];
    return unique.length > 0 ? unique : ['C']; // Default to Colorless 'C' if empty
};
