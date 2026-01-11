import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import Webcam from 'react-webcam';
import { createWorker } from 'tesseract.js';
import { Camera, RefreshCw, Check, AlertCircle, Smartphone, Wifi, WifiOff } from 'lucide-react';
import { io } from 'socket.io-client';
import { api } from '../services/api';

const RemoteLensPage = () => {
    const { sessionId } = useParams();
    const [status, setStatus] = useState('connecting'); // connecting | ready | error
    const [socket, setSocket] = useState(null);
    const [scannedHistory, setScannedHistory] = useState([]);

    // OCR State
    const webcamRef = useRef(null);
    const canvasRef = useRef(null);
    const [worker, setWorker] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isWorkerReady, setIsWorkerReady] = useState(false);
    const [lastDetection, setLastDetection] = useState(null);

    // Initialize Socket
    useEffect(() => {
        const s = io();
        setSocket(s);

        s.on('connect', () => {
            console.log('Connected to Forge Bridge');
            s.emit('join-pairing', sessionId);
            setStatus('ready');
        });

        s.on('disconnect', () => {
            console.log('Disconnected');
            setStatus('error');
        });

        return () => s.disconnect();
    }, [sessionId]);

    // Initialize Tesseract Worker
    useEffect(() => {
        let activeWorker = null;
        const init = async () => {
            try {
                console.log("[OCR] Initializing Tesseract (Remote)...");
                const w = await createWorker('eng', 1, {
                    workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js',
                    corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core.wasm.js',
                });
                console.log("[OCR] Worker Ready");
                activeWorker = w;
                setWorker(w);
                setIsWorkerReady(true);
            } catch (err) {
                console.error("OCR Worker Init Failed", err || "Unknown Error");
            }
        };
        init();

        return () => {
            if (activeWorker) activeWorker.terminate();
        };
    }, []);

    const captureAndProcess = async () => {
        if (!isWorkerReady || isProcessing || !webcamRef.current) return;

        setIsProcessing(true);
        try {
            const imageSrc = webcamRef.current.getScreenshot();
            if (!imageSrc) return;

            const image = new Image();
            image.src = imageSrc;
            await new Promise(r => image.onload = r);

            const results = await processRegions(image);
            if (results.name) {
                await resolveAndPush(results);
            } else {
                setLastDetection({ error: "Blurry scan. try again." });
            }
        } catch (err) {
            console.error("Processing error", err);
        } finally {
            setIsProcessing(false);
            setTimeout(() => setLastDetection(null), 2000);
        }
    };

    const processRegions = async (image) => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        const extractText = async (x, y, w, h) => {
            let scale = 250 / h;
            scale = Math.max(0.1, Math.min(scale, 4));

            let finalW = Math.floor(w * scale);
            let finalH = Math.floor(h * scale);

            if (finalW > 4000) {
                scale = 4000 / w;
                finalW = 4000;
                finalH = Math.floor(h * scale);
            }

            console.log(`[RemoteLens] OCR Crop: ${finalW}x${finalH} (Src: ${Math.floor(w)}x${Math.floor(h)})`);

            canvas.width = finalW;
            canvas.height = finalH;

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(image, x, y, w, h, 0, 0, finalW, finalH);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            // Simple Grayscale Conversion (No Binarization)
            for (let i = 0; i < data.length; i += 4) {
                const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
                data[i] = data[i + 1] = data[i + 2] = avg;
            }
            ctx.putImageData(imageData, 0, 0);

            const { data: { text } } = await worker.recognize(canvas);

            const lines = text.split('\n')
                .map(l => l.replace(/[^a-zA-Z0-9\s-·]/g, '').trim()) // Allow dots/midpoints? actually keep simple
                .filter(l => l.length >= 1);
            return lines;
        };

        const iw = image.width;
        const ih = image.height;

        const minDim = Math.min(iw, ih);
        const startX = (iw - minDim) / 2;
        const startY = (ih - minDim) / 2;

        console.log(`[RemoteLens] Precision Mode: ${iw}x${ih}, Crop: ${minDim}x${minDim} @ (${startX}, ${startY})`);

        // Scan Center Band (Footer Only)
        // 80% Width, 30% Height, centered vertically in the square
        const footerLines = await extractText(
            startX + (minDim * 0.1),
            startY + (minDim * 0.35),
            minDim * 0.8,
            minDim * 0.3
        );

        // Parse Footer
        let set = '';
        let cn = '';
        const footerText = footerLines.join(' ').toUpperCase(); // ToUpperCase for safety
        console.log(`[RemoteLens] Raw Scan: "${footerText}"`);

        const potentialNumbers = footerText.match(/\b\d{1,5}[A-Z]?\b/g) || [];
        const validUn = potentialNumbers.filter(n => {
            if (/^(19|20)\d{2}$/.test(n)) return false;
            return true;
        });

        if (validUn.length > 0) cn = validUn[0];

        const setMatches = footerText.match(/\b[A-Z0-9]{3,4}\b/g);
        if (setMatches) {
            const blocklist = ['THE', 'LLC', 'WIZ', 'TM', 'INC', 'COM', 'ART', 'NOT', 'FOR'];
            const languages = ['EN', 'JP', 'FR', 'DE', 'IT', 'CN', 'RU', 'KO', 'ES', 'PT', 'PH'];
            const foundSet = setMatches.find(s => !languages.includes(s) && !blocklist.includes(s) && !/^\d+$/.test(s));
            if (foundSet) set = foundSet;
        }

        return { name: '', set, cn, raw_footer: footerText };
    };

    const pushCardToDesktop = (data, variants, rawOcr) => {
        const cardPayload = {
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
            raw_ocr: rawOcr
        };
        // Emit to desktop
        socket.emit('card-scanned', { sessionId, card: cardPayload });
        // Local history
        setScannedHistory(prev => [cardPayload, ...prev].slice(0, 5));
        setLastDetection({ success: true, name: data.name });
    };

    const resolveAndPush = async ({ name, set, cn, raw_footer }) => {
        console.log(`[RemoteLens] Resolving: Name="${name}", Set="${set}", CN="${cn}"`);

        // 1. PRIORITIZE SET & CN SEARCH
        if (set && cn) {
            console.log(`[RemoteLens] Attempting Set/CN match: ${set} #${cn}`);
            try {
                const resp = await api.post('/api/cards/search', { set, cn });
                if (resp.data && resp.data.length > 0) {
                    const data = resp.data[0];
                    console.log(`[RemoteLens] Match found by Set/CN: ${data.name}`);
                    const variants = resp.data.length > 1 ? resp.data : [data];
                    pushCardToDesktop(data, variants, { name, set, cn });
                    return;
                } else {
                    setLastDetection({ error: `Not Found: ${set} #${cn}` });
                    return;
                }
            } catch (err) {
                console.warn("[RemoteLens] Set/CN search failed", err);
            }
        }

        if (!name || name.length < 3) {
            setLastDetection({ error: "Try scanning Set Code & Number again." });
            return;
        }

        console.log(`[RemoteLens] Attempting Name search: "${name}"`);
        try {
            const resp = await api.post('/api/cards/search', { query: name });
            const localCards = resp.data || [];

            if (localCards.length > 0) {
                const data = localCards[0];
                const variants = localCards.length > 1 ? localCards : [data];
                pushCardToDesktop(data, variants, { name, set, cn });
                return;
            } else {
                console.log(`[RemoteLens] No direct match for "${name}". Trying fuzzy fallback...`);
                // FALLBACK: Try first word OR first 8 characters for long words
                const words = name.split(/\s+/).filter(w => w.length > 3);
                let fallbackQuery = null;
                if (words.length > 0 && words[0].length < name.length) {
                    fallbackQuery = words[0];
                } else if (name.length > 8) {
                    fallbackQuery = name.substring(0, 8);
                }

                if (fallbackQuery) {
                    console.log(`[RemoteLens] Fuzzy fallback attempt with: "${fallbackQuery}"`);
                    const fallbackResp = await api.post('/api/cards/search', { query: fallbackQuery });
                    if (fallbackResp.data?.length > 0) {
                        const data = fallbackResp.data[0];
                        console.log(`[RemoteLens] Fuzzy match found: "${data.name}"`);

                        const matchDetected = name.toLowerCase().includes(data.name.toLowerCase());
                        const matchResult = data.name.toLowerCase().includes(fallbackQuery.toLowerCase());

                        if (matchDetected || matchResult) {
                            console.log(`[RemoteLens] Fallback match accepted: "${data.name}"`);
                            const variants = fallbackResp.data.length > 1 ? fallbackResp.data : [data];
                            pushCardToDesktop(data, variants, { name, set, cn });
                            return;
                        }
                    }
                }
                setLastDetection({ error: `Not found: ${name}` });
            }
        } catch (err) {
            console.error("[RemoteLens] Search failed", err);
            setLastDetection({ error: "Search failed" });
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-950 flex flex-col items-center justify-between p-6 text-white overflow-hidden">
            {/* Header */}
            <div className="w-full flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-indigo-400" />
                    <h1 className="font-black italic uppercase text-lg">Forge Remote</h1>
                </div>
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${status === 'ready' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                    {status === 'ready' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                    {status === 'ready' ? 'Paired' : 'Connecting...'}
                </div>
            </div>

            {/* Scanner View */}
            <div className="relative w-full aspect-[3/4] max-h-[60vh] rounded-3xl overflow-hidden border-2 border-white/10 shadow-2xl bg-black">
                <Webcam
                    ref={webcamRef}
                    audio={false}
                    screenshotFormat="image/webp"
                    videoConstraints={{ facingMode: "environment" }}
                    className="w-full h-full object-cover brightness-110 contrast-125"
                />

                {/* Overlay Brackets */}
                <div className="absolute inset-4 border-2 border-white/5 rounded-2xl pointer-events-none">
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-indigo-500 rounded-tl-xl" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-indigo-500 rounded-tr-xl" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-indigo-500 rounded-bl-xl" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-indigo-500 rounded-br-xl" />

                    {/* Feedback */}
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full px-8">
                        {isProcessing ? (
                            <div className="bg-indigo-600 text-white text-xs py-2 rounded-full font-black text-center animate-pulse">
                                ANALYZING...
                            </div>
                        ) : lastDetection?.success ? (
                            <div className="bg-green-600 text-white text-xs py-2 rounded-full font-black text-center flex items-center justify-center gap-2">
                                <Check className="w-4 h-4" /> {lastDetection.name} SENT!
                            </div>
                        ) : lastDetection?.error ? (
                            <div className="bg-red-600 text-white text-xs py-2 rounded-full font-black text-center">
                                {lastDetection.error}
                            </div>
                        ) : (
                            <div className="bg-black/60 backdrop-blur-md text-white/60 text-[10px] py-2 rounded-full text-center uppercase font-bold tracking-widest">
                                Center Card & Tap
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="w-full flex flex-col items-center gap-6">
                <button
                    onClick={captureAndProcess}
                    disabled={isProcessing || !isWorkerReady}
                    className="w-24 h-24 bg-indigo-600 rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-all border-4 border-white/5"
                >
                    {isProcessing ? <RefreshCw className="w-10 h-10 animate-spin" /> : <Camera className="w-10 h-10" />}
                </button>

                {/* Scanned Mini List */}
                <div className="w-full h-20 flex gap-3 overflow-x-auto pb-2 scroll-smooth">
                    {scannedHistory.map((card, i) => (
                        <div key={i} className="flex-shrink-0 w-12 h-16 rounded-lg overflow-hidden border border-white/10 relative group">
                            <img src={card.image} className="w-full h-full object-cover" alt="" />
                            <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Check className="w-4 h-4 text-white" />
                            </div>
                        </div>
                    ))}
                    {scannedHistory.length === 0 && (
                        <div className="w-full flex items-center justify-center text-gray-700 font-bold uppercase text-[10px] tracking-widest border border-dashed border-gray-800 rounded-2xl">
                            Awaiting Scans...
                        </div>
                    )}
                </div>
            </div>

            {/* Hidden Canvas */}
            <canvas ref={canvasRef} className="hidden" />
        </div>
    );
};

export default RemoteLensPage;
