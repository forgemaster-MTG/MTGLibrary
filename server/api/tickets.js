import express from 'express';
import { knex } from '../db.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// List Tickets
router.get('/', async (req, res) => {
    try {
        const { epic_id, type, status, assigned_to } = req.query;
        let query = knex('tickets')
            .select(
                'tickets.*',
                'users.username as created_by_username',
                'assignee.username as assigned_to_username',
                'epics.title as epic_title',
                knex.raw('(SELECT COUNT(*) FROM ticket_notes WHERE ticket_notes.ticket_id = tickets.id) as note_count'),
                knex.raw('(SELECT MAX(created_at) FROM ticket_notes WHERE ticket_notes.ticket_id = tickets.id) as last_note_at')
            )
            .leftJoin('users', 'tickets.created_by', 'users.id')
            .leftJoin('users as assignee', 'tickets.assigned_to', 'assignee.id')
            .leftJoin('epics', 'tickets.epic_id', 'epics.id')
            .orderBy('tickets.updated_at', 'desc');

        if (epic_id) query.where('tickets.epic_id', epic_id);
        if (type) query.where('tickets.type', type);
        if (status) query.where('tickets.status', status);
        if (assigned_to) query.where('tickets.assigned_to', assigned_to);

        // Queue Filtering Rules:
        // - Completed tickets: hide if > 30 days old
        // - Wont Fix (Archived): hide if > 7 days old
        query.whereRaw(`
            (tickets.status != 'completed' OR tickets.updated_at > NOW() - INTERVAL '30 days')
            AND
            (tickets.status != 'wont_fix' OR tickets.updated_at > NOW() - INTERVAL '7 days')
            AND
            (tickets.status != 'released')
        `);

        const rows = await query;
        res.json(rows);
    } catch (err) {
        console.error('[tickets] list error', err);
        res.status(500).json({ error: 'db error' });
    }
});

// Get Ticket Report (Admin only)
router.get('/report', authMiddleware, async (req, res) => {
    try {
        const isRoot = req.user.firestore_id === 'Kyrlwz6G6NWICCEPYbXtFfyLzWI3';
        const isAdmin = isRoot || req.user.settings?.isAdmin || req.user.settings?.permissions?.includes('manage_tickets');
        if (!isAdmin) return res.status(403).json({ error: 'Not authorized' });

        const { startDate, endDate, status } = req.query;
        let query = knex('tickets')
            .select(
                'tickets.*',
                'users.username as created_by_username',
                'epics.title as epic_title'
            )
            .leftJoin('users', 'tickets.created_by', 'users.id')
            .leftJoin('epics', 'tickets.epic_id', 'epics.id')
            .orderBy('tickets.date_released', 'asc');

        if (startDate && endDate) {
            // Ensure end date includes the full day
            const startStr = `${startDate} 00:00:00`;
            const endStr = `${endDate} 23:59:59`;

            // Expand to include any ticket with activity in this range
            query.where(function () {
                this.whereBetween('tickets.created_at', [startStr, endStr])
                    .orWhereBetween('tickets.updated_at', [startStr, endStr])
                    .orWhereBetween('tickets.date_released', [startStr, endStr])
                    .orWhereExists(function () {
                        this.select('*')
                            .from('ticket_notes')
                            .whereRaw('ticket_notes.ticket_id = tickets.id')
                            .whereBetween('ticket_notes.created_at', [startStr, endStr]);
                    });
            });
        } else {
            if (startDate) query.where('tickets.updated_at', '>=', `${startDate} 00:00:00`);
            if (endDate) query.where('tickets.updated_at', '<=', `${endDate} 23:59:59`);
        }

        if (status) query.where('tickets.status', status);
        if (req.query.excludeReleased === 'true') {
            query.whereNot('tickets.status', 'released');
        }

        const rows = await query;
        res.json(rows);
    } catch (err) {
        console.error('[tickets] report error', err);
        res.status(500).json({ error: 'db error' });
    }
});

// Create Ticket
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { title, description, type, epic_id, priority } = req.body;

        // Basic validation
        if (!title || !type) return res.status(400).json({ error: 'Title and Type are required' });

        const [ticket] = await knex('tickets').insert({
            title,
            description,
            type,
            epic_id: epic_id || null, // Optional
            priority: priority || 'medium',
            created_by: req.user.id,
            status: 'open'
        }).returning('*');

        res.status(201).json(ticket);
    } catch (err) {
        console.error('[tickets] create error', err);
        res.status(500).json({ error: 'db error' });
    }
});

