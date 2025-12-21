import React from 'react';

const CardSkeleton = () => {
    return (
        <div className="relative aspect-[2.5/3.5] bg-gray-800 rounded-lg overflow-hidden border border-gray-700 animate-pulse">
            <div className="absolute inset-0 bg-gray-700/50"></div>
            {/* Optional: Add a subtle shimmer or extra details if desired */}
        </div>
    );
};

export default CardSkeleton;
