import { EventEmitter } from 'node:events';
import type { WebContents } from 'electron';
import { expect, it, vi } from 'vitest';

import { consumeRuntimeData, installLinkedInCapture } from './browserHelpers';

it('captures LinkedIn job data from the document response without an HTTPS protocol handler', async () => {
  const events = new EventEmitter();
  const sendCommand = vi.fn(async (method: string) => {
    if (method === 'Network.getResponseBody') {
      return { body: '<script id="rehydrate-data">window.jobs = [1]</script>', base64Encoded: false };
    }
    return {};
  });
  const debuggerSession = {
    isAttached: () => true,
    on: events.on.bind(events),
    sendCommand,
  };
  const contents = { debugger: debuggerSession } as unknown as WebContents;
  const url = 'https://www.linkedin.com/jobs/search/?test=capture';

  installLinkedInCapture(contents);
  events.emit('message', {}, 'Network.responseReceived', {
    requestId: 'document-1',
    type: 'Document',
    response: { url, mimeType: 'text/html' },
  });
  events.emit('message', {}, 'Network.loadingFinished', { requestId: 'document-1' });

  await vi.waitFor(() => {
    expect(consumeRuntimeData(url).linkedin?.comoRehydration).toBe('window.jobs = [1]');
  });
  expect(sendCommand).toHaveBeenCalledWith('Network.enable');
  expect(sendCommand).toHaveBeenCalledWith('Network.getResponseBody', { requestId: 'document-1' });
});
