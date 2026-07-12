const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./dev.db');

// Function to add column if it doesn't exist
function addColumnIfNotExists(table, column, type) {
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${table})`, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      
      const exists = rows.some(row => row.name === column);
      if (!exists) {
        db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`, (err) => {
          if (err) {
            console.error(`❌ Failed to add ${column} to ${table}:`, err.message);
            reject(err);
          } else {
            console.log(`✅ Added ${column} to ${table}`);
            resolve();
          }
        });
      } else {
        console.log(`ℹ️ Column ${column} already exists in ${table}`);
        resolve();
      }
    });
  });
}

// Add columns to videos table
async function addColumns() {
  try {
    await addColumnIfNotExists('videos', 'latitude', 'REAL');
    await addColumnIfNotExists('videos', 'longitude', 'REAL');
    console.log('\n✅ All columns added successfully!');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    db.close();
  }
}

addColumns();