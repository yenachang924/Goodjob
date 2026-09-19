import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
test('Pretendard is self hosted and shared by global and cockpit typography', async () => {
  const layout = await readFile('apps/web/app/layout.tsx', 'utf8');
  const global = await readFile('apps/web/app/globals.css', 'utf8');
  const cockpit = await readFile('apps/web/app/cockpit.css', 'utf8');
  assert.match(layout, /next\/font\/local/);
  assert.match(layout, /PretendardVariable\.woff2/);
  assert.match(layout, /pretendard\.variable/);
  assert.match(global, /--font-sans: var\(--font-pretendard\)/);
  assert.match(cockpit, /font-family: var\(--font-pretendard\)/);
  const font = await readFile('apps/web/app/fonts/PretendardVariable.woff2');
  assert.equal(font.subarray(0, 4).toString(), 'wOF2');
  assert.match(
    await readFile('apps/web/app/fonts/LICENSE', 'utf8'),
    /SIL OPEN FONT LICENSE/,
  );
});
