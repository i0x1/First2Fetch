import Head from 'next/head';

const SITE_URL = 'https://i0x1.github.io/First2Fetch';

export function F2aHead({ title, description, path }: { title: string; description: string; path: string }) {
  const normalizedPath = path === '/' ? '' : `/${path.replace(/^\/|\/$/g, '')}`;
  const url = `${SITE_URL}${normalizedPath}/`;
  const previewImage = `${SITE_URL}/preview-image.png`;

  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="theme-color" content="#ffffff" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      <meta property="og:image" content={previewImage} />
      <meta property="og:url" content={url} />
      <meta property="og:site_name" content="First 2 Fetch" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={previewImage} />
      <link rel="apple-touch-icon" sizes="76x76" href="/First2Fetch/favicons/apple-touch-icon.png" />
      <link rel="icon" type="image/png" sizes="32x32" href="/First2Fetch/favicons/favicon-32x32.png" />
      <link rel="icon" type="image/png" sizes="16x16" href="/First2Fetch/favicons/favicon-16x16.png" />
      <link rel="manifest" href="/First2Fetch/favicons/site.webmanifest" />
      <link rel="mask-icon" href="/First2Fetch/favicons/safari-pinned-tab.svg" color="#81966b" />
      <link rel="canonical" href={url} />
    </Head>
  );
}
