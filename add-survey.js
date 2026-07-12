const sqlite3 = require('sqlite3');
const crypto = require('crypto');
const db = new sqlite3.Database('./dev.db');

const AGENT_ID = '9f610834-51a0-4f41-b336-ed8ea9e34514'; // Badilisha na ID yako
const id = crypto.randomUUID();

db.run(
  `INSERT INTO properties (id, title, type, price, location, university, description, latitude, longitude, status, agentId)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  [
    id,
    'Chumba Karibu na Survey',
    'SINGLE_ROOM',
    100000,
    'Survey',
    'ARU',
    'Chumba kizuri karibu na Ardhi University',
    -6.6827,
    39.3521,
    'AVAILABLE',
    AGENT_ID
  ],
  function(err) {
    if (err) console.error('Error:', err);
    else console.log('✅ Added property for Survey:', id);
    db.close();
  }
);