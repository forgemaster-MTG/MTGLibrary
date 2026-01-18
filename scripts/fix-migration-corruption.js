
import fs from 'fs';
import path from 'path';
import { knex } from '../server/db.js';

const MIGRATIONS_DIR = path.join(process.cwd(), 'migrations');

async function fixMigrations() {
    try {
        console.log('Checking for corrupt migrations...');

        // Get DB migrations
        const dbMigrations = await knex('knex_migrations').select('id', 'name');
        const files = fs.readdirSync(MIGRATIONS_DIR);

        let updates = 0;
        let deletes = 0;

        for (const mig of dbMigrations) {
            const name = mig.name;
            if (files.includes(name)) {
                continue; // Exact match found
            }

            // Check if .cjs version exists
            const cjsName = name.replace(/\.js$/, '.cjs');
            const jsName = name.replace(/\.cjs$/, '.js');

            if (files.includes(cjsName)) {
                console.log(`Fixing extension for ${name} -> ${cjsName}`);
                await knex('knex_migrations').where({ id: mig.id }).update({ name: cjsName });
                updates++;
            } else if (files.includes(jsName)) {
                console.log(`Fixing extension for ${name} -> ${jsName}`);
                await knex('knex_migrations').where({ id: mig.id }).update({ name: jsName });
                updates++;
            } else {
                console.log(`Migration missing from disk: ${name}. Deleting record.`);
                await knex('knex_migrations').where({ id: mig.id }).del();
                deletes++;
            }
        }

        console.log(`Fixed ${updates} extensions.`);
        console.log(`Deleted ${deletes} missing records.`);

    } catch (err) {
        console.error('Error fixing migrations:', err);
    } finally {
        await knex.destroy();
    }
}

fixMigrations();
