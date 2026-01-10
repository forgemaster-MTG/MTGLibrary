import Stripe from 'stripe';
import dotenv from 'dotenv';
import { knex } from '../db.js';

dotenv.config();

let stripe;
if (process.env.STRIPE_SECRET_KEY) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
} else {
    console.warn('Stripe Secret Key missing. Stripe features will fail.');
}

/**
 * Ensure a local user has a Stripe Customer ID.
 * Creates one if missing and updates DB.
 */
export async function getOrCreateCustomer(user) {
    if (!stripe) throw new Error('Stripe not configured');

    if (user.stripe_customer_id) {
        return user.stripe_customer_id;
    }

    // Create new customer
    const customer = await stripe.customers.create({
        email: user.email,
        name: user.username || user.first_name,
        metadata: {
            userId: user.id,
            firestoreId: user.firestore_id
        }
    });

    // Save to DB
    await knex('users')
        .where({ id: user.id })
        .update({ stripe_customer_id: customer.id });

    return customer.id;
}

/**
 * Create a Checkout Session for a subscription
 */
export async function createCheckoutSession(userId, priceId, successUrl, cancelUrl) {
    if (!stripe) throw new Error('Stripe not configured');

    const user = await knex('users').where({ id: userId }).first();
    const customerId = await getOrCreateCustomer(user);

    // CHECK ACTIVE SUB
    if (user.stripe_subscription_id) {
        try {
            const sub = await stripe.subscriptions.retrieve(user.stripe_subscription_id);
            if (sub && sub.status === 'active') {
                // Upgrade/Downgrade Logic: Update the existing item
                const itemId = sub.items.data[0].id;
                await stripe.subscriptions.update(user.stripe_subscription_id, {
                    items: [{
                        id: itemId,
                        price: priceId,
                    }],
                    proration_behavior: 'always_invoice', // Default or 'create_prorations'
                });

                return { url: `${successUrl}` }; // Redirect immediately to success
            }
        } catch (e) {
            console.warn("Failed to update existing sub, falling back to new session", e);
        }
    }

    let session;
    try {
        session = await stripe.checkout.sessions.create({
            customer: customerId,
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [{
                price: priceId,
                quantity: 1,
            }],
            success_url: successUrl,
            cancel_url: cancelUrl,
            subscription_data: {
                metadata: { userId: user.id }
            },
            allow_promotion_codes: true,
        });
    } catch (err) {
        // Handle "No such customer" error (e.g. dev environment mismatch)
        if (err.code === 'resource_missing' && err.param === 'customer') {
            console.warn(`[Stripe] Customer ${customerId} missing, recreating...`);

            // Clear invalid ID from DB
            await knex('users').where({ id: userId }).update({ stripe_customer_id: null });
            user.stripe_customer_id = null; // Update local ref

            // Create new customer
            const newCustomerId = await getOrCreateCustomer(user);

            // Retry session creation
            session = await stripe.checkout.sessions.create({
                customer: newCustomerId,
                mode: 'subscription',
                payment_method_types: ['card'],
                line_items: [{
                    price: priceId,
                    quantity: 1,
                }],
                success_url: successUrl,
                cancel_url: cancelUrl,
                subscription_data: {
                    metadata: { userId: user.id }
                },
                allow_promotion_codes: true,
            });
        } else {
            throw err;
        }
    }

    return session;
}

/**
 * Create a Customer Portal session (for managing supscriptions)
 */
export async function createPortalSession(userId, returnUrl) {
    if (!stripe) throw new Error('Stripe not configured');

    const user = await knex('users').where({ id: userId }).first();
    if (!user.stripe_customer_id) throw new Error('No Stripe customer found for this user');

    const session = await stripe.billingPortal.sessions.create({
        customer: user.stripe_customer_id,
        return_url: returnUrl,
    });

    return session;
}

/**
 * Handle Webhook Events
 */
export async function handleWebhook(event) {
    if (!stripe) return;

    switch (event.type) {
        case 'checkout.session.completed':
            await handleCheckoutCompleted(event.data.object);
            break;
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
            await handleSubscriptionUpdated(event.data.object);
            break;
        default:
        // console.log(`Unhandled event type ${event.type}`);
    }
}

async function handleCheckoutCompleted(session) {
    // Retrieve the subscription
    const subscriptionId = session.subscription;
    const customerId = session.customer;

    // Find user by customerId (we indexed it)
    const user = await knex('users').where({ stripe_customer_id: customerId }).first();
    if (!user) {
        console.error('Webhook Error: User not found for customer', customerId);
        return;
    }

    // Update user with subscription ID (Tier update happens in 'subscription.updated' usually, but we can do initial sync here)
    await knex('users').where({ id: user.id }).update({
        stripe_subscription_id: subscriptionId,
        subscription_status: 'active'
        // Tier will be updated by sync logic below or next event
    });
}

async function handleSubscriptionUpdated(subscription) {
    const customerId = subscription.customer;
    const status = subscription.status; // active, past_due, canceled, etc.

    // Map Price ID to our Tier Enum
    const priceId = subscription.items.data[0].price.id;
    const tier = mapPriceToTier(priceId);

    const user = await knex('users').where({ stripe_customer_id: customerId }).first();
    if (!user) return; // Should not happen

    await knex('users').where({ id: user.id }).update({
        subscription_status: status,
        subscription_tier: status === 'active' || status === 'trialing' ? tier : 'free',
        subscription_end_date: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null
    });
}

import { TIERS, TIER_CONFIG } from '../config/tiers.js';

export function mapPriceToTier(priceId) {
    // Reverse lookup from config
    const entry = Object.entries(TIER_CONFIG).find(([_, config]) => {
        // Check if any of the prices match the incoming priceId
        return config.prices && Object.values(config.prices).includes(priceId);
    });
    return entry ? entry[0] : 'free';
}

export { stripe };

/**
 * Manually sync a user's subscription status from Stripe
 */
export async function syncSubscriptionStatus(userId) {
    if (!stripe) return;

    const user = await knex('users').where({ id: userId }).first();
    if (!user || !user.stripe_customer_id) return;

    try {
        const subscriptions = await stripe.subscriptions.list({
            customer: user.stripe_customer_id,
            status: 'all',
            limit: 1
        });

        if (subscriptions.data.length > 0) {
            await handleSubscriptionUpdated(subscriptions.data[0]);
            return await knex('users').where({ id: userId }).first(); // Return updated user
        }
    } catch (e) {
        console.error("Failed to sync sub:", e);
    }
}
