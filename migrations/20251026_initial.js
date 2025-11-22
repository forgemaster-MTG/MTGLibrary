exports.up = function(knex) {
  return knex.schema
    .createTable('cards', function(t) {
      t.increments('id').primary();
      t.string('firestore_id').unique();
      t.string('name');
      t.jsonb('data');
      t.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('decks', function(t) {
      t.increments('id').primary();
      t.string('firestore_id').unique();
      t.string('name');
      t.jsonb('data');
      t.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('deck_cards', function(t) {
      t.increments('id').primary();
      t.integer('deck_id').unsigned().references('id').inTable('decks').onDelete('CASCADE');
      t.integer('card_id').unsigned().references('id').inTable('cards').onDelete('CASCADE');
      t.integer('count').defaultTo(1);
    })
    .createTable('users', function(t) {
      t.increments('id').primary();
      t.string('firestore_id').unique();
      t.string('email');
      t.jsonb('data');
      t.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('saved_views', function(t) {
      t.increments('id').primary();
      t.integer('user_id').unsigned().references('id').inTable('users');
      t.string('firestore_id').unique();
      t.string('name');
      t.jsonb('data');
    })
    .createTable('precons', function(t) {
      t.increments('id').primary();
      t.string('firestore_id').unique();
      t.string('name');
      t.jsonb('data');
      t.timestamp('created_at').defaultTo(knex.fn.now());
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('deck_cards')
    .dropTableIfExists('cards')
    .dropTableIfExists('decks')
    .dropTableIfExists('saved_views')
    .dropTableIfExists('users')
    .dropTableIfExists('precons');
};
