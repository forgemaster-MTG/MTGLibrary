/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    return knex.schema.createTable('pending_external_invitations', function (table) {
        table.uuid('id').defaultTo(knex.raw('gen_random_uuid()')).primary();
        table.integer('inviter_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.string('invitee_email').notNullable();
        table.string('status').notNullable().defaultTo('pending'); // 'pending', 'completed', 'expired'
        table.timestamps(true, true);

        // Ensure we don't spam multiple pending invites for the same pair
        table.unique(['inviter_id', 'invitee_email']);
        table.index(['invitee_email']);
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    return knex.schema.dropTable('pending_external_invitations');
}
