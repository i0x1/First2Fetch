import { expect, it, vi } from 'vitest';

import { WorkerQueue } from './workerQueue';

it('rejects queued work on close and resolves when active work finishes', async () => {
  const queue = new WorkerQueue(1);
  let finishActive!: () => void;
  const active = queue.enqueue(() => new Promise<void>((resolve) => { finishActive = resolve; }));
  const queuedTask = vi.fn(async () => 'queued');
  const queued = queue.enqueue(queuedTask);
  const idle = new Promise<void>((resolve) => queue.once('empty', resolve));

  queue.close();

  await expect(queued).rejects.toThrow('Worker queue is closed');
  expect(queuedTask).not.toHaveBeenCalled();

  finishActive();
  await active;
  await idle;
});

it('rejects new work after close', async () => {
  const queue = new WorkerQueue(1);

  queue.close();

  await expect(queue.enqueue(async () => 'late')).rejects.toThrow('Worker queue is closed');
});
