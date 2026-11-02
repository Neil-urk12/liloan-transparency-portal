import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const exec = promisify(execFile);
const root = process.cwd();

test('check uses build environment files, mode and process precedence', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'portal-check-'));
  const servers = await Promise.all(Array.from({ length: 4 }, async () => {
    const server = createServer((_req, res) => {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ meta: {}, disclaimers: [], data: { total: 1, rows: [{ id: 'test', dataset: 'dpwh', title: 'Test', bridge_group: 'unchanged', house_php: 1, nep_php: 1 }] } }));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    return server;
  }));
  const bases = servers.map((s) => `http://127.0.0.1:${(s.address() as { port: number }).port}`);
  t.after(async () => {
    await Promise.all(servers.map((s) => new Promise<void>((resolve, reject) => s.close((error) => error ? reject(error) : resolve()))));
    await rm(dir, { recursive: true, force: true });
  });
  await writeFile(join(dir, 'portal.config.ts'), `export default ${JSON.stringify({ id: 'test', kind: 'municipality', name: 'Test', operator: { name: 'Test' }, api: bases[0], scope: { offices: ['Test'] } })}`);
  const env = { ...process.env };
  delete env.VITE_API_BASE;
  const run = async (args: string[] = [], override?: string) => {
    const result = await exec(join(root, 'node_modules/.bin/tsx'), [join(root, 'scripts/check.ts'), ...args], { cwd: dir, env: { ...env, ...(override ? { VITE_API_BASE: override } : {}) } });
    return result.stdout;
  };
  await t.test('config API is the fallback', async () => {
    assert.ok((await run()).includes(`API ${bases[0]}`));
  });
  await writeFile(join(dir, '.env'), `VITE_API_BASE=${bases[1]}\n`);
  await t.test('loads .env', async () => {
    assert.ok((await run()).includes(`API ${bases[1]}`));
  });
  await writeFile(join(dir, '.env.production'), `VITE_API_BASE=${bases[2]}\n`);
  await writeFile(join(dir, '.env.staging'), `VITE_API_BASE=${bases[3]}\n`);
  await t.test('defaults to production, like vite build', async () => {
    assert.ok((await run()).includes(`API ${bases[2]}`));
  });
  await t.test('accepts --mode staging', async () => {
    assert.ok((await run(['--mode', 'staging'])).includes(`API ${bases[3]}`));
  });
  await t.test('accepts --mode=staging and loads the local override', async () => {
    await writeFile(join(dir, '.env.staging.local'), `VITE_API_BASE=${bases[1]}\n`);
    assert.ok((await run(['--mode=staging'])).includes(`API ${bases[1]}`));
  });
  await t.test('process variables override files', async () => {
    assert.ok((await run(['--mode=staging'], bases[0])).includes(`API ${bases[0]}`));
  });
});
