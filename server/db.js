require('dotenv').config();
const knexConfig = require('../knexfile');
const env = process.env.NODE_ENV || 'development';
const knex = require('knex')(knexConfig[env]);
const { Model } = require('objection');
Model.knex(knex);

module.exports = { knex, Model };
