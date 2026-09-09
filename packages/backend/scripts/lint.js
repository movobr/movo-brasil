/**
 * Lint mecânico da Fase 1 (G1): sem novas dependências.
 * - proíbe `any` explícito em src/ (TypeScript strict de verdade);
 * - proíbe console.* em src/ (observabilidade usa logs estruturados, 00 §14).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../src', import.meta.url));
const violations = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const st = statSync(path);
    if (st.isDirectory()) {
      walk(path);
    } else if (path.endsWith('.ts')) {
      const lines = readFileSync(path, 'utf8').split('\n');
      lines.forEach((line, index) => {
        const stripped = line.replace(/\/\/.*$/, '');
        if (/:\s*any\b/.test(stripped) || /<any>/.test(stripped) || /as\s+any\b/.test(stripped)) {
          violations.push(`${path}:${index + 1}: explicit any`);
        }
        if (/console\.(log|info|warn|error|debug)\s*\(/.test(stripped)) {
          violations.push(`${path}:${index + 1}: console.* in src`);
        }
      });
    }
  }
}

walk(SRC);
if (violations.length > 0) {
  console.error('lint failed:');
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}
console.log('lint ok');
