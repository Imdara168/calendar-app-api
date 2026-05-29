import { createConnection } from 'mysql2/promise';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

async function check() {
  const connection = await createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: 'Dara@24112003<3',
    database: 'calendar-app',
  });

  console.log('--- Table: events ---');
  const [columns] = await connection.query('DESCRIBE events');
  console.table(columns);

  console.log('--- SQL Mode ---');
  const [sqlMode] = await connection.query("SELECT @@sql_mode as mode");
  console.log(sqlMode);

  console.log('--- Sample Data: events ---');
  const [rows] = await connection.query('SELECT * FROM events LIMIT 5');
  console.log(rows);

  await connection.end();
}

check().catch(console.error);