// Update Ticket
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const ticketId = req.params.id;
        const isRoot = req.user.firestore_id === 'Kyrlwz6G6NWICCEPYbXtFfyLzWI3';
        const isAdmin = isRoot || req.user.settings?.isAdmin || req.user.settings?.permissions?.includes('manage_tickets');
        const isOwner = false; // We verify owner below by fetching ticket first

        // Fetch existing ticket to check ownership
        const existing = await knex('tickets').where({ id: ticketId }).first();
        if (!existing) return res.status(404).json({ error: 'Not found' });

        // Update logic:
        // Admins can update EVERYTHING.
        // Users can update Title/Description/Type of THEIR OWN tickets.
        // Users CANNOT update Status/Priority/Assignment/Dates unless Admin/Manager.

        if (!isAdmin) {
            if (existing.created_by !== req.user.id) {
                return res.status(403).json({ error: 'Not authorized' });
            }
            if (existing.status !== 'open') {
                return res.status(403).json({ error: 'Tickets can only be edited while in Open status.' });
            }
        }

        const { title, description, type, status, priority, epic_id, assigned_to, due_date, date_released, estimated_release_date, est_completion_date } = req.body;
        const updateData = { updated_at: knex.fn.now() };

        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (type !== undefined) updateData.type = type;

        // Admin-only fields
        if (isAdmin) {
            if (status !== undefined) updateData.status = status;
            if (priority !== undefined) updateData.priority = priority;
            if (epic_id !== undefined) updateData.epic_id = epic_id;
            if (assigned_to !== undefined) updateData.assigned_to = assigned_to;
            if (due_date !== undefined) updateData.due_date = due_date;
            if (date_released !== undefined) updateData.date_released = date_released;
            if (estimated_release_date !== undefined) updateData.estimated_release_date = estimated_release_date;
            if (est_completion_date !== undefined) updateData.est_completion_date = est_completion_date;
        }

        const [updated] = await knex('tickets')
            .where({ id: ticketId })
            .update(updateData)
            .returning('*');

        res.json(updated);
    } catch (err) {
        console.error('[tickets] update error', err);
        res.status(500).json({ error: 'db error' });
    }
});

// Delete Ticket (Admin only)
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const isRoot = req.user.firestore_id === 'Kyrlwz6G6NWICCEPYbXtFfyLzWI3';
        const isAdmin = isRoot || req.user.settings?.isAdmin || req.user.settings?.permissions?.includes('manage_tickets');
        const existing = await knex('tickets').where({ id: req.params.id }).first();
        if (!existing) return res.status(404).json({ error: 'Not found' });

        const isOwner = existing.created_by === req.user.id;
        const canDelete = isAdmin || (isOwner && existing.status === 'open');

        if (!canDelete) {
            return res.status(403).json({ error: 'Not authorized to delete this ticket.' });
        }

        await knex('tickets').where({ id: req.params.id }).del();
        res.json({ success: true });
    } catch (err) {
        console.error('[tickets] delete error', err);
        res.status(500).json({ error: 'db error' });
    }
});

// Upvote Ticket (Toggle) - Simple implementation for now
// To do this properly we need a votes table, but user asked for simple "votes" column.
// We'll increment for now, but really we should prevent double voting.
// For MVP: simple increment endpoint.
router.post('/:id/vote', authMiddleware, async (req, res) => {
    try {
        // TODO: Implement distinct voting table later.
        // For now, just increment.
        await knex('tickets').where({ id: req.params.id }).increment('votes', 1);
        res.json({ success: true });
    } catch (err) {
        console.error('[tickets] vote error', err);
        res.status(500).json({ error: 'db error' });
    }
});



// Fetch Assignees (Admins/Managers)
router.get('/meta/assignees', authMiddleware, async (req, res) => {
    try {
        const users = await knex('users')
            .select('id', 'username', 'settings')
            .whereRaw(`
                (settings->>'isAdmin')::boolean = true 
                OR 
                settings->>'permissions' LIKE '%manage_tickets%'
                OR
                firestore_id = 'Kyrlwz6G6NWICCEPYbXtFfyLzWI3'
            `);
        res.json(users);
    } catch (err) {
        console.error('[tickets] fetch assignees error', err);
        // Fallback: return empty list, frontend can handle or default
        res.json([]);
    }
});

// Get Notes
router.get('/:id/notes', authMiddleware, async (req, res) => {
    try {
        const notes = await knex('ticket_notes')
            .select('ticket_notes.*', 'users.username')
            .leftJoin('users', 'ticket_notes.user_id', 'users.id')
            .where('ticket_id', req.params.id)
            .orderBy('created_at', 'asc');
        res.json(notes);
    } catch (err) {
        console.error('[tickets] get notes error', err);
        res.status(500).json({ error: 'db error' });
    }
});

// Add Note
router.post('/:id/notes', authMiddleware, async (req, res) => {
    try {
        const { note } = req.body;
        if (!note) return res.status(400).json({ error: 'Note is required' });

        const [newNote] = await knex('ticket_notes').insert({
            ticket_id: req.params.id,
            user_id: req.user.id,
            note
        }).returning('*');

        // Fetch username for display
        const user = await knex('users').select('username').where({ id: req.user.id }).first();
        newNote.username = user?.username || 'Unknown';

        res.json(newNote);
    } catch (err) {
        console.error('[tickets] add note error', err);
        res.status(500).json({ error: 'db error' });
    }
});

export default router;
