import dotenv from 'dotenv';
dotenv.config();
import knexConfig from '../knexfile.cjs';
import knexPkg from 'knex';
import { Model } from 'objection';

const env = process.env.NODE_ENV || 'development';
const knex = knexPkg(knexConfig[env]);
Model.knex(knex);

export { knex, Model };
