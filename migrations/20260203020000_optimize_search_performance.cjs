
exports.up = function (knex) {
    return knex.schema.raw('CREATE EXTENSION IF NOT EXISTS pg_trgm')
        .then(function () {
            // Add GIN index for partial name matching (ILIKE replacements)
            return knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_cards_name_trigram ON cards USING gin (name gin_trgm_ops)');
        })
        .then(function () {
            // Add GIN index for Oracle text searching
            return knex.schema.raw("CREATE INDEX IF NOT EXISTS idx_cards_oracle_text_trigram ON cards USING gin ((data->>'oracle_text') gin_trgm_ops)");
        });
};

exports.down = function (knex) {
    return knex.schema.raw('DROP INDEX IF EXISTS idx_cards_oracle_text_trigram')
        .then(function () {
            return knex.schema.raw('DROP INDEX IF EXISTS idx_cards_name_trigram');
        })
        .then(function () {
            // Optional: Drop extension? Usually safer to leave it.
            // return knex.schema.raw('DROP EXTENSION IF EXISTS pg_trgm');
        });
};
