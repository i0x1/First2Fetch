import { cn } from '@/lib/utils';

import { Navbar } from '../components/navbar';

/**
 * Default layout for all pages
 */
export function DefaultLayout({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="ml-14 min-h-screen bg-background">
        <div className={cn('min-w-0 px-3 py-2', className)}>{children}</div>
      </main>
    </>
  );
}
