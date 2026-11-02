import assert from 'node:assert/strict';
import test from 'node:test';
import config from '../portal.config.ts';
import { createClient } from '../src/api/client.ts';
import { gaaCsv, gaaYearTotals, resolveGaa } from '../src/lib/gaa.ts';
import { projectsCsv } from '../src/lib/csv.ts';
import { resolveScope, summarise } from '../src/lib/scope.ts';
import fixture from './fixtures/liloan-namesakes.json';

test('the Santander namesake is excluded from Liloan totals and exports', async (t) => {
  t.mock.method(globalThis, 'fetch', async (input: string) => {
    const rows = new URL(input).pathname.includes('/dpwh/') ? [fixture.project, fixture.localProject] : [];
    return Response.json({ meta: {}, disclaimers: [], data: { total: rows.length, rows } });
  });
  const result = await resolveScope(createClient('https://api.example'), config);
  assert.deepEqual(result.projects.map(p => p.id), [fixture.localProject.id]);
  assert.equal(summarise(result.projects).house.php, 5000000);
  assert.ok(result.excluded.some(e => e.project?.id === fixture.project.id && e.exclusion.reason.includes('Santander')));
  assert.ok(!projectsCsv(result.projects).includes('Santander'));
});

test('verified historical namesakes are excluded while local Liloan programs remain', async (t) => {
  t.mock.method(globalThis, 'fetch', async (input: string) => {
    const path = new URL(input).pathname;
    const data = path.endsWith('/departments')
      ? [{ id: '18', description: 'DPWH' }, { id: '05', description: 'DA' }]
      : [...fixture.programs, fixture.localProgram].filter(r => path.includes(`/departments/${r.department_id}/`));
    return Response.json({ meta: { matched: data.length }, data });
  });
  const result = await resolveGaa(createClient('https://api.example'), config);
  assert.deepEqual(result.rows.map(r => r.fam_key), [fixture.localProgram.fam_key]);
  assert.equal(gaaYearTotals(result.rows).find(t => t.year === 2026)?.amount, 5000000);
  const removed = result.excluded.flatMap(e => e.row ? [e.row] : []);
  assert.equal(removed.length, fixture.programs.length);
  assert.equal(gaaYearTotals(removed).find(t => t.year === 2026)?.amount, 224445000);
  assert.ok(!gaaCsv(result.rows).includes('Southern Leyte'));
});
