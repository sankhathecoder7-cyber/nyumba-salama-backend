const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./dev.db');

db.all("SELECT id, title, location, price FROM properties WHERE location LIKE '%survey%' OR location LIKE '%Survey%'", (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Properties with Survey:', rows);
  }
  db.close();
});