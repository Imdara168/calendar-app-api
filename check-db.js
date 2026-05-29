const mysql = require('mysql2/promise');

async function check() {
  try {
    const connection = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: 'Dara@24112003<3',
      database: 'calendar-app',
    });

    console.log('--- Table: users columns ---');
    const [userColumns] = await connection.query('DESCRIBE users');
    console.table(userColumns);

    const [users] = await connection.query('SELECT * FROM users');
    console.table(users);

    console.log('--- Sample Data: events ---');
    const [rows] = await connection.query('SELECT * FROM events LIMIT 5');
    console.table(rows);

    await connection.end();
  } catch (err) {
    console.error(err);
  }
}

check();
