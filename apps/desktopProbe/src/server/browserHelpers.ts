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
      const runtimeData: WebPageRuntimeData = {
        linkedin: { type: SiteProvider.linkedin, comoRehydration: rehydrationScript },
      };

      storeRuntimeData(request.url, runtimeData);
      storeRuntimeData(response.url, runtimeData);

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
  for (const hash of getStoreHashesFromUrl(url)) {
    const data = runtimeDataStore.get(hash);
    if (data) {
      runtimeDataStore.delete(hash);
      return data;
    }
  }

  return {};
}

export function getStoreHashFromUrl(url: string): string {
  return createHash('sha256')
    .update(getRuntimeUrlVariants(url)[0] ?? url)
    .digest('hex');
}

function storeRuntimeData(url: string, data: WebPageRuntimeData): void {
  for (const hash of getStoreHashesFromUrl(url)) {
    runtimeDataStore.set(hash, data);
  }
}

function getStoreHashesFromUrl(url: string): string[] {
  return getRuntimeUrlVariants(url).map((urlToHash) => createHash('sha256').update(urlToHash).digest('hex'));
}

function getRuntimeUrlVariants(url: string): string[] {
  const variants = new Set<string>([url]);

  try {
    const urlObj = new URL(url);
    if (!urlObj.hostname.includes('linkedin.com') || !urlObj.pathname.startsWith('/jobs')) {
      return Array.from(variants);
    }

    const cleanUrl = new URL(urlObj.toString());
    cleanUrl.hash = '';
    ['currentJobId', 'selectedJobId'].forEach((param) => cleanUrl.searchParams.delete(param));
    variants.add(cleanUrl.toString());

    if (cleanUrl.pathname.startsWith('/jobs/search') || cleanUrl.pathname.startsWith('/jobs/search-results')) {
      const searchUrl = new URL(cleanUrl.toString());
      searchUrl.pathname = '/jobs/search/';
      variants.add(searchUrl.toString());

      const searchResultsUrl = new URL(cleanUrl.toString());
      searchResultsUrl.pathname = '/jobs/search-results/';
      variants.add(searchResultsUrl.toString());
    }
  } catch {
    // Keep the original URL variant if parsing fails.
  }

  return Array.from(variants);
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
