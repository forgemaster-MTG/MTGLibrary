import knexConfig from './knexfile.cjs';
console.log('Knex Config Keys:', Object.keys(knexConfig));
console.log('Development Client:', knexConfig.development?.client);
