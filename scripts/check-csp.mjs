// Keeps the Content-Security-Policy in vercel.json in step with the built page.
// The legacy-browser plugin writes a few inline scripts into dist/index.html; a CSP without
// 'unsafe-inline' only allows them by hash, and the hashes change if their text changes.
//   node scripts/check-csp.mjs          fails (exit 1) when vercel.json is out of date
//   node scripts/check-csp.mjs --write  updates vercel.json
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const hashes = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)]
  .map((m) => m[1])
  .filter((body) => body.trim().length > 0)
  .map((body) => `'sha256-${createHash('sha256').update(body).digest('base64')}'`);

const file = new URL('../vercel.json', import.meta.url);
const config = JSON.parse(readFileSync(file, 'utf8'));
const csp = config.headers.flatMap((h) => h.headers).find((h) => h.key === 'Content-Security-Policy');
const want = csp.value.replace(/script-src [^;]*;/, `script-src 'self' ${hashes.join(' ')};`);

if (want === csp.value) {
  console.log(`CSP is current (${hashes.length} inline script hashes).`);
} else if (process.argv.includes('--write')) {
  csp.value = want;
  writeFileSync(file, JSON.stringify(config, null, 2) + '\n');
  console.log('vercel.json updated with the current inline script hashes.');
} else {
  console.error('vercel.json has stale inline script hashes. Run: node scripts/check-csp.mjs --write');
  process.exit(1);
}
