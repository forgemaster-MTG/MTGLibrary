import React from 'react';

const ImpersonationBanner = () => {
    const impersonateId = localStorage.getItem('impersonate_user_id');

    if (!impersonateId) return null;

    const stopImpersonation = () => {
        localStorage.removeItem('impersonate_user_id');
        window.location.href = '/'; // Hard reload to clear state
    };

    return (
        <div className="bg-amber-600 text-white px-4 py-2 flex justify-between items-center shadow-lg z-50 fixed bottom-0 w-full md:top-0 md:bottom-auto md:sticky">
            <div className="flex items-center gap-2 font-bold animate-pulse">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                <span>VIEW ONLY MODE: Impersonating User #{impersonateId}</span>
            </div>
            <button
                onClick={stopImpersonation}
                className="bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded text-sm font-bold border border-white/50 transition-colors"
            >
                Stop Impersonating
            </button>
        </div>
    );
};

export default ImpersonationBanner;
