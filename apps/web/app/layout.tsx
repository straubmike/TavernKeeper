import type { Metadata, Viewport } from 'next';
import { Press_Start_2P } from 'next/font/google';
import './globals.css';

const pressStart2P = Press_Start_2P({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-press-start-2p',
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#2a1d17',
};

export const metadata: Metadata = {
  title: 'TavernKeeper - Dungeon Crawler with AI Agents',
  description: 'Welcome back, traveler! The hearth is warm. A dungeon crawler game with AI agents, NFT heroes, and multiplayer parties.',
  openGraph: {
    title: 'TavernKeeper - Dungeon Crawler with AI Agents',
    description: 'Welcome back, traveler! The hearth is warm. A dungeon crawler game with AI agents, NFT heroes, and multiplayer parties.',
    url: appUrl,
    siteName: 'TavernKeeper',
    images: [
      {
        url: `${appUrl}/image.png`,
        width: 1200,
        height: 630,
        alt: 'TavernKeeper - Dungeon Crawler Game',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TavernKeeper - Dungeon Crawler with AI Agents',
    description: 'Welcome back, traveler! The hearth is warm. A dungeon crawler game with AI agents, NFT heroes, and multiplayer parties.',
    images: [`${appUrl}/image.png`],
  },
  metadataBase: new URL(appUrl),
};

import { BottomNav } from '../components/BottomNav';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${pressStart2P.className} bg-black min-h-screen flex justify-center`}>
        {/* Mobile Container */}
        <div className="w-full max-w-[480px] h-[100dvh] bg-slate-900 relative flex flex-col shadow-2xl overflow-hidden border-x border-slate-800">

          {/* Main Content Area */}
          <div className="flex-1 overflow-y-auto relative [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
            {children}
          </div>

          {/* Bottom Navigation Bar */}
          <BottomNav />

          {/* Scanline Overlay */}
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-[100] bg-[length:100%_2px,3px_100%] opacity-20" />
        </div>
      </body>
    </html>
  );
}

