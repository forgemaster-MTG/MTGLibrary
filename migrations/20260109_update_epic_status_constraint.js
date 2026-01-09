/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.raw(`
        ALTER TABLE epics DROP CONSTRAINT IF EXISTS epics_status_check;
        ALTER TABLE epics ADD CONSTRAINT epics_status_check CHECK (status IN ('active', 'archived', 'open', 'planned', 'in_progress', 'completed', 'complete_pending', 'complete_scheduled', 'complete_blocked', 'wont_fix'));
    `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.raw(`
        ALTER TABLE epics DROP CONSTRAINT IF EXISTS epics_status_check;
        ALTER TABLE epics ADD CONSTRAINT epics_status_check CHECK (status IN ('active', 'completed', 'archived'));
    `);
};
