/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.raw(`
        ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_status_check;
        ALTER TABLE tickets ADD CONSTRAINT tickets_status_check CHECK (status IN ('open', 'planned', 'in_progress', 'completed', 'wont_fix', 'complete_pending', 'complete_scheduled', 'complete_blocked', 'released'));
    `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.raw(`
        ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_status_check;
        ALTER TABLE tickets ADD CONSTRAINT tickets_status_check CHECK (status IN ('open', 'planned', 'in_progress', 'completed', 'wont_fix'));
    `);
};
