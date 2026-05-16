import { SiteProvider, WebPageRuntimeData } from '@first2apply/core';
import { createHash } from 'crypto';
import { Session } from 'electron';

const runtimeDataStore = new Map<string, WebPageRuntimeData>();

const MAX_STORE_SIZE = 200;

function extractRehydrationScript(html: string): string | undefined {
  const scriptMatch = html.match(/<script[^>]+id\s*=\s*["']rehydrate-data["'][^>]*>([\s\S]*?)<\/script>/);
  return scriptMatch?.[1];
}

export function installLinkedInDecorator(session: Session): void {
  session.protocol.handle('https', async (request) => {
    const isGet = request.method === 'GET';
    const destination = request.headers.get('sec-fetch-dest');
    const accept = request.headers.get('accept') ?? '';
    const looksLikeDocument = destination === 'document' || accept.includes('text/html');

    if (!isGet || !looksLikeDocument) {
      return session.fetch(request, { bypassCustomProtocolHandlers: true });
    }

    const response = await session.fetch(request, { bypassCustomProtocolHandlers: true });

    const contentType = response.headers.get('content-type') ?? '';
    if (!request.url.includes('linkedin.com/jobs') || !contentType.includes('text/html')) {
      return response;
    }

    const rawHtml = await response.text();
    const rehydrationScript = extractRehydrationScript(rawHtml);

    if (rehydrationScript) {
      const hash = getStoreHashFromUrl(request.url);
      runtimeDataStore.set(hash, {
        linkedin: { type: SiteProvider.linkedin, comoRehydration: rehydrationScript },
      });

      if (runtimeDataStore.size > MAX_STORE_SIZE) {
        const oldestKey = runtimeDataStore.keys().next().value;
        if (oldestKey) runtimeDataStore.delete(oldestKey);
      }
    }

    return new Response(rawHtml, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  });
}

export function consumeRuntimeData(url: string): WebPageRuntimeData {
  const hash = getStoreHashFromUrl(url);
  const data = runtimeDataStore.get(hash);
  if (data) runtimeDataStore.delete(hash);
  return data ?? {};
}

export function getStoreHashFromUrl(url: string): string {
  let urlToHash = url;
  if (url.includes('linkedin.com/jobs/search-results')) {
    const urlObj = new URL(url);
    const ignoredParams = ['currentJobId'];
    const filteredParams = new URLSearchParams(
      [...urlObj.searchParams].filter(([key]) => !ignoredParams.includes(key)),
    );
    urlObj.search = filteredParams.toString();
    urlToHash = urlObj.toString();
  }

  return createHash('sha256').update(urlToHash).digest('hex');
}

export function getLinkedinReactContextBuilder(): string {
  return `
  const stringifyCircularJSON = obj => {
    const seen = new WeakSet();
    return JSON.stringify(obj, (k, v) => {
      if (v instanceof Window) return;
      if (v instanceof Element) return;
      if (v instanceof Document) return;

      if (typeof v === "bigint") return v.toString();
      if (v !== null && typeof v === 'object') {
        if (seen.has(v)) return;
        seen.add(v);
      }
      return v;
    });
  };

  const jobListElements = document.querySelectorAll("div[componentkey='SearchResultsMainContent'] div[componentkey]");
  jobListElements.forEach(el => {
    const reactKeys = Object.keys(el).filter(k => k.startsWith("__reactProps"));
    const reactContext = reactKeys.map(key => ({
      key,
      value: stringifyCircularJSON(el[key]),
    }));
    el.setAttribute('f2a-react-context', JSON.stringify(reactContext));
  });
`;
}
