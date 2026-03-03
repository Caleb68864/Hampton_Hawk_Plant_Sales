// Usage: node get_inv.js <plantCatalogId>
// Reads from inv_list.json and extracts onHandQty for the given plant
const fs = require('fs');
const path = process.argv[2];
const plantId = process.argv[3];

try {
  const raw = fs.readFileSync(path, 'utf8');
  const o = JSON.parse(raw);
  const item = o.data.items.find(i => i.plantCatalogId === plantId);
  if (!item) { console.log('NOT_FOUND'); process.exit(1); }
  console.log(item.onHandQty);
} catch(e) {
  console.error('ERROR: ' + e.message);
  process.exit(1);
}
