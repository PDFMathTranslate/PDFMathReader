import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createKernelProcesses } from '../../../server/kernels/kernel-processes.mjs';

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
async function waitUntilStopped(pid) {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (!alive(pid)) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail(`Kernel process ${pid} survived shutdown`);
}
test('closing kernels terminates the worker and its descendants, and prevents new work', async () => {
  const processes = createKernelProcesses();
  const child = processes.spawn(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
  import {spawn} from 'node:child_process';
  const worker=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});
  worker.once('spawn',()=>console.log(worker.pid));
  setInterval(()=>{},1000);
 `,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const [data] = await once(child.stdout, 'data');
  const descendant = Number(String(data).trim());
  try {
    assert.ok(alive(child.pid));
    assert.ok(alive(descendant));
    const closing = processes.close();
    assert.equal(processes.close(), closing);
    assert.throws(() => processes.spawn(process.execPath, []), /closed/);
    assert.throws(() => processes.exec(process.execPath, []), /closed/);
    await closing;
    await waitUntilStopped(child.pid);
    await waitUntilStopped(descendant);
  } finally {
    await processes.close();
  }
});
