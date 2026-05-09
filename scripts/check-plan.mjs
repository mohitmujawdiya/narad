import { readFileSync } from 'node:fs';
import pg from 'pg';
const env = readFileSync('.env', 'utf8').split('\n').filter(l => l.includes('=') && !l.startsWith('#')).reduce((a, l) => { const [k, ...v] = l.split('='); a[k.trim()] = v.join('=').replace(/^"|"$/g, ''); return a; }, {});
const c = new pg.Client({ connectionString: env.DATABASE_URL });
await c.connect();
const r = await c.query("SELECT title, content FROM plans WHERE project_id = (SELECT id FROM projects WHERE slug='demo' LIMIT 1) AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 1");
const row = r.rows[0];
if (!row) { console.log('no plan found'); }
else {
  console.log('=== TITLE:', row.title);
  console.log('=== CONTENT (first 600 chars, JSON-stringified to show whitespace):');
  console.log(JSON.stringify(row.content.slice(0, 600)));
}
await c.end();
