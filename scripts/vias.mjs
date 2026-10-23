// Baja de OpenStreetMap (Overpass) las vías principales y las estaciones de Portugal
// y las guarda compactas en vias-pt.json, para que la página no dependa de la red en el tren.
import { writeFileSync } from 'node:fs';

const SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
const QUERY = `[out:json][timeout:300];
area["ISO3166-1"="PT"][admin_level=2]->.pt;
way["railway"~"^(rail|narrow_gauge)$"]["service"!~"."](area.pt);
out tags geom;
node["railway"~"^(station|halt)$"](area.pt);
out tags;`;

async function download() {
  for (const url of SERVERS) {
    try {
      const r = await fetch(url, { method: 'POST', body: new URLSearchParams({ data: QUERY }) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      console.warn(`${url}: ${e.message}`);
    }
  }
  throw new Error('Ningún servidor de Overpass respondió');
}

const R = 6371000, DEG = Math.PI / 180;
const dist = (a, b) => {
  const x = (b.lon - a.lon) * DEG * Math.cos(((a.lat + b.lat) / 2) * DEG), y = (b.lat - a.lat) * DEG;
  return Math.hypot(x, y) * R;
};
const round = n => Math.round(n * 1e5) / 1e5;

const data = await download();
const ways = [], nodes = [];
for (const e of data.elements) {
  if (e.type === 'way' && e.geometry?.length > 1) {
    // se saltean puntos a menos de 12 m del anterior; los extremos se conservan para unir tramos
    const g = e.geometry, kept = [g[0]];
    for (let i = 1; i < g.length - 1; i++) if (dist(kept[kept.length - 1], g[i]) >= 12) kept.push(g[i]);
    kept.push(g[g.length - 1]);
    ways.push([e.id, e.tags?.name || e.tags?.ref || '', kept.flatMap(p => [round(p.lat), round(p.lon)])]);
  } else if (e.type === 'node' && e.tags?.name) {
    nodes.push([e.id, e.tags.name, round(e.lat), round(e.lon)]);
  }
}
if (ways.length < 500) throw new Error(`Muy pocas vías (${ways.length}): no se reemplaza el archivo`);
writeFileSync('vias-pt.json', JSON.stringify({ generated: new Date().toISOString().slice(0, 10), ways, nodes }));
console.log(`${ways.length} tramos y ${nodes.length} estaciones`);
