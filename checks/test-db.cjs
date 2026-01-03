require('dotenv').config();
const { knex } = require('../server/db');

async function testConnection() {
    console.log('Testing DB Access...');
    try {
        const result = await knex.raw('SELECT 1+1 as result');
        console.log('Connection Successful!', result.rows && result.rows[0]);
        process.exit(0);
    } catch (err) {
        console.error('Connection Failed:', err.message);
        process.exit(1);
    }
}

testConnection();
