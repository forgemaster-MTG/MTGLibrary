import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

const FeatureTour = ({ steps, isOpen, onClose, onComplete, tourId }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [coords, setCoords] = useState(null);

    // Reset when opening
    useEffect(() => {
        if (isOpen) {
            setCurrentStep(0);
            // Check if already seen if tourId provided? 
            // For now, improved logic handling is up to parent or we just always show if isOpen is true
        }
    }, [isOpen]);

    // Track element position
    useEffect(() => {
        if (!isOpen || !steps[currentStep]) return;

        const handleResize = () => {
            const step = steps[currentStep];
            // Handle multiple selectors (comma separated) - find the first visible one
            const targets = document.querySelectorAll(step.target);
            let element = null;

            for (const el of targets) {
                // Check if element is visible (has size and is in DOM)
                const rect = el.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== 'none') {
                    element = el;
                    break;
                }
            }

            if (element) {
                const rect = element.getBoundingClientRect();
                setCoords({
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height,
                    bottom: rect.bottom,
                    right: rect.right
                });

                // Scroll into view if needed
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                // Element not found - skip or warn?
                console.warn(`Tour target not found: ${step.target}`);
                // Move to next step auto?
            }
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        window.addEventListener('scroll', handleResize, true); // Capture scroll

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('scroll', handleResize, true);
        };
    }, [isOpen, currentStep, steps]);

    if (!isOpen || !steps[currentStep]) return null;

    const step = steps[currentStep];
    const isLast = currentStep === steps.length - 1;

    const handleNext = () => {
        if (isLast) {
            if (tourId) localStorage.setItem(`tour_seen_${tourId}`, 'true');
            onComplete && onComplete();
            onClose();
        } else {
            setCurrentStep(prev => prev + 1);
        }
    };

    const handlePrev = () => {
        setCurrentStep(prev => Math.max(0, prev - 1));
    };

    const overlayStyle = {
        // Cutout via clip-path is tricky with dynamic coords. 
        // Simpler approach: 4 divs for overlay (top, bottom, left, right)
    };

    return createPortal(
        <div className="fixed inset-0 z-[1000] pointer-events-none">
            {/* Dark Overlay assembled from 4 parts to create a hole */}
            {coords && (
                <>
                    {/* Top */}
                    <div className="absolute bg-black/70 transition-all duration-300 pointer-events-auto" style={{ top: 0, left: 0, right: 0, height: coords.top }} />
                    {/* Bottom */}
                    <div className="absolute bg-black/70 transition-all duration-300 pointer-events-auto" style={{ top: coords.bottom, left: 0, right: 0, bottom: 0 }} />
                    {/* Left */}
                    <div className="absolute bg-black/70 transition-all duration-300 pointer-events-auto" style={{ top: coords.top, left: 0, width: coords.left, height: coords.height }} />
                    {/* Right */}
                    <div className="absolute bg-black/70 transition-all duration-300 pointer-events-auto" style={{ top: coords.top, left: coords.right, right: 0, height: coords.height }} />

                    {/* Highlight Border/Pulse */}
                    <div
                        className="absolute border-2 border-indigo-500 rounded shadow-[0_0_20px_rgba(99,102,241,0.5)] transition-all duration-300 pointer-events-none animate-pulse"
                        style={{
                            top: coords.top - 4,
                            left: coords.left - 4,
                            width: coords.width + 8,
                            height: coords.height + 8
                        }}
                    />
                </>
            )}

            {/* Tooltip Card */}
            {coords && (
                <div
                    className="absolute pointer-events-auto transition-all duration-300 z-[1001]"
                    style={step.placement === 'center' ? {
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '300px'
                    } : {
                        top: coords.bottom + 12,
                        left: Math.min(Math.max(10, coords.left), window.innerWidth - 320), // Basic bounds clamping
                        width: '300px'
                    }}
                >
                    <div className="bg-gray-800 border border-indigo-500/30 rounded-xl shadow-2xl p-4 animate-fade-in-up">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="text-lg font-bold text-white">{step.title}</h3>
                            <button onClick={onClose} className="text-gray-400 hover:text-white">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <p className="text-sm text-gray-300 mb-4 leading-relaxed">
                            {step.content}
                        </p>

                        <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-500 font-mono">
                                Step {currentStep + 1} of {steps.length}
                            </span>

                            <div className="flex gap-2">
                                {!isLast && (
                                    <button
                                        onClick={onClose}
                                        className="px-3 py-1.5 text-xs text-gray-400 hover:text-white font-medium"
                                    >
                                        Skip
                                    </button>
                                )}
                                {currentStep > 0 && (
                                    <button
                                        onClick={handlePrev}
                                        className="px-3 py-1.5 rounded-lg border border-gray-600 text-gray-300 hover:text-white text-xs font-bold"
                                    >
                                        Back
                                    </button>
                                )}
                                <button
                                    onClick={handleNext}
                                    className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-500/20"
                                >
                                    {isLast ? 'Finish' : 'Next'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>,
        document.body
    );
};

export default FeatureTour;
