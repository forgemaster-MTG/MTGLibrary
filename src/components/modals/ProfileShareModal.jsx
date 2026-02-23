import React, { useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { X, Download, Share2, Copy, Check, CreditCard, User, ExternalLink, AlertTriangle } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { toPng } from 'html-to-image';
import ArchetypeBadge from '../profile/ArchetypeBadge';

const ProfileShareModal = ({ isOpen, onClose, profile, archetype, decksCount }) => {
    const { userProfile } = useAuth();
    const [activeTab, setActiveTab] = useState('share'); // 'share' or 'business'
    const [copied, setCopied] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    const shareCardRef = useRef(null);
    const businessCardFrontPreviewRef = useRef(null);
    const businessCardBackPreviewRef = useRef(null);
    const businessCardFrontHiddenRef = useRef(null);
    const businessCardBackHiddenRef = useRef(null);
    const businessCardCombinedRef = useRef(null);

    if (!isOpen || !profile) return null;

    const profileUrl = `${window.location.origin}/profile/${profile.id}`;

    const handleCopyLink = () => {
        navigator.clipboard.writeText(profileUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const downloadPng = async (ref, fileName) => {
        if (!ref.current) return;
        setIsGenerating(true);
        try {
            const dataUrl = await toPng(ref.current, { cacheBust: true, pixelRatio: 2 });
            const link = document.createElement('a');
            link.download = `${fileName}.png`;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.error('Download failed:', err);
        } finally {
            setIsGenerating(false);
        }
    };

    const downloadBusinessCards = async () => {
        setIsGenerating(true);
        try {
            await downloadPng(businessCardFrontHiddenRef, `${profile.username}_BusinessCard_Front`);
            await downloadPng(businessCardBackHiddenRef, `${profile.username}_BusinessCard_Back`);
            await downloadPng(businessCardCombinedRef, `${profile.username}_BusinessCard_Full`);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl overflow-y-auto">
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex items-center justify-between bg-slate-800/50">
                    <div>
                        <h2 className="text-2xl font-black text-white flex items-center gap-2 italic uppercase tracking-wider">
                            <Share2 className="text-primary-500" />
                            Share Your Spark
                        </h2>
                        <p className="text-slate-400 text-sm font-medium">Generate your digital player assets</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-6 h-6 text-slate-400" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex bg-slate-800/30 p-1 mx-6 mt-6 rounded-2xl border border-white/5">
                    <button
                        onClick={() => setActiveTab('share')}
                        className={`flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all ${activeTab === 'share'
                            ? 'bg-primary-600 text-white shadow-lg'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <User className="w-4 h-4" /> Default Share
                    </button>
                    <button
                        onClick={() => setActiveTab('business')}
                        className={`flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all ${activeTab === 'business'
                            ? 'bg-primary-600 text-white shadow-lg'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <CreditCard className="w-4 h-4" /> Business Card
                    </button>
                </div>

                {/* Tab content */}
                <div className="p-8 flex-grow">
                    {activeTab === 'share' ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                            {/* Preview Area */}
                            <div className="flex justify-center">
                                <div
                                    ref={shareCardRef}
                                    className="w-[350px] h-[550px] bg-slate-950 rounded-[32px] overflow-hidden border border-white/10 relative shadow-2xl flex flex-col items-center p-8 text-center"
                                >
                                    {/* Design Elements */}
                                    <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-primary-600/30 to-transparent"></div>
                                    <div className="absolute -top-20 -right-20 w-48 h-48 bg-purple-600/20 rounded-full blur-3xl"></div>
                                    <div className="absolute bottom-20 -left-20 w-48 h-48 bg-primary-600/10 rounded-full blur-3xl"></div>

                                    {/* Forge Logo Branding */}
                                    <div className="relative z-10 w-full flex justify-center mb-6">
                                        <div className="bg-slate-900/80 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
                                            <img src="/logo.png" alt="Forge" className="w-4 h-4" />
                                            <span className="text-[10px] font-black text-white/80 uppercase tracking-[0.2em]">The Forge - MTG</span>
                                        </div>
                                    </div>

                                    {/* Avatar */}
                                    <div className="relative z-10 mb-4 group">
                                        <div className="w-32 h-32 rounded-full p-1 bg-gradient-to-br from-primary-500 to-purple-600">
                                            <div className="w-full h-full rounded-full bg-slate-800 border-4 border-slate-950 overflow-hidden">
                                                {profile.avatar ? (
                                                    <img src={profile.avatar} alt={profile.username} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center"><User className="w-16 h-16 text-slate-600" /></div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Profile Info */}
                                    <div className="relative z-10 mb-6">
                                        <h3 className="text-2xl font-black text-white italic uppercase tracking-tight leading-tight">{profile.username}</h3>
                                        <p className="text-primary-400 text-xs font-bold uppercase tracking-widest mt-1">Planeswalker Athlete</p>
                                    </div>

                                    {/* Archetype */}
                                    <div className="relative z-10 w-full bg-slate-900/50 backdrop-blur-sm rounded-2xl p-4 border border-white/5 mb-6">
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Primary Archetype</p>
                                        <div className="flex justify-center scale-90 origin-center">
                                            <ArchetypeBadge archetype={archetype} />
                                        </div>
                                    </div>

                                    {/* QR Code Section */}
                                    <div className="relative z-10 mt-auto bg-white p-4 rounded-3xl shadow-xl">
                                        <QRCodeCanvas
                                            value={profileUrl}
                                            size={100}
                                            level="H"
                                            includeMargin={false}
                                            imageSettings={{
                                                src: "/logo.png",
                                                x: undefined,
                                                y: undefined,
                                                height: 24,
                                                width: 24,
                                                excavate: true,
                                            }}
                                        />
                                    </div>
                                    <p className="relative z-10 mt-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Scan to view library</p>
                                </div>
                            </div>

                            {/* Options Area */}
                            <div className="space-y-6">
                                <div className="bg-slate-800/40 p-6 rounded-2xl border border-white/5">
                                    <h4 className="font-bold text-white mb-4">Export Options</h4>
                                    <button
                                        onClick={() => downloadPng(shareCardRef, `${profile.username}_PlayerCard`)}
                                        disabled={isGenerating}
                                        className="w-full py-4 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-primary-500/20 flex items-center justify-center gap-3 disabled:opacity-50"
                                    >
                                        <Download className="w-5 h-5" />
                                        {isGenerating ? 'Generating...' : 'Download Share Card'}
                                    </button>
                                </div>

                                <div className="bg-slate-800/40 p-6 rounded-2xl border border-white/5">
                                    <h4 className="font-bold text-white mb-2">Direct Link</h4>
                                    <p className="text-slate-400 text-sm mb-4">Share your public profile URL anywhere</p>
                                    <div className="flex gap-2">
                                        <div className="flex-1 bg-slate-950 rounded-xl px-4 py-3 border border-white/10 text-slate-400 truncate text-sm">
                                            {profileUrl}
                                        </div>
                                        <button
                                            onClick={handleCopyLink}
                                            className="p-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all"
                                        >
                                            {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {/* Business Cards Preview Row */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Front Side */}
                                <div className="space-y-3">
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest text-center">Card Front</p>
                                    <div
                                        ref={businessCardFrontPreviewRef}
                                        className="w-full aspect-[1.75/1] bg-slate-950 rounded-2xl overflow-hidden relative shadow-2xl border border-white/5"
                                    >
                                        <img
                                            src="/MTG-Forge_Logo_Background.png"
                                            alt="Forge Logo Background"
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                </div>

                                {/* Back Side */}
                                <div className="space-y-3">
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest text-center">Card Back</p>
                                    <div
                                        ref={businessCardBackPreviewRef}
                                        className="w-full aspect-[1.75/1] bg-[#1e1b4b] rounded-2xl overflow-hidden relative shadow-2xl p-6 flex flex-col border border-white/10"
                                    >
                                        {/* Background Decoration */}
                                        <div className="absolute top-0 right-0 w-48 h-48 bg-primary-500/10 rounded-full blur-3xl -mr-24 -mt-24"></div>
                                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl -ml-24 -mb-24"></div>
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>

                                        {/* Top Branding Bar */}
                                        <div className="relative z-10 w-full flex items-center justify-center gap-2 pb-2 border-b border-white/5">
                                            <img src="/logo.png" alt="Forge" className="w-4 h-4" />
                                            <span className="inline-block text-[10px] font-black uppercase tracking-[0.3em] italic bg-gradient-to-r from-[#fcd34d] via-[#f59e0b] to-[#b91c1c] bg-clip-text text-transparent pr-4 whitespace-nowrap">
                                                MTG-Forge.com&nbsp;
                                            </span>
                                        </div>

                                        {/* Middle Content Section */}
                                        <div className="flex-1 flex items-center gap-10 py-4 relative z-10">
                                            {/* Left Profile Section */}
                                            <div className="flex flex-col items-center justify-center space-y-3 w-[45%]">
                                                <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-br from-[#f59e0b] via-[#fcd34d] to-[#b91c1c] shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                                                    <div className="w-full h-full rounded-full bg-slate-900 border-2 border-[#1e1b4b] overflow-hidden">
                                                        {profile.avatar ? (
                                                            <img src={profile.avatar} alt={profile.username} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center bg-slate-800"><User className="w-10 h-10 text-slate-400" /></div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-center w-full px-2 max-w-[90%]">
                                                    <h4 className="font-black text-xl uppercase italic tracking-tighter leading-[0.9] bg-gradient-to-b from-[#fcd34d] via-[#f59e0b] to-[#b91c1c] bg-clip-text text-transparent drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] line-clamp-2 pb-1">
                                                        {profile.username}
                                                    </h4>
                                                    <div className="mt-2 text-center flex justify-center w-full">
                                                        <p className="inline-block text-white text-[7px] sm:text-[8px] font-bold uppercase tracking-widest whitespace-nowrap px-1">
                                                            {profile.contact_email || userProfile?.contact_email || 'No Contact Email'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Vertical Divider */}
                                            <div className="h-full w-px bg-gradient-to-b from-transparent via-white/10 to-transparent"></div>

                                            {/* Right QR Section */}
                                            <div className="flex-1 flex flex-col items-center justify-center h-full">
                                                <div className="text-center">
                                                    <p className="text-white/30 text-[6px] font-black uppercase tracking-[0.3em] mb-2">Scan Your Destiny</p>
                                                    <div className="bg-white p-2 rounded-xl shadow-lg border border-[#f59e0b]/20">
                                                        <QRCodeCanvas
                                                            value={profileUrl}
                                                            size={85}
                                                            level="H"
                                                            includeMargin={false}
                                                            imageSettings={{
                                                                src: "/logo.png",
                                                                height: 20,
                                                                width: 20,
                                                                excavate: true,
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Bottom Tagline Bar */}
                                        <div className="relative z-10 w-full pt-2 border-t border-white/5 text-center">
                                            <p className="text-white/40 text-[7px] font-black uppercase tracking-[0.4em] italic leading-none">
                                                Where Decks Become Legends
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Hidden Combined and High-Res Previews for Download */}
                            <div className="absolute opacity-0 pointer-events-none overflow-hidden flex flex-col gap-8">
                                {/* Extra High-Res Front for Individual Download */}
                                <div
                                    ref={businessCardFrontHiddenRef}
                                    className="w-[800px] aspect-[1.75/1] bg-slate-950 rounded-2xl overflow-hidden relative border border-white/5"
                                >
                                    <img src="/MTG-Forge_Logo_Background.png" alt="Card Front" className="w-full h-full object-cover" />
                                </div>

                                {/* Extra High-Res Back for Individual Download */}
                                <div
                                    ref={businessCardBackHiddenRef}
                                    className="w-[800px] aspect-[1.75/1] bg-[#1e1b4b] rounded-2xl overflow-hidden relative p-6 flex flex-col border border-white/10"
                                >
                                    {/* Background Decoration */}
                                    <div className="absolute top-0 right-0 w-48 h-48 bg-primary-500/10 rounded-full blur-3xl -mr-24 -mt-24"></div>
                                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl -ml-24 -mb-24"></div>
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>

                                    {/* Top Branding Bar */}
                                    <div className="relative z-10 w-full flex items-center justify-center gap-4 pb-4 border-b border-white/5">
                                        <img src="/logo.png" alt="Forge" className="w-8 h-8" />
                                        <span className="inline-block text-lg font-black uppercase tracking-[0.3em] italic bg-gradient-to-r from-[#fcd34d] via-[#f59e0b] to-[#b91c1c] bg-clip-text text-transparent pr-8 whitespace-nowrap">
                                            MTG-Forge.com&nbsp;
                                        </span>
                                    </div>

                                    {/* Middle Content Section */}
                                    <div className="flex-1 flex items-center gap-14 py-6 relative z-10">
                                        {/* Left Profile Section */}
                                        <div className="flex flex-col items-center justify-center space-y-4 w-[45%]">
                                            <div className="w-32 h-32 rounded-full p-2 bg-gradient-to-br from-[#f59e0b] via-[#fcd34d] to-[#b91c1c] shadow-[0_0_40px_rgba(245,158,11,0.25)]">
                                                <div className="w-full h-full rounded-full bg-slate-900 border-4 border-[#1e1b4b] overflow-hidden">
                                                    {profile.avatar ? (
                                                        <img src={profile.avatar} alt={profile.username} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center bg-slate-800"><User className="w-16 h-16 text-slate-400" /></div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-center w-full px-2 max-w-[90%]">
                                                <h4 className="font-black text-3xl uppercase italic tracking-tighter leading-[0.85] bg-gradient-to-b from-[#fcd34d] via-[#f59e0b] to-[#b91c1c] bg-clip-text text-transparent drop-shadow-[0_4px_6px_rgba(0,0,0,0.6)] line-clamp-2 pb-1">
                                                    {profile.username}
                                                </h4>
                                                <div className="mt-4 text-center flex justify-center w-full">
                                                    <p className="inline-block text-white text-[9px] sm:text-[10px] font-bold uppercase tracking-widest whitespace-nowrap px-1">
                                                        {profile.contact_email || userProfile?.contact_email || 'No Contact Email'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Vertical Divider */}
                                        <div className="h-full w-px bg-gradient-to-b from-transparent via-white/10 to-transparent"></div>

                                        {/* Right QR Section */}
                                        <div className="flex-1 flex flex-col items-center justify-center h-full">
                                            <div className="text-center">
                                                <p className="text-white/30 text-[8px] font-black uppercase tracking-[0.4em] mb-4 text-center">Scan Your Destiny</p>
                                                <div className="bg-white p-4 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] border-2 border-[#f59e0b]/30">
                                                    <QRCodeCanvas value={profileUrl} size={150} level="H" includeMargin={false} imageSettings={{ src: "/logo.png", height: 35, width: 35, excavate: true }} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Bottom Tagline Bar */}
                                    <div className="relative z-10 w-full pt-4 border-t border-white/5 text-center">
                                        <p className="text-white/40 text-[9px] font-black uppercase tracking-[0.5em] italic leading-none">
                                            Where Decks Become Legends
                                        </p>
                                    </div>
                                </div>

                                {/* Combined High-Res Version */}
                                <div
                                    ref={businessCardCombinedRef}
                                    className="w-[800px] bg-slate-900 p-8 flex flex-col items-center gap-8 rounded-[40px]"
                                >
                                    {/* Front Side */}
                                    <div className="w-full aspect-[1.75/1] bg-slate-950 rounded-2xl overflow-hidden relative border border-white/5">
                                        <img src="/MTG-Forge_Logo_Background.png" alt="Card Front" className="w-full h-full object-cover" />
                                    </div>

                                    {/* Back Side */}
                                    <div className="w-full aspect-[1.75/1] bg-[#1e1b4b] rounded-2xl overflow-hidden relative p-6 flex flex-col border border-white/10">
                                        {/* Background Decoration */}
                                        <div className="absolute top-0 right-0 w-48 h-48 bg-primary-500/10 rounded-full blur-3xl -mr-24 -mt-24"></div>
                                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl -ml-24 -mb-24"></div>
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>

                                        {/* Top Branding Bar */}
                                        <div className="relative z-10 w-full flex items-center justify-center gap-4 pb-4 border-b border-white/5">
                                            <img src="/logo.png" alt="Forge" className="w-8 h-8" />
                                            <span className="inline-block text-lg font-black uppercase tracking-[0.3em] italic bg-gradient-to-r from-[#fcd34d] via-[#f59e0b] to-[#b91c1c] bg-clip-text text-transparent pr-8 whitespace-nowrap">
                                                MTG-Forge.com&nbsp;
                                            </span>
                                        </div>

                                        {/* Middle Content Section */}
                                        <div className="flex-1 flex items-center gap-14 py-6 relative z-10">
                                            {/* Left Profile Section */}
                                            <div className="flex flex-col items-center justify-center space-y-4 w-[45%]">
                                                <div className="w-32 h-32 rounded-full p-2 bg-gradient-to-br from-[#f59e0b] via-[#fcd34d] to-[#b91c1c] shadow-[0_0_40px_rgba(245,158,11,0.25)]">
                                                    <div className="w-full h-full rounded-full bg-slate-900 border-4 border-[#1e1b4b] overflow-hidden">
                                                        {profile.avatar ? (
                                                            <img src={profile.avatar} alt={profile.username} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center bg-slate-800"><User className="w-16 h-16 text-slate-400" /></div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-center w-full px-2 max-w-[90%]">
                                                    <h4 className="font-black text-3xl uppercase italic tracking-tighter leading-[0.85] bg-gradient-to-b from-[#fcd34d] via-[#f59e0b] to-[#b91c1c] bg-clip-text text-transparent drop-shadow-[0_4px_6px_rgba(0,0,0,0.6)] line-clamp-2 pb-1">
                                                        {profile.username}
                                                    </h4>
                                                    <div className="mt-4 text-center flex justify-center w-full">
                                                        <p className="inline-block text-white text-[9px] sm:text-[10px] font-bold uppercase tracking-widest whitespace-nowrap px-1">
                                                            {profile.contact_email || userProfile?.contact_email || 'No Contact Email'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Vertical Divider */}
                                            <div className="h-full w-px bg-gradient-to-b from-transparent via-white/10 to-transparent"></div>

                                            {/* Right QR Section */}
                                            <div className="flex-1 flex flex-col items-center justify-center h-full">
                                                <div className="text-center">
                                                    <p className="text-white/30 text-[8px] font-black uppercase tracking-[0.4em] mb-4 text-center">Scan Your Destiny</p>
                                                    <div className="bg-white p-4 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] border-2 border-[#f59e0b]/30">
                                                        <QRCodeCanvas value={profileUrl} size={150} level="H" includeMargin={false} imageSettings={{ src: "/logo.png", height: 35, width: 35, excavate: true }} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Bottom Tagline Bar */}
                                        <div className="relative z-10 w-full pt-4 border-t border-white/5 text-center">
                                            <p className="text-white/40 text-[9px] font-black uppercase tracking-[0.5em] italic leading-none">
                                                Where Decks Become Legends
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Options Area */}
                            <div className="bg-slate-800/40 p-8 rounded-2xl border border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
                                <div className="space-y-1 text-center md:text-left">
                                    <h4 className="font-bold text-white">Export Package</h4>
                                    <p className="text-slate-400 text-sm">Download high-resolution PNGs for front, back, and combined.</p>
                                </div>
                                <button
                                    onClick={downloadBusinessCards}
                                    disabled={isGenerating}
                                    className="px-10 py-4 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-primary-500/20 flex items-center gap-3 disabled:opacity-50"
                                >
                                    <Download className="w-5 h-5" />
                                    {isGenerating ? 'Generating...' : 'Download Assets'}
                                </button>
                            </div>

                            {/* Email Warning */}
                            {!(profile.contact_email || userProfile?.contact_email) && (
                                <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-center gap-4 animate-pulse">
                                    <AlertTriangle className="w-6 h-6 text-yellow-500 shrink-0" />
                                    <div className="space-y-1">
                                        <p className="text-sm font-bold text-yellow-500 uppercase tracking-wider">Missing Contact Email</p>
                                        <p className="text-xs text-yellow-500/80 leading-relaxed">
                                            Your business card will show "No Contact Email". Visit Account Settings to add one for professional networking.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Tip */}
                <div className="p-6 bg-slate-950/50 flex justify-center border-t border-white/5">
                    <p className="text-[11px] text-slate-500 font-medium italic">Assets generated at 4x resolution for premium print quality.</p>
                </div>
            </div>
        </div>
    );
};

export default ProfileShareModal;
