const { readFileSync } = require('node:fs');
const { execSync } = require('node:child_process');

const env = readFileSync('.env', 'utf8').split('\n').filter(l => l.includes('=') && !l.startsWith('#')).reduce((a, l) => { const [k, ...v] = l.split('='); a[k.trim()] = v.join('=').replace(/^"|"$/g, ''); return a; }, {});

// pg is bundled inside @prisma/adapter-pg's deps
const adapterPath = require.resolve('@prisma/adapter-pg');
console.log('adapter at:', adapterPath);
