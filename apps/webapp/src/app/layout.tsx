import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'First 2 Fetch',
  description: 'Shared job review dashboard for First 2 Fetch.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
