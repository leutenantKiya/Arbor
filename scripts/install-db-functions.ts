import { Client } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

async function main() {
    const client = new Client(process.env.DATABASE_URL!);
    await client.connect();
    const functionsSql = readFileSync('lib/db/functions.sql', 'utf-8');
    await client.query(functionsSql);
    await client.end();
    console.log('DB functions installed.');
}

main();