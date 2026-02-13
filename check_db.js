const knex = require('knex')(require('./knexfile.cjs').development);

async function check() {
    try {
        const users = await knex('users').select('id', 'username', 'credits_monthly', 'credits_topup', 'ai_credits_used').limit(5);
        console.log('User Credits Check:');
        console.table(users);

        const columns = await knex('users').columnInfo();
        console.log('Available Columns:', Object.keys(columns).join(', '));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
