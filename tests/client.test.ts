import assert from 'node:assert/strict';
import test from 'node:test';
import { createClient, MAX_ROWS_PER_QUERY, PAGE_SIZE } from '../src/api/client.ts';

test('a complete 4,000-row project query fetches every page', async (t) => {
  const offsets: number[] = [];
  t.mock.method(globalThis, 'fetch', async (input: string) => {
    const offset = Number(new URL(input).searchParams.get('offset'));
    offsets.push(offset);
    return Response.json({ data: { total: MAX_ROWS_PER_QUERY, rows: Array.from({ length: PAGE_SIZE }, (_, i) => ({ id: String(offset + i) })) } });
  });
  const result = await createClient('https://api.example').allProjects('dpwh', { q: 'Liloan' });
  assert.equal(result.rows.length, MAX_ROWS_PER_QUERY);
  assert.equal(new Set(result.rows.map((r) => r.id)).size, MAX_ROWS_PER_QUERY);
  assert.equal(offsets.length, MAX_ROWS_PER_QUERY / PAGE_SIZE);
  assert.equal(result.truncated, false);
});

test('a 4,001-row query fails before returning partial totals or fetching more pages', async (t) => {
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    requests++;
    return Response.json({ data: { total: MAX_ROWS_PER_QUERY + 1, rows: [] } });
  });
  await assert.rejects(createClient('https://api.example').allProjects('dpwh', { q: 'Liloan' }), /4,001.*4,000/);
  assert.equal(requests, 1);
});
