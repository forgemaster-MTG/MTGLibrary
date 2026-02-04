import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { useToast } from '../../contexts/ToastContext';
import SocialCardPreview from './SocialCardPreview';
import { Share2, Download, Copy, X, Check, Image as ImageIcon, Link as LinkIcon, QrCode } from 'lucide-react';

const SocialShareHub = ({ isOpen, onClose, type, data, shareUrl }) => {
    const { addToast } = useToast();
    const cardRef = useRef(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [viewMode, setViewMode] = useState('card'); // 'card' | 'link'
    const [copied, setCopied] = useState(false);

    if (!isOpen) return null;

    const handleDownload = async () => {
        if (!cardRef.current) return;

        setIsGenerating(true);
        try {
            // Ensure fonts are loaded and layout is settled
            await document.fonts.ready;
            await new Promise(r => setTimeout(r, 500));

            // Use html2canvas for more robust capture
            const canvas = await html2canvas(cardRef.current, {
                scale: 2,
                useCORS: true,
                allowTaint: false,
                backgroundColor: '#030712',
                logging: false,
                imageTimeout: 15000,
                onclone: (clonedDoc) => {
                    // NUCLEAR SANITIZATION 3.0: "Search and Destroy"
                    // Designed to rigorously strip any trace of Tailwind 4's modern CSS (oklch, oklab)
                    // and sanitize SVGs to prevent parser crashes.

                    // 1. Remove global style definitions (Style Tags & Linked Sheets)
                    Array.from(clonedDoc.querySelectorAll('style, link[rel="stylesheet"]')).forEach(el => el.remove());

                    // 2. Recursive DOM Walker to purge "poison" attributes
                    const cleanElement = (el) => {
                        // A. Strip Class Attribute (completely disconnect from Tailwind)
                        if (el.hasAttribute('class')) el.removeAttribute('class');

                        // B. Sanitize Style Attribute String
                        // We check the raw string for forbidden tokens. getPropertyValue might compute them from defaults.
                        const styleStr = el.getAttribute('style');
                        if (styleStr && (styleStr.includes('oklch') || styleStr.includes('oklab') || styleStr.includes('display-p3'))) {
                            // Nuke the style to be safe.
                            el.setAttribute('style', 'color: #000000 !important; background: none !important; border-color: #000000 !important;');
                        }

                        // C. Check for SVG specific attributes that might hold colors
                        if (el instanceof SVGElement) {
                            ['fill', 'stroke'].forEach(attr => {
                                const val = el.getAttribute(attr);
                                if (val && (val.includes('oklch') || val.includes('oklab'))) {
                                    el.setAttribute(attr, '#000000');
                                }
                            });
                        }

                        // D. Sanitize background images (e.g. data:image/svg)
                        // This prevents crashes if an embedded SVG uses modern features.
                        if (el.style.backgroundImage && el.style.backgroundImage.includes('oklch')) {
                            el.style.backgroundImage = 'none';
                        }

                        // Recurse
                        if (el.children) {
                            Array.from(el.children).forEach(cleanElement);
                        }
                    };

                    // Start cleaning from the body of the cloned document
                    cleanElement(clonedDoc.body);
                }
            });

            const dataUrl = canvas.toDataURL('image/png', 1.0);

            // Safety check for empty data
            if (!dataUrl || dataUrl === 'data:,' || dataUrl.length < 100) {
                throw new Error('Generated image is empty');
            }

            const link = document.createElement('a');
            link.download = `mtf-forge-${type}-${data.title?.toLowerCase().replace(/\s+/g, '-') || 'share'}.png`;
            link.href = dataUrl;
            link.click();
            addToast('Social card downloaded!', 'success');
        } catch (err) {
            console.error('Failed to generate image', err);
            addToast('Failed to generate image. Try the copy link instead.', 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCopyLink = () => {
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        addToast('Link copied to clipboard!', 'success');
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 md:p-8 overflow-y-auto">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/95 backdrop-blur-xl animate-fade-in" onClick={onClose} />

            {/* Modal Container */}
            <div className="relative z-10 w-full max-w-5xl bg-gray-900 border border-white/10 rounded-[32px] shadow-[0_0_100px_rgba(0,0,0,0.5)] flex flex-col max-h-[90vh] overflow-hidden animate-fade-in-up">

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all z-20"
                >
                    <X className="w-6 h-6" />
                </button>

                {/* Header */}
                <div className="p-8 pb-4">
                    <div className="flex items-center gap-3 mb-1">
                        <Share2 className="w-5 h-5 text-purple-400" />
                        <h2 className="text-2xl font-black text-white uppercase italic tracking-tight">Share to Socials</h2>
                    </div>
                    <p className="text-gray-400 text-sm">Download a high-impact share card or copy a direct link.</p>
                </div>

                {/* Content Tabs */}
                <div className="px-8 border-b border-white/5 flex gap-8">
                    <button
                        onClick={() => setViewMode('card')}
                        className={`pb-4 text-sm font-bold uppercase tracking-widest transition-all relative ${viewMode === 'card' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        <div className="flex items-center gap-2">
                            <ImageIcon className="w-4 h-4" /> Social Card
                        </div>
                        {viewMode === 'card' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-purple-500 rounded-full" />}
                    </button>
                    <button
                        onClick={() => setViewMode('link')}
                        className={`pb-4 text-sm font-bold uppercase tracking-widest transition-all relative ${viewMode === 'link' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        <div className="flex items-center gap-2">
                            <LinkIcon className="w-4 h-4" /> Direct Link
                        </div>
                        {viewMode === 'link' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-purple-500 rounded-full" />}
                    </button>
                </div>

                {/* Main View Area */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-black/20">
                    {viewMode === 'card' ? (
                        <div className="flex flex-col items-center gap-8">
                            {/* The Hidden Preview for html2canvas */}
                            <div className="hidden">
                                <SocialCardPreview
                                    type={type}
                                    data={data}
                                    shareUrl={shareUrl}
                                    cardRef={cardRef}
                                />
                            </div>

                            {/* Responsive Scaled Preview for UI */}
                            <div className="w-full max-w-full aspect-[1200/630] rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 relative group">
                                <div className="absolute inset-0 scale-[0.3] sm:scale-[0.4] md:scale-[0.5] lg:scale-[0.6] xl:scale-[0.7] origin-top-left pointer-events-none">
                                    <SocialCardPreview
                                        type={type}
                                        data={data}
                                        shareUrl={shareUrl}
                                    />
                                </div>
                                {/* Overlay hint */}
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <p className="text-white font-bold bg-purple-600 px-6 py-2 rounded-full shadow-lg">Preview Only (Scaled)</p>
                                </div>
                            </div>

                            <div className="flex gap-4 w-full justify-center">
                                <button
                                    onClick={handleDownload}
                                    disabled={isGenerating}
                                    className="flex items-center gap-3 bg-white text-black px-8 py-4 rounded-2xl font-black uppercase italic tracking-wider hover:bg-white/90 transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)] disabled:opacity-50"
                                >
                                    {isGenerating ? 'Generating...' : <><Download className="w-5 h-5" /> Download Image</>}
                                </button>
                                <button
                                    onClick={handleCopyLink}
                                    className="flex items-center gap-3 bg-gray-800 text-white px-8 py-4 rounded-2xl font-black uppercase italic tracking-wider hover:bg-gray-700 transition-all border border-white/5"
                                >
                                    {copied ? <><Check className="w-5 h-5 text-green-400" /> Copied!</> : <><Copy className="w-5 h-5" /> Copy Link</>}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="max-w-xl mx-auto py-12 space-y-8">
                            <div className="text-center">
                                <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/10">
                                    <QrCode className="w-8 h-8 text-purple-400" />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-tight">Direct Share Link</h3>
                                <p className="text-gray-400">Share this link with anyone to give them instant read-only access to this {type}.</p>
                            </div>

                            <div className="bg-black/60 border border-white/10 p-2 rounded-2xl flex items-center gap-4">
                                <div className="flex-1 px-4 text-purple-300 font-mono text-sm truncate">
                                    {shareUrl}
                                </div>
                                <button
                                    onClick={handleCopyLink}
                                    className="bg-purple-600 hover:bg-purple-500 text-white p-4 rounded-xl shadow-lg transition-colors"
                                >
                                    <Copy className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <SocialButton
                                    icon="twitter"
                                    label="Twitter / X"
                                    onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out this ${type} on MTG Forge!`)}&url=${encodeURIComponent(shareUrl)}`, '_blank')}
                                />
                                <SocialButton
                                    icon="facebook"
                                    label="Facebook"
                                    onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank')}
                                />
                                <SocialButton
                                    icon="reddit"
                                    label="Reddit"
                                    onClick={() => window.open(`https://www.reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(`My MTG Forge ${type}`)}`, '_blank')}
                                />
                                <SocialButton
                                    icon="discord"
                                    label="Copy for Discord"
                                    onClick={handleCopyLink}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Helper Social Button
const SocialButton = ({ icon, label, onClick }) => (
    <button
        onClick={onClick}
        className="flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl py-4 transition-all group"
    >
        <span className="text-gray-400 group-hover:text-white font-bold text-sm tracking-wide">{label}</span>
    </button>
);

export default SocialShareHub;
