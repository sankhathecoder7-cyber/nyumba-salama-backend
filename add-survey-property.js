const sqlite3 = require('sqlite3');
const crypto = require('crypto');
const db = new sqlite3.Database('./dev.db');

const id = crypto.randomUUID();

db.run(
  `INSERT INTO properties (id, title, type, price, location, university, description, latitude, longitude, status)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  [
    id,
    'Chumba Karibu na Survey - Ardhi University',
    'SINGLE_ROOM',
    100000,
    'Survey',
    'ARU',
    'Chumba kizuri karibu na Ardhi University. Eneo la utulivu na salama.',
    -6.6827,
    39.3521,
    'AVAILABLE'
  ],
  function(err) {
    if (err) {
      console.error('Error:', err);
    } else {
      console.log('✅ Added property for Survey with ID:', id);
    }
    db.close();
  }
);