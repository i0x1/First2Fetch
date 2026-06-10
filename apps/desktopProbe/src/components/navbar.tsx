import {
  BackpackIcon,
  ChatBubbleIcon,
  Crosshair2Icon,
  ExitIcon,
  GearIcon,
  MagnifyingGlassIcon,
  MoonIcon,
  QuestionMarkCircledIcon,
  SunIcon,
} from '@radix-ui/react-icons';
import { Activity, LoaderCircle } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

import { useAppState } from '@/hooks/appState';
import { useError } from '@/hooks/error';
import { forceQuitApp } from '@/lib/electronMainSdk';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@first2apply/ui';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

export function Navbar() {
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const { isScanning, newUpdate } = useAppState();
  const { handleError } = useError();

  const hasUpdate = !!newUpdate;

  const onForceQuit = async () => {
    try {
      await forceQuitApp();
    } catch (error) {
      handleError({ error, title: 'Failed to quit application' });
    }
  };

  const navItems = [
    { name: 'Jobs', path: '/', icon: <BackpackIcon className="h-4 w-4" /> },
    { name: 'Searches', path: '/links', icon: <MagnifyingGlassIcon className="h-4 w-4" /> },
    { name: 'Smart Filters', path: '/filters', icon: <Crosshair2Icon className="h-4 w-4" /> },
    { name: 'Status', path: '/status', icon: <Activity className="h-4 w-4" /> },
    { name: 'Settings', path: '/settings', icon: <GearIcon className="h-4 w-4" />, badge: hasUpdate },
    { name: 'Help', path: '/help', icon: <QuestionMarkCircledIcon className="h-4 w-4" /> },
    { name: 'Feedback', path: '/feedback', icon: <ChatBubbleIcon className="h-4 w-4" /> },
  ];

  const Logo = () =>
    isScanning ? (
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-white">
        <LoaderCircle className="h-4 w-4 animate-spin" />
      </span>
    ) : (
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-[11px] font-extrabold text-white">
        F2
      </span>
    );

  return (
    <nav className="fixed z-50 flex h-screen w-14 flex-col items-center justify-between border-r border-[#152a45] bg-sidebar px-1.5 py-2.5 text-sidebar-foreground">
      <div className="flex w-full flex-col gap-3">
        <TooltipProvider delayDuration={400}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link to={isScanning ? '/status' : '/'} className="flex items-center justify-center pb-2">
                <Logo />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">{isScanning ? 'Scanning...' : 'First2Fetch'}</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="flex w-full flex-col gap-0.5">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <TooltipProvider delayDuration={400} key={item.name}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      to={item.path}
                      className={cn(
                        'relative flex h-9 items-center justify-center rounded-md transition-colors',
                        active
                          ? 'bg-primary/20 text-white shadow-[inset_3px_0_0_0_hsl(var(--primary))]'
                          : 'text-sidebar-muted hover:bg-white/10 hover:text-sidebar-foreground',
                      )}
                    >
                      {item.icon}
                      {item.badge ? (
                        <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-destructive" />
                      ) : null}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.name}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
      </div>

      <div className="flex w-full flex-col gap-1">
        <TooltipProvider delayDuration={400}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="flex h-8 w-full items-center justify-center rounded-md border border-white/15 bg-white/[0.06] text-sidebar-muted hover:bg-white/10 hover:text-sidebar-foreground"
              >
                {theme === 'dark' ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{theme === 'dark' ? 'Light mode' : 'Night mode'}</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider delayDuration={400}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onForceQuit}
                className="flex h-8 w-full items-center justify-center rounded-md border border-white/15 bg-white/[0.06] text-destructive hover:bg-destructive/10"
              >
                <ExitIcon className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Quit</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </nav>
  );
}
