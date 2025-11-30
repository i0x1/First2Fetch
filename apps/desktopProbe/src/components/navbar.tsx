import {
  ChatBubbleIcon,
  Crosshair2Icon,
  ExitIcon,
  GearIcon,
  HomeIcon,
  MagnifyingGlassIcon,
  MoonIcon,
  QuestionMarkCircledIcon,
  SunIcon,
} from '@radix-ui/react-icons';
import { RefreshCw } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

import { Icons } from '@/components/icons';
import { useAppState } from '@/hooks/appState';
import { useError } from '@/hooks/error';
import { forceQuitApp } from '@/lib/electronMainSdk';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@first2apply/ui';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

export function Navbar() {
  // Hook to get the current location
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
    { name: 'Jobs', path: '/', icon: <HomeIcon className="h-5 w-5" /> },
    {
      name: 'Searches',
      path: '/links',
      icon: <MagnifyingGlassIcon className="h-5 w-5" />,
    },
    {
      name: 'AI Filters',
      path: '/filters',
      icon: <Crosshair2Icon className="h-5 w-5" />,
    },
    {
      name: 'Feedback',
      path: '/feedback',
      icon: <ChatBubbleIcon className="h-5 w-5" />,
    },
    {
      name: 'Settings',
      path: '/settings',

      icon: (
        <div className="relative">
          <GearIcon className="h-5 w-5" />
          {hasUpdate && <div className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-destructive"></div>}
        </div>
      ),
    },
    {
      name: 'Help',
      path: '/help',
      icon: <QuestionMarkCircledIcon className="h-5 w-5" />,
    },
  ];

  const Logo = () =>
    isScanning ? <RefreshCw className="h-6 w-6 animate-spin" /> : <Icons.logo className="h-6 w-6"></Icons.logo>;

  return (
    <nav className="fixed z-50 flex h-screen w-16 flex-col items-center justify-between border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-4 2xl:w-64 2xl:items-stretch transition-all duration-300">
      <div className="flex flex-col gap-6 w-full px-2">
        <TooltipProvider delayDuration={500}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link to={isScanning ? '/links' : '/'} className="flex items-center justify-center 2xl:justify-start gap-3 px-2 py-2">
                <Logo />
                <span className="hidden font-semibold tracking-tight 2xl:inline-block">{isScanning ? 'Scanning ...' : 'First 2 Apply'}</span>
              </Link>
            </TooltipTrigger>

            <TooltipContent side="right" className="text-sm 2xl:hidden">
              {isScanning ? 'Scanning for new jobs ...' : 'First 2 Apply'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="flex flex-col gap-1 w-full">
        {navItems.map((item) => (
          <TooltipProvider delayDuration={500} key={item.name}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  key={item.name}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 transition-colors duration-200 justify-center 2xl:justify-start",
                    location.pathname === item.path 
                      ? 'bg-accent text-accent-foreground shadow-sm' 
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground'
                  )}
                >
                  {item.icon}
                  <span className="hidden text-sm font-medium 2xl:inline-block">{item.name}</span>
                </Link>
              </TooltipTrigger>

              <TooltipContent side="right" className="text-sm 2xl:hidden">
                {item.name}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 w-full px-2">
        {/* theme toggle */}
        <TooltipProvider delayDuration={500}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors duration-200 justify-center 2xl:justify-start"
              >
                <div className="h-5 w-5">
                  {theme === 'dark' ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
                </div>
                <span className="hidden text-sm font-medium 2xl:inline-block">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
              </button>
            </TooltipTrigger>

            <TooltipContent side="right" className="text-sm 2xl:hidden">
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* force quit button */}
        <TooltipProvider delayDuration={500}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onForceQuit}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-destructive hover:bg-destructive/10 transition-colors duration-200 justify-center 2xl:justify-start"
              >
                 <div className="h-5 w-5">
                  <ExitIcon className="h-5 w-5" />
                </div>
                <span className="hidden text-sm font-medium 2xl:inline-block">Quit App</span>
              </button>
            </TooltipTrigger>

            <TooltipContent side="right" className="text-sm 2xl:hidden">
              Quit App
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </nav>
  );
}
