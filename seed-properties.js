const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./dev.db');

const universities = [
  'UDSM', 'ARU', 'CBE', 'MUHAS', 'DIT', 
  'IFM', 'DUCE', 'TIA', 'Mwalimu Nyerere', 
  'Kampala International', 'St. Joseph', 
  'University of Bagamoyo', 'Open University of Tanzania', 
  'National Institute of Transport'
];

const locations = ['Mlimani', 'Magomeni', 'Kijitonyama', 'Kinondoni', 'Ubungo', 'Kimara', 'Mikocheni', 'Oyster Bay', 'Masaki', 'Posta'];

const types = ['SINGLE_ROOM', 'SHARED_ROOM', 'STUDIO', 'APARTMENT', 'FULL_HOUSE'];

const properties = [];

// Generate 30 sample properties
for (let i = 1; i <= 30; i++) {
  const price = Math.floor(Math.random() * 700000) + 50000;
  const type = types[Math.floor(Math.random() * types.length)];
  const location = locations[Math.floor(Math.random() * locations.length)];
  const university = universities[Math.floor(Math.random() * universities.length)];
  
  properties.push({
    id: `prop_${i}`,
    title: `${type.replace('_', ' ')} - ${location}`,
    type: type,
    price: price,
    location: location,
    area: `${Math.floor(Math.random() * 100) + 20} sqm`,
    university: university,
    description: `Nice ${type} near ${university}. Available now.`,
    status: 'AVAILABLE',
    amenities: 'WiFi, Security, Water',
    rating: (Math.random() * 5).toFixed(1),
    reviewCount: Math.floor(Math.random() * 20),
    latitude: -6.8 + (Math.random() * 0.3),
    longitude: 39.2 + (Math.random() * 0.3),
    images: '[]',
    videoUrl: null,
    agentId: '9f610834-51a0-4f41-b336-ed8ea9e34514', // Badilisha na user ID yako
  });
}

console.log(`Inserting ${properties.length} properties...`);

const insert = db.prepare(`
  INSERT OR IGNORE INTO properties (
    id, title, type, price, location, area, university, 
    description, status, amenities, rating, reviewCount, 
    latitude, longitude, images, videoUrl, agentId
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

properties.forEach(p => {
  insert.run(
    p.id, p.title, p.type, p.price, p.location, p.area, p.university,
    p.description, p.status, p.amenities, p.rating, p.reviewCount,
    p.latitude, p.longitude, p.images, p.videoUrl, p.agentId
  );
});

insert.finalize();
console.log('✅ Properties inserted successfully!');

db.close();