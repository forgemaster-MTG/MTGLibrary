import { knex } from '../db.js';

async function createNotesTable() {
    try {
        const title = 'ticket_notes';
        const exists = await knex.schema.hasTable(title);

        if (!exists) {
            await knex.schema.createTable(title, (table) => {
                table.increments('id').primary();
                table.integer('ticket_id').notNullable().references('id').inTable('tickets').onDelete('CASCADE');
                table.integer('user_id').notNullable().references('id').inTable('users');
                table.text('note').notNullable();
                table.timestamp('created_at').defaultTo(knex.fn.now());
            });
            console.log(`Table '${title}' created successfully.`);
        } else {
            console.log(`Table '${title}' already exists.`);
        }
    } catch (err) {
        console.error('Error creating table:', err);
    } finally {
        await knex.destroy();
    }
}

createNotesTable();
