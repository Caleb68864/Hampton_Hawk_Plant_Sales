// Usage: node extract.js <file> <dotted.path>
const fs = require('fs');
const file = process.argv[2];
const path = process.argv[3];

try {
  const raw = fs.readFileSync(file, 'utf8');
  const o = JSON.parse(raw);
  let v = o;
  path.split('.').forEach(k => {
    if (v !== undefined && v !== null) v = v[k];
  });
  if (v === null) console.log('null');
  else if (v === undefined) console.log('undefined');
  else console.log(String(v));
} catch(e) {
  console.error('ERROR: ' + e.message);
  process.exit(1);
}
