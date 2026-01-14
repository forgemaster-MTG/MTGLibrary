/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    return knex.schema
        .table('user_relationships', function (table) {
            table.string('type').notNullable().defaultTo('pod'); // 'pod' (sharing), 'friend' (social)
        })
        .table('pending_external_invitations', function (table) {
            table.string('type').notNullable().defaultTo('pod'); // 'pod' (sharing), 'friend' (social)
        });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    return knex.schema
        .table('pending_external_invitations', function (table) {
            table.dropColumn('type');
        })
        .table('user_relationships', function (table) {
            table.dropColumn('type');
        });
}
