const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./dev.db');

const locationCoords = {
  'Kimara': { lat: -6.67, lng: 39.35 },
  'Ubungo': { lat: -6.56, lng: 39.30 },
  'Kinondoni': { lat: -6.50, lng: 39.27 },
  'Mikocheni': { lat: -6.54, lng: 39.22 },
  'Mlimani': { lat: -6.68, lng: 39.35 },
  'Magomeni': { lat: -6.69, lng: 39.37 },
  'Kijitonyama': { lat: -6.65, lng: 39.29 },
  'Posta': { lat: -6.60, lng: 39.30 },
  'Masaki': { lat: -6.59, lng: 39.44 },
  'Oyster Bay': { lat: -6.59, lng: 39.44 },
  'Kariakoo': { lat: -6.62, lng: 39.28 },
  'Mchafukoge': { lat: -6.61, lng: 39.27 },
  'Upanga': { lat: -6.63, lng: 39.29 },
  'Muhimbili': { lat: -6.64, lng: 39.30 },
  'Ardhi': { lat: -6.68, lng: 39.35 },
  'Kigamboni': { lat: -6.70, lng: 39.20 },
  'Mabibo': { lat: -6.55, lng: 39.28 },
  'Changanyikeni': { lat: -6.66, lng: 39.34 },
  'Makongo': { lat: -6.67, lng: 39.36 },
  'Mpakani': { lat: -6.65, lng: 39.33 },
  'Sinza': { lat: -6.58, lng: 39.31 },
  'Mwenge': { lat: -6.64, lng: 39.32 },
  'Temeke': { lat: -6.78, lng: 39.28 },
  'Mbagala': { lat: -6.75, lng: 39.25 },
  'Gongo la Mboto': { lat: -6.73, lng: 39.22 },
  'Survey': { lat: -6.68, lng: 39.35 },
  'Goba': { lat: -6.65, lng: 39.40 },
};

// Get all videos
db.all('SELECT id, location FROM videos', (err, rows) => {
  if (err) {
    console.error('Error:', err);
    db.close();
    return;
  }

  let updated = 0;
  let skipped = 0;

  rows.forEach((row) => {
    const location = row.location || '';
    let matchedKey = null;
    
    for (const key of Object.keys(locationCoords)) {
      if (location.toLowerCase().includes(key.toLowerCase())) {
        matchedKey = key;
        break;
      }
    }

    if (matchedKey) {
      const coords = locationCoords[matchedKey];
      const lat = coords.lat + (Math.random() - 0.5) * 0.01;
      const lng = coords.lng + (Math.random() - 0.5) * 0.01;
      
      db.run(
        'UPDATE videos SET latitude = ?, longitude = ? WHERE id = ?',
        [lat, lng, row.id],
        (err) => {
          if (err) {
            console.error(`Error updating ${row.id}:`, err);
          } else {
            updated++;
            console.log(`✅ Updated video ${row.id}: ${location} → ${lat}, ${lng}`);
          }
        }
      );
    } else {
      skipped++;
      console.log(`⚠️ Skipped video ${row.id}: No coordinates for "${location}"`);
    }
  });

  setTimeout(() => {
    console.log(`\n📊 Summary: ${updated} updated, ${skipped} skipped`);
    db.close();
  }, 2000);
});