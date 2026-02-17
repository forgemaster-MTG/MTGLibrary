
/**
 * Migration: Add 'is_thematic' boolean to 'user_decks' table.
 */
const fs = require('fs');
const path = require('path');

// Helper to check if column exists
async function columnExists(knex, tableName, columnName) {
    const hasColumn = await knex.schema.hasColumn(tableName, columnName);
    return hasColumn;
}

exports.up = async function(knex) {
    const hasThematic = await columnExists(knex, 'user_decks', 'is_thematic');
    
    if (!hasThematic) {
        await knex.schema.table('user_decks', function(table) {
            table.boolean('is_thematic').defaultTo(false);
        });
        console.log("Added 'is_thematic' to 'user_decks'.");
    } else {
        console.log("'is_thematic' already exists on 'user_decks'. Skipping.");
    }
};

exports.down = async function(knex) {
    const hasThematic = await columnExists(knex, 'user_decks', 'is_thematic');
    
    if (hasThematic) {
        await knex.schema.table('user_decks', function(table) {
            table.dropColumn('is_thematic');
        });
        console.log("Dropped 'is_thematic' from 'user_decks'.");
    }
};
