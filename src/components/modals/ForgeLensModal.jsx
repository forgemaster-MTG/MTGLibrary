import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Webcam from 'react-webcam';
import { createWorker } from 'tesseract.js';
import { X, Camera, RefreshCw, Check, AlertCircle, Layers, Trash2, Edit3, ChevronDown, Smartphone, QrCode, Upload, Lock, Heart } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../services/api'; // Use internal API service
import { io } from 'socket.io-client';
import QRCode from "react-qr-code";
import { useAuth } from '../../contexts/AuthContext';
import { TIERS, getTierConfig } from '../../config/tiers';

const ForgeLensModal = ({ isOpen, onClose, onFinish, mode = 'collection' }) => {
    const { addToast } = useToast();
    const { userProfile } = useAuth();
    const tierConfig = getTierConfig(userProfile?.subscription_tier);

    // UI State
    const [view, setView] = useState('scanning'); // scanning | review
    const [isDesktop, setIsDesktop] = useState(window.innerWidth > 768);

    // OCR & Camera State
    const webcamRef = useRef(null);
    const canvasRef = useRef(null);
    const fileInputRef = useRef(null);
    const [worker, setWorker] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isWorkerReady, setIsWorkerReady] = useState(false);

    // Scanned Data
    const [scannedCards, setScannedCards] = useState([]);
    const [lastDetection, setLastDetection] = useState(null);

    // Remote Mode State
    const [isRemoteMode, setIsRemoteMode] = useState(false);
    const [sessionId] = useState(() => Math.random().toString(36).substr(2, 9));
    const [isRemoteConnected, setIsRemoteConnected] = useState(false);

    // Debugging
    const [isDebugMode, setIsDebugMode] = useState(false);
    const [debugPreviews, setDebugPreviews] = useState({ name: null, footer: null });

    // Initialize Tesseract Worker
    useEffect(() => {
        let activeWorker = null;
        const init = async () => {
            try {
                // Only init worker if we are in local scanning mode
                if (!isRemoteMode) {
                    console.log("[OCR] Initializing Tesseract Worker...");
                    const w = await createWorker('eng', 1, {
                        logger: m => console.log(m),
                        workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js',
                        corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core.wasm.js',
                    });
                    console.log("[OCR] Worker Ready");
                    activeWorker = w;
                    setWorker(w);
                    setIsWorkerReady(true);
                }
            } catch (err) {
                console.error("OCR Worker Init Failed", err || "Unknown Error");
                addToast("Failed to initialize OCR engine. Check console.", "error");
            }
        };
        if (isOpen) init();

        return () => {
            if (activeWorker) {
                activeWorker.terminate();
            }
        };
    }, [isOpen, isRemoteMode]);

    // WebSocket Integration
    useEffect(() => {
        if (!isOpen) return;

        const socket = io();
        socket.emit('join-pairing', sessionId);

        socket.on('remote-card', (card) => {
            console.log("Card received from remote:", card.name);
            setScannedCards(prev => [...prev, card]);
            setLastDetection({ success: true, name: card.name });
            setIsRemoteConnected(true);

            // Auto-clear success message
            setTimeout(() => setLastDetection(null), 2000);
        });

        return () => socket.disconnect();
    }, [isOpen, sessionId]);

    // Track window size for desktop warning
    useEffect(() => {
        const handleResize = () => setIsDesktop(window.innerWidth > 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // --- OCR Logic ---

    const processImageSource = async (imageSrc) => {
        if (!isWorkerReady || isProcessing) return;

        console.log("[ForgeLens] Processing new image source...");
        setIsProcessing(true);
        try {
            if (!imageSrc) {
                console.warn("[ForgeLens] No image source provided.");
                return;
            }

            // 1. Create temporary canvas to crop ROI
            const image = new Image();
            image.src = imageSrc;
            await new Promise(r => image.onload = r);
            console.log(`[ForgeLens] Image loaded: ${image.width}x${image.height}`);

            const results = await processRegions(image);
            console.log("[ForgeLens] Region extraction complete:", results);

            if (results.name) {
                await resolveCard(results);
            } else {
                console.warn("[ForgeLens] No card name detected in regions.");
                setLastDetection({ error: "No card name detected. Try better lighting or a clearer image." });
            }
        } catch (err) {
            console.error("[ForgeLens] Processing error", err);
            setLastDetection({ error: "Processing failed. Invalid image format?" });
        } finally {
            setIsProcessing(false);
            // Clear detection status after 3 seconds
            setTimeout(() => setLastDetection(null), 3000);
        }
    };

    const captureAndProcess = async () => {
        if (!webcamRef.current) return;
        const imageSrc = webcamRef.current.getScreenshot();
        await processImageSource(imageSrc);
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const imageSrc = event.target.result;
            await processImageSource(imageSrc);
            // Reset input so the same file can be uploaded again if needed
            e.target.value = '';
        };
        reader.readAsDataURL(file);
    };

    const addCardToHistory = useCallback((data, variants, rawOcr) => {
        const newCard = {
            id: Math.random().toString(36).substr(2, 9),
            scryfall_id: data.scryfall_id || data.uuid,
            name: data.name,
            set_name: data.set_name || data.setcode,
            set_code: data.set || data.setcode,
            collector_number: data.collector_number || data.number,
            image: data.image_uri || data.image_uris?.small || data.card_faces?.[0]?.image_uris?.small,
            finish: 'nonfoil',
            quantity: 1,
            data: data,
            variants: variants,
            raw_ocr: rawOcr,
            is_wishlist: false
        };

        // Feature Gate: If batchScan is disabled, only keep the latest card
        setScannedCards(prev => tierConfig.features.batchScan ? [...prev, newCard] : [newCard]);
        setLastDetection({ success: true, name: data.name });
    }, [tierConfig.features.batchScan]);

    const processRegions = async (image) => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        // Helper to extract text from a specific rectangle
        const extractText = async (x, y, w, h) => {
            // Smart Scaling: Target a height of ~250px for the OCR block
            // This is the "Goldilocks" zone for Tesseract's line segmenter.
            let scale = 250 / h;

            // Safety: Keep scale within [0.1x, 4x] and cap total width at 4000px
            scale = Math.max(0.1, Math.min(scale, 4));

            let finalW = Math.floor(w * scale);
            let finalH = Math.floor(h * scale);

            if (finalW > 4000) {
                scale = 4000 / w;
                finalW = 4000;
                finalH = Math.floor(h * scale);
            }

            console.log(`[ForgeLens] OCR Crop: ${finalW}x${finalH} (Src: ${Math.floor(w)}x${Math.floor(h)}, Scale: ${scale.toFixed(2)})`);

            canvas.width = finalW;
            canvas.height = finalH;

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(image, x, y, w, h, 0, 0, finalW, finalH);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            // Adaptive Inversion: Only invert if background is dark
            let total = 0;
            for (let i = 0; i < data.length; i += 4) {
                total += (data[i] + data[i + 1] + data[i + 2]) / 3;
            }
            const avgRegion = total / (data.length / 4);
            const reverse = avgRegion < 110; // Dark background threshold

            for (let i = 0; i < data.length; i += 4) {
                const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
                let val = avg > (reverse ? avgRegion * 1.15 : avgRegion * 0.85) ? 255 : 0;
                if (reverse) val = 255 - val;
                data[i] = data[i + 1] = data[i + 2] = val;
            }
            ctx.putImageData(imageData, 0, 0);

            // Recognize directly from canvas (faster/memory efficient)
            const { data: { text } } = await worker.recognize(canvas);


            const lines = text.split('\n')
                .map(l => l.replace(/[^a-zA-Z0-9\s-·]/g, '').trim())
                .filter(l => l.length >= 1);

            const previewUrl = canvas.toDataURL('image/png');
            return { lines, preview: previewUrl };
        };

        // ROI Coordinates - Optimized for standard MTG frames within a SQUARE viewport
        // Since the UI uses object-cover on a square container, we must crop the source image
        // to its central square to match what the user is seeing/aligning.
        const iw = image.width;
        const ih = image.height;

        const minDim = Math.min(iw, ih);
        const startX = (iw - minDim) / 2;
        const startY = (ih - minDim) / 2;

        // ROI Relative to the Central Square
        // We assume the user fits the card mostly within this square.
        // Magic cards are 63x88mm (~0.71 aspect). width is smaller than height.
        // If they fit the height, the width will be ~70% of the square.

        // Name: Top 5-15% of the square
        // We scan a bit wide to catch it if they are close
        const nameResult = await extractText(
            startX + (minDim * 0.1),  // X: 10% in (centered-ish)
            startY + (minDim * 0.04), // Y: Near top (4% down)
            minDim * 0.8,             // W: 80% width
            minDim * 0.12             // H: ~12% height
        );

        // Footer: Bottom 10% of the square
        const footerResult = await extractText(
            startX + (minDim * 0.15), // X: 15% in
            startY + (minDim * 0.82), // Y: Near bottom (82% down)
            minDim * 0.7,             // W: 70% width
            minDim * 0.12             // H: ~12% height
        );

        setDebugPreviews({ name: nameResult.preview, footer: footerResult.preview });

        // Parse Name (take first line)
        const nameText = nameResult.lines[0] || '';

        // Parse Footer (look for Set Code and Collector Number)
        let set = '';
        let cn = '';

        const footerText = footerResult.lines.join(' ');

        // Collector Number: usually 1-4 digits
        const cnMatch = footerText.match(/\b\d{1,4}\b/);
        if (cnMatch) cn = cnMatch[0];

        // Set Code: 3-4 uppercase characters (e.g. MH2, MH3, EN)
        const setMatches = footerText.match(/\b[A-Z0-9]{3,4}\b/g);
        if (setMatches) {
            const languages = ['EN', 'JP', 'FR', 'DE', 'IT', 'CN', 'RU', 'KO', 'ES', 'PT', 'PH'];
            const foundSet = setMatches.find(s => !languages.includes(s) && !/^\d+$/.test(s));
            if (foundSet) set = foundSet;
        }

        return { name: nameText, set, cn, raw_footer: footerText };
    };

    const resolveCard = async ({ name, set, cn, raw_footer }) => {
        console.log(`[ForgeLens] Resolving: Name="${name}", Set="${set}", CN="${cn}" (Footer: "${raw_footer}")`);

        // 1. PRIORITIZE SET & CN SEARCH
        if (set && cn) {
            console.log(`[ForgeLens] Attempting Set/CN match: ${set} #${cn}`);
            try {
                const resp = await api.post('/api/cards/search', { set, cn });
                if (resp.data && resp.data.length > 0) {
                    const data = resp.data[0];
                    console.log(`[ForgeLens] Match found by Set/CN: ${data.name}`);
                    const variants = resp.data.length > 1 ? resp.data : [data];
                    addCardToHistory(data, variants, { name, set, cn });
                    return;
                }
            } catch (err) {
                console.warn("[ForgeLens] Set/CN search failed, falling back to name", err);
            }
        }

        // 2. FALLBACK TO NAME SEARCH
        if (!name || name.length < 3) {
            setLastDetection({ error: "No readable name or set info." });
            return;
        }

        console.log(`[ForgeLens] Attempting Name search: "${name}"`);
        try {
            const resp = await api.post('/api/cards/search', { query: name });
            const localCards = resp.data || [];

            if (localCards.length > 0) {
                const data = localCards[0];
                const variants = localCards.length > 1 ? localCards : [data];
                addCardToHistory(data, variants, { name, set, cn });
                return;
            } else {
                console.log(`[ForgeLens] No direct match for "${name}". Trying fuzzy fallback...`);
                // FALLBACK: Try first word OR first 8 characters for long words
                const words = name.split(/\s+/).filter(w => w.length > 3);
                let fallbackQuery = null;
                if (words.length > 0 && words[0].length < name.length) {
                    fallbackQuery = words[0];
                } else if (name.length > 8) {
                    fallbackQuery = name.substring(0, 8);
                }

                if (fallbackQuery) {
                    console.log(`[ForgeLens] Fuzzy fallback attempt with: "${fallbackQuery}"`);
                    const fallbackResp = await api.post('/api/cards/search', { query: fallbackQuery });
                    if (fallbackResp.data?.length > 0) {
                        const data = fallbackResp.data[0];
                        console.log(`[ForgeLens] Fuzzy match found: "${data.name}"`);

                        const matchDetected = name.toLowerCase().includes(data.name.toLowerCase());
                        const matchResult = data.name.toLowerCase().includes(fallbackQuery.toLowerCase());

                        if (matchDetected || matchResult) {
                            console.log(`[ForgeLens] Fallback match accepted: "${data.name}"`);
                            const variants = fallbackResp.data.length > 1 ? fallbackResp.data : [data];
                            addCardToHistory(data, variants, { name, set, cn });
                            return;
                        }
                    }
                }
                setLastDetection({ error: `Not found: ${name}` });
            }
        } catch (err) {
            console.error("[ForgeLens] Resolution failed", err);
            setLastDetection({ error: "Search failed" });
        }
    };

    // --- Actions ---

    const removeCard = (id) => {
        setScannedCards(prev => prev.filter(c => c.id !== id));
    };

    const updateCard = (id, updates) => {
        setScannedCards(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    };

    const handleSwitchVariant = (cardId, newVariantId) => {
        setScannedCards(prev => prev.map(c => {
            if (c.id === cardId) {
                const variant = c.variants.find(v => v.id === newVariantId);
                if (variant) {
                    return {
                        ...c,
                        scryfall_id: variant.id,
                        set_name: variant.set_name,
                        set_code: variant.set,
                        collector_number: variant.collector_number,
                        image: variant.image_uris?.small || variant.card_faces?.[0]?.image_uris?.small,
                        data: variant
                    };
                }
            }
            return c;
        }));
    };

    const handleConfirmAll = () => {
        if (onFinish) onFinish(scannedCards);
        onClose();
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/95 backdrop-blur-md p-0 md:p-4 animate-fade-in">
            <div className="bg-gray-900 w-full h-full md:max-w-5xl md:max-h-[85vh] md:rounded-3xl shadow-2xl flex flex-col border border-white/10 overflow-hidden relative">

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-[1010] p-2 bg-black/50 text-white rounded-full hover:bg-red-500/50 transition-all"
                >
                    <X className="w-6 h-6" />
                </button>

                {/* Header */}
                <div className="px-4 py-4 md:px-10 md:py-8 border-b border-white/5 flex flex-col md:flex-row justify-between items-center bg-white/5 shrink-0 relative z-10 gap-4 md:gap-0">
                    <div className="flex items-center gap-6 w-full md:w-auto">
                        <div className="w-14 h-14 bg-indigo-500/20 rounded-2xl flex items-center justify-center border border-indigo-500/30 shadow-inner backdrop-blur-sm shrink-0">
                            <Camera className="w-8 h-8 text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-white tracking-tight italic uppercase">Forge Lens</h2>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none">AI Card Scanner</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2 w-full md:w-auto">
                        <div className="flex gap-2">
                            <button
                                onClick={() => setView('scanning')}
                                className={`px-4 py-2 md:py-1.5 rounded-full text-xs font-bold transition-all ${view === 'scanning' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-gray-800 text-gray-400'}`}
                            >
                                Scan
                            </button>
                            <button
                                onClick={() => {
                                    if (tierConfig.features.batchScan || scannedCards.length <= 1) {
                                        setView('review');
                                    } else {
                                        addToast("Batch Review is a Magician+ feature. Upgrade to review all at once!", "info");
                                    }
                                }}
                                className={`px-4 py-2 md:py-1.5 rounded-full text-xs font-bold transition-all relative ${view === 'review' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-gray-800 text-gray-400'}`}
                            >
                                <div className="flex items-center gap-1.5">
                                    {!tierConfig.features.batchScan && <Lock className="w-3 h-3 text-orange-400" />}
                                    Review
                                </div>
                                {scannedCards.length > 0 && (
                                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center animate-bounce">
                                        {scannedCards.length}
                                    </span>
                                )}
                            </button>
                        </div>

                        <button
                            onClick={() => setIsRemoteMode(!isRemoteMode)}
                            className={`flex items-center gap-2 px-3 md:px-4 py-2 md:py-1.5 rounded-full text-xs font-bold transition-all ${isRemoteMode ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'bg-gray-800 text-gray-400'}`}
                            title="Remote Camera"
                        >
                            <Smartphone className="w-4 h-4" />
                            <span className="hidden md:inline">{isRemoteMode ? 'Remote Lens Active' : 'Use Remote Camera'}</span>
                        </button>

                        <button
                            onClick={() => setIsDebugMode(!isDebugMode)}
                            className={`flex items-center gap-2 px-3 md:px-4 py-2 md:py-1.5 rounded-full text-xs font-bold transition-all ${isDebugMode ? 'bg-orange-600/20 text-orange-400 border border-orange-500/30' : 'bg-gray-800 text-gray-400'}`}
                            title="Debug Regions"
                        >
                            <AlertCircle className="w-4 h-4" />
                            <span className="hidden md:inline">Debug Regions</span>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden relative">

                    {/* Mode: SCANNING */}
                    {view === 'scanning' && (
                        <div className="h-full flex flex-col items-center justify-center p-6 relative">
                            {/* Desktop Warning */}
                            {isDesktop && (
                                <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 w-fit">
                                    <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 px-4 py-2 rounded-2xl flex items-center gap-2 text-xs shadow-xl backdrop-blur-md animate-pulse">
                                        <AlertCircle className="w-4 h-4" />
                                        <span>Desktop detected. For best focus, use the mobile app.</span>
                                    </div>
                                </div>
                            )}

                            <div className="relative w-full max-w-sm aspect-[3/4] rounded-3xl overflow-hidden border-2 border-dashed border-white/20 shadow-2xl bg-black group transition-all">
                                {/* Camera Feed */}
                                <Webcam
                                    ref={webcamRef}
                                    audio={false}
                                    screenshotFormat="image/webp"
                                    videoConstraints={{
                                        width: 1280,
                                        height: 720,
                                        facingMode: "environment"
                                    }}
                                    className="w-full h-full object-cover grayscale brightness-110 contrast-125"
                                />

                                {/* Overlays */}
                                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                                    {/* Region Guides */}
                                    <div className="w-[85%] h-[90%] border-2 border-white/10 rounded-2xl relative">
                                        {/* Corner Brackets */}
                                        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-indigo-500 rounded-tl-xl" />
                                        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-indigo-500 rounded-tr-xl" />
                                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-indigo-500 rounded-bl-xl" />
                                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-indigo-500 rounded-br-xl" />

                                        {/* Status Text Bar */}
                                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-3/4 text-center">
                                            {!isWorkerReady ? (
                                                <div className="bg-black/80 text-white text-[10px] px-3 py-1 rounded-full border border-white/10 flex items-center gap-2">
                                                    <RefreshCw className="w-3 h-3 animate-spin" /> Wake up AI engine...
                                                </div>
                                            ) : isProcessing ? (
                                                <div className="bg-indigo-600 text-white text-[10px] px-4 py-1.5 rounded-full shadow-lg animate-pulse uppercase font-black">
                                                    Analyzing Image...
                                                </div>
                                            ) : lastDetection?.success ? (
                                                <div className="bg-green-600 text-white text-[10px] px-4 py-1.5 rounded-full shadow-lg uppercase font-black flex items-center gap-2">
                                                    <Check className="w-3 h-3" /> Found: {lastDetection.name}
                                                </div>
                                            ) : lastDetection?.error ? (
                                                <div className="bg-red-600 text-white text-[10px] px-4 py-1.5 rounded-full shadow-lg uppercase font-black">
                                                    {lastDetection.error}
                                                </div>
                                            ) : (
                                                <p className="text-white/60 text-[10px] px-3 py-1 bg-black/40 rounded-full backdrop-blur-sm">Align Card & Snapshot</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Controls */}
                            <div className="mt-8 flex items-center gap-6">
                                {isRemoteMode ? (
                                    <div className="flex flex-col items-center gap-6 animate-fade-in">
                                        <div className="bg-white p-4 rounded-3xl shadow-2xl">
                                            <QRCode
                                                value={`${window.location.origin}/remote/${sessionId}`}
                                                size={180}
                                                level="H"
                                            />
                                        </div>
                                        <div className="text-center max-w-xs">
                                            <h3 className="text-white font-bold mb-1">Scan this QR on your phone</h3>
                                            <p className="text-[10px] text-gray-500 uppercase tracking-widest leading-relaxed">
                                                Your phone will act as a remote scanner and push cards directly to this desk.
                                            </p>
                                        </div>
                                        {isRemoteConnected && (
                                            <div className="flex items-center gap-2 bg-green-500/10 text-green-400 px-4 py-2 rounded-full text-[10px] font-black uppercase border border-green-500/30 animate-bounce">
                                                <Smartphone className="w-4 h-4" />
                                                Phone Linked!
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <button
                                        onClick={captureAndProcess}
                                        disabled={isProcessing || !isWorkerReady}
                                        className="w-20 h-20 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded-full flex items-center justify-center shadow-2xl shadow-indigo-500/30 transition-all active:scale-90 relative group ring-4 ring-white/5"
                                    >
                                        {isProcessing ? <RefreshCw className="w-8 h-8 animate-spin" /> : <Camera className="w-8 h-8" />}
                                        <span className="absolute -bottom-10 whitespace-nowrap text-[10px] font-black uppercase tracking-widest text-gray-500 group-hover:text-indigo-400 transition-colors">Capture Card</span>
                                    </button>
                                )}

                                {isDebugMode && debugPreviews.name && (
                                    <div className="flex flex-col gap-2 p-3 bg-black/40 rounded-2xl border border-orange-500/20">
                                        <div className="text-[10px] font-black uppercase text-orange-400 tracking-widest flex items-center gap-2">
                                            <AlertCircle className="w-3 h-3" />
                                            ROI Crops
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <div className="relative group">
                                                <img src={debugPreviews.name} className="h-8 w-full object-contain bg-white rounded border border-white/10" alt="Name" />
                                                <div className="absolute top-0 right-0 bg-black/60 text-white text-[8px] px-1 rounded-bl">Name</div>
                                            </div>
                                            <div className="relative group">
                                                <img src={debugPreviews.footer} className="h-8 w-full object-contain bg-white rounded border border-white/10" alt="Footer" />
                                                <div className="absolute top-0 right-0 bg-black/60 text-white text-[8px] px-1 rounded-bl">Footer</div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {!isRemoteMode && (
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isProcessing || !isWorkerReady}
                                        className="w-14 h-14 bg-gray-800 hover:bg-gray-700 disabled:text-gray-600 text-gray-400 rounded-2xl flex items-center justify-center border border-white/5 transition-all active:scale-90 relative group"
                                        title="Upload Image"
                                    >
                                        <Upload className="w-6 h-6" />
                                        <span className="absolute -bottom-10 whitespace-nowrap text-[10px] font-black uppercase tracking-widest text-gray-600 group-hover:text-indigo-400 transition-colors">Upload File</span>
                                    </button>
                                )}
                            </div>

                            {/* Hidden File Input */}
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                accept="image/*"
                                className="hidden"
                            />
                        </div>
                    )}

                    {/* Mode: REVIEW */}
                    {view === 'review' && (
                        <div className="h-full flex flex-col bg-gray-950/50">
                            {scannedCards.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                                    <div className="w-20 h-20 bg-gray-800 rounded-3xl flex items-center justify-center text-gray-600 mb-4">
                                        <Layers className="w-10 h-10" />
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-2">No Cards Scanned</h3>
                                    <p className="text-gray-500 text-sm max-w-xs">Return to the scan view and aim your camera at a card to get started.</p>
                                    <button
                                        onClick={() => setView('scanning')}
                                        className="mt-6 px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold"
                                    >
                                        Go Back to Scan
                                    </button>
                                </div>
                            ) : (
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-0 md:p-6">
                                    <table className="w-full text-left border-separate border-spacing-y-2">
                                        <thead className="hidden md:table-header-group">
                                            <tr className="text-[10px] uppercase font-bold tracking-[0.2em] text-gray-500">
                                                <th className="px-6 py-2">Card Detail</th>
                                                <th className="px-6 py-2">Set / #</th>
                                                <th className="px-6 py-2">Finish</th>
                                                <th className="px-6 py-2">Qty</th>
                                                <th className="px-6 py-2 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="space-y-4">
                                            {scannedCards.map((card) => (
                                                <tr key={card.id} className="bg-gray-900 border border-white/5 md:border-none rounded-2xl md:rounded-none group hover:bg-white/5 transition-colors">
                                                    <td className="px-4 py-3 md:px-6 md:py-4 flex items-center gap-4">
                                                        <img src={card.image} className="w-12 h-16 object-cover rounded shadow-lg" alt={card.name} />
                                                        <div>
                                                            <div className="text-sm font-bold text-white leading-tight">{card.name}</div>
                                                            <div className="text-[10px] text-gray-500 mt-0.5">{card.set_name}</div>
                                                        </div>
                                                    </td>
                                                    <td className="hidden md:table-cell px-6 py-4">
                                                        <div className="flex flex-col max-w-[200px]">
                                                            <select
                                                                value={card.scryfall_id}
                                                                onChange={(e) => handleSwitchVariant(card.id, e.target.value)}
                                                                className="bg-gray-800 border border-white/10 rounded-lg px-2 py-1 text-xs text-white outline-none focus:ring-1 focus:ring-indigo-500 truncate"
                                                            >
                                                                {card.variants?.map(v => (
                                                                    <option key={v.id} value={v.id}>
                                                                        {v.set.toUpperCase()} #{v.collector_number} ({v.set_name})
                                                                    </option>
                                                                ))}
                                                                {!card.variants?.length && (
                                                                    <option value={card.scryfall_id}>{card.set_code.toUpperCase()} #{card.collector_number}</option>
                                                                )}
                                                            </select>
                                                            <span className="text-[9px] text-gray-600 mt-1 uppercase tracking-tighter">Tap to change version</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 md:px-6 py-4">
                                                        <button
                                                            onClick={() => updateCard(card.id, { finish: card.finish === 'foil' ? 'nonfoil' : 'foil' })}
                                                            className={`text-[10px] px-2 py-1 rounded border transition-all ${card.finish === 'foil' ? 'bg-yellow-500/10 border-yellow-500/50 text-yellow-500 font-bold shadow-[0_0_10px_rgba(234,179,8,0.2)]' : 'bg-gray-800 border-white/5 text-gray-500'}`}
                                                        >
                                                            {card.finish === 'foil' ? '✨ FOIL' : 'NON-FOIL'}
                                                        </button>
                                                    </td>
                                                    <td className="px-4 md:px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => updateCard(card.id, { quantity: Math.max(1, card.quantity - 1) })}
                                                                className="w-6 h-6 rounded bg-gray-800 flex items-center justify-center text-gray-400 hover:text-white"
                                                            >
                                                                -
                                                            </button>
                                                            <span className="text-sm font-bold text-white w-4 text-center">{card.quantity}</span>
                                                            <button
                                                                onClick={() => updateCard(card.id, { quantity: card.quantity + 1 })}
                                                                className="w-6 h-6 rounded bg-gray-800 flex items-center justify-center text-gray-400 hover:text-white"
                                                            >
                                                                +
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 md:px-6 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button
                                                                onClick={() => updateCard(card.id, { is_wishlist: !card.is_wishlist })}
                                                                className={`p-1.5 rounded-lg transition-all ${card.is_wishlist ? 'bg-red-500/10 text-red-500' : 'bg-gray-800/50 text-gray-500 hover:text-red-400'}`}
                                                                title={card.is_wishlist ? "Remove from Wishlist" : "Add to Wishlist"}
                                                            >
                                                                <Heart className={`w-4 h-4 ${card.is_wishlist ? 'fill-current' : ''}`} />
                                                            </button>
                                                            <button
                                                                onClick={() => removeCard(card.id)}
                                                                className="p-1.5 text-gray-600 hover:text-red-500 transition-colors"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/5 bg-gray-900/80 flex justify-between items-center">
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em]">
                        {scannedCards.length} Cards in Batch
                    </p>

                    <div className="flex gap-2">
                        {scannedCards.length > 0 && view === 'scanning' && (
                            <button
                                onClick={() => setView('review')}
                                className="px-6 py-2 text-gray-400 hover:text-white font-bold text-xs"
                            >
                                Review All
                            </button>
                        )}
                        <button
                            onClick={handleConfirmAll}
                            disabled={scannedCards.length === 0}
                            className={`px-10 py-3 rounded-2xl font-black text-sm transition-all shadow-xl active:scale-95 flex items-center gap-2 ${scannedCards.length > 0 ? 'bg-indigo-600 text-white shadow-indigo-900/40' : 'bg-gray-800 text-gray-600 cursor-not-allowed'}`}
                        >
                            <Check className="w-4 h-4" /> {mode === 'audit' ? 'Apply to Audit' : 'Add to Collection'}
                        </button>
                    </div>
                </div>

                {/* Hidden Canvas for Cropping */}
                <canvas ref={canvasRef} style={{ display: 'none' }} />
            </div>
        </div>,
        document.body
    );
};

export default ForgeLensModal;
