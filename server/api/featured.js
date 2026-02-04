import express from 'express';
import { knex } from '../db.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// GET all active products (Public)
router.get('/', async (req, res) => {
    try {
        const products = await knex('featured_products')
            .where({ is_active: true })
            .orderBy('display_order', 'asc')
            .orderBy('id', 'desc');
        res.json(products);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch featured products' });
    }
});

// GET all products (Admin)
router.get('/all', auth, async (req, res) => {
    if (!req.user.settings?.isAdmin) return res.status(403).json({ error: 'Unauthorized' });

    try {
        const products = await knex('featured_products')
            .orderBy('display_order', 'asc')
            .orderBy('id', 'desc');
        res.json(products);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// POST create product (Admin)
router.post('/', auth, async (req, res) => {
    if (!req.user.settings?.isAdmin) return res.status(403).json({ error: 'Unauthorized' });

    try {
        const { title, image_url, link_url, category, price_label, is_active } = req.body;

        // Get max order to append to end
        const maxOrder = await knex('featured_products').max('display_order as max').first();
        const nextOrder = (maxOrder?.max || 0) + 1;

        const [newProduct] = await knex('featured_products').insert({
            title,
            image_url,
            link_url,
            category: category || 'sealed',
            price_label,
            is_active: is_active !== undefined ? is_active : true,
            display_order: nextOrder
        }).returning('*');

        res.status(201).json(newProduct);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create product' });
    }
});

// PUT update product (Admin)
router.put('/:id', auth, async (req, res) => {
    if (!req.user.settings?.isAdmin) return res.status(403).json({ error: 'Unauthorized' });

    try {
        const { id } = req.params;
        const updates = req.body;
        updates.updated_at = knex.fn.now();

        const [updatedProduct] = await knex('featured_products')
            .where({ id })
            .update(updates)
            .returning('*');

        if (!updatedProduct) return res.status(404).json({ error: 'Product not found' });
        res.json(updatedProduct);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update product' });
    }
});

// DELETE product (Admin)
router.delete('/:id', auth, async (req, res) => {
    if (!req.user.settings?.isAdmin) return res.status(403).json({ error: 'Unauthorized' });

    try {
        const { id } = req.params;
        await knex('featured_products').where({ id }).del();
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

// PUT reorder products (Admin)
router.put('/reorder/batch', auth, async (req, res) => {
    if (!req.user.settings?.isAdmin) return res.status(403).json({ error: 'Unauthorized' });

    try {
        const { order } = req.body; // Array of IDs in new order

        await knex.transaction(async trx => {
            const queries = order.map((id, index) =>
                trx('featured_products')
                    .where({ id })
                    .update({ display_order: index })
            );
            await Promise.all(queries);
        });

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to reorder products' });
    }
});

export default router;
