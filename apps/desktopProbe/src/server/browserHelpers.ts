import { SiteProvider, WebPageRuntimeData } from '@first2apply/core';
import { createHash } from 'crypto';
import type { WebContents } from 'electron';

const runtimeDataStore = new Map<string, WebPageRuntimeData>();

const MAX_STORE_SIZE = 200;

function extractRehydrationScript(html: string): string | undefined {
  const scriptMatch = html.match(/<script[^>]+id\s*=\s*["']rehydrate-data["'][^>]*>([\s\S]*?)<\/script>/);
  return scriptMatch?.[1];
}

export function installLinkedInCapture(contents: WebContents): void {
  const debuggerSession = contents.debugger;
  if (!debuggerSession.isAttached()) debuggerSession.attach('1.3');

  const documents = new Map<string, string>();
  debuggerSession.on('message', (_event, method, params) => {
    const requestId = params.requestId as string | undefined;
    if (!requestId) return;

    if (method === 'Network.responseReceived' && params.type === 'Document') {
      const url = params.response?.url as string | undefined;
      const contentType = params.response?.mimeType as string | undefined;
      if (url && isLinkedInJobsUrl(url) && contentType?.includes('html')) documents.set(requestId, url);
    }

    if (method === 'Network.loadingFailed') documents.delete(requestId);
    if (method !== 'Network.loadingFinished') return;

    const url = documents.get(requestId);
    documents.delete(requestId);
    if (!url) return;
    void debuggerSession.sendCommand('Network.getResponseBody', { requestId })
      .then((result: { body: string; base64Encoded: boolean }) => {
        const html = result.base64Encoded ? Buffer.from(result.body, 'base64').toString('utf8') : result.body;
        const rehydrationScript = extractRehydrationScript(html);
        if (!rehydrationScript) return;
        storeRuntimeData(url, {
          linkedin: { type: SiteProvider.linkedin, comoRehydration: rehydrationScript },
        });
        if (runtimeDataStore.size > MAX_STORE_SIZE) {
          const oldestKey = runtimeDataStore.keys().next().value;
          if (oldestKey) runtimeDataStore.delete(oldestKey);
        }
      })
      .catch((): void => {});
  });
  void debuggerSession.sendCommand('Network.enable').catch((): void => {});
}

function isLinkedInJobsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.hostname === 'linkedin.com' || url.hostname.endsWith('.linkedin.com')) && url.pathname.startsWith('/jobs');
  } catch {
    return false;
  }
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
