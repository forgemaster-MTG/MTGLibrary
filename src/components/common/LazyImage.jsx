import React, { useState } from 'react';
import CardSkeleton from '../CardSkeleton';

const LazyImage = ({ src, alt, className, placeholder }) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);

    const handleLoad = () => {
        setIsLoaded(true);
    };

    const handleError = () => {
        setHasError(true);
        setIsLoaded(true); // Stop showing loader even if error
    };

    return (
        <div className={`relative overflow-hidden ${className} bg-gray-900`}>
            {/* Placeholder / Skeleton */}
            {!isLoaded && (
                <div className="absolute inset-0 z-0">
                    {placeholder || <CardSkeleton />}
                </div>
            )}

            {/* Actual Image */}
            <img
                src={hasError ? "https://placehold.co/250x350?text=No+Image" : src}
                alt={alt}
                className={`
                    w-full h-full object-cover transition-opacity duration-500 ease-out
                    ${isLoaded ? 'opacity-100' : 'opacity-0'}
                `}
                onLoad={handleLoad}
                onError={handleError}
                loading="lazy"
            />
        </div>
    );
};

export default LazyImage;
