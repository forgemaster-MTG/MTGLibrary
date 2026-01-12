import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * ReferralTracker captures the 'ref' query parameter from the URL
 * and stores it in localStorage for later use during registration.
 */
const ReferralTracker = () => {
    const location = useLocation();

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const referralCode = params.get('ref');

        if (referralCode) {
            console.log('[ReferralTracker] Capturing referral code:', referralCode);
            localStorage.setItem('mtg_forge_ref', referralCode);

            // Optional: Remove ref from URL to keep it clean (without reloading)
            // window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, [location]);

    return null; // This component doesn't render anything
};

export default ReferralTracker;
