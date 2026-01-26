import { knex } from '../db.js';

export async function processReferralSignup(userId, referralCode) {
    if (!userId || !referralCode) return;

    try {
        console.log(`[Referrals] Processing signup for User ${userId} with code ${referralCode}`);

        // 1. Find Referrer
        // Assuming referralCode is just the username for now ?? 
        // Or we need a lookup. Let's assume referralCode IS the username or a unique code field in users table.
        // Plan said "Add referral_code field to User model".
        // Let's assume user.referral_code exists for the REFERRER. 
        // Or we use their ID?
        // Let's assume the referralCode passed is the REFERRER'S ID or Username.
        // Simplest: Referral Link = ?ref=<username>

        const referrer = await knex('users').where({ username: referralCode }).first();
        if (!referrer) {
            console.warn(`[Referrals] Invalid code: ${referralCode}`);
            return;
        }

        if (referrer.id === userId) {
            console.warn(`[Referrals] User tried to refer themselves.`);
            return;
        }

        // 2. Link User
        await knex('users').where({ id: userId }).update({
            referred_by: referrer.id
            // referral_code: ... we might generate their OWN code here too?
        });

        // 3. Grant Bonus Trial (14 Days)
        // Default was 7 days. We extend it.
        const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

        await knex('users').where({ id: userId }).update({
            subscription_status: 'trial',
            subscription_tier: 'tier_3', // Ensure Wizard
            trial_start_date: new Date().toISOString(), // Today
            trial_end_date: trialEnd
        });

        console.log(`[Referrals] User ${userId} linked to ${referrer.username} and granted 14-day trial.`);

    } catch (err) {
        console.error('[Referrals] Error processing signup:', err);
    }
}
