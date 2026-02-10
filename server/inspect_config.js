
import Knex from 'knex';
import knexConfig from '../knexfile.cjs';

const environment = process.env.NODE_ENV || 'development';
const knex = Knex(knexConfig[environment]);

async function inspect() {
    try {
        const row = await knex('system_settings').where({ key: 'pricing_config' }).first();
        if (row && row.value) {
            console.log(JSON.stringify(typeof row.value === 'string' ? JSON.parse(row.value) : row.value, null, 2));
        } else {
            console.log('No pricing_config found in system_settings');
        }
    } catch (e) {
        console.error(e);
    } finally {
        await knex.destroy();
    }
}

inspect();
