import { EventEmitter } from 'events';

type AsyncTask<T> = () => Promise<T>;
type QueuedTask = {
  run: () => Promise<void>;
  reject: (error: Error) => void;
};

/**
 * A simple queue for managing concurrency of async tasks.
 */
export class WorkerQueue extends EventEmitter {
  private _queue: QueuedTask[] = [];
  private _currentlyActive = 0;
  private _isClosed = false;

  /**
   * Class constructor.
   */
  constructor(private _concurrency = 1) {
    super();
  }

  /**
   * Enqueue a task to be executed.
   */
  enqueue<T>(task: AsyncTask<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      if (this._isClosed) {
        reject(new Error('Worker queue is closed'));
        return;
      }

      this._queue.push({
        run: async () => {
          try {
            resolve(await task());
          } catch (error) {
            reject(error);
          }
        },
        reject,
      });
      this.next();
    });
  }

  /** Stop queued work and emit `empty` after active work finishes. */
  close() {
    this._isClosed = true;
    const queuedTasks = this._queue.splice(0);
    queuedTasks.forEach(({ reject }) => reject(new Error('Worker queue is closed')));

    if (this._currentlyActive === 0) this.emit('empty');
  }

  /**
   * Start the next task in the queue.
   */
  next() {
    if (this._isClosed) {
      if (this._currentlyActive === 0) this.emit('empty');
      return;
    }

    if (this._currentlyActive >= this._concurrency) {
      // too many tasks already running
      return;
    }

    // nothing to do if the queue is empty
    if (this._queue.length === 0) {
      // emit the empty event if the queue is empty and there are no tasks running
      if (this._currentlyActive === 0) this.emit('empty');

      return;
    }

    // start the next task
    this._currentlyActive++;
    const task = this._queue.shift();

    task!.run().finally(() => {
      this._currentlyActive--;
      this.next();
    });
  }
}
