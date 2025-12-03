import type { Metadata } from 'next';
import { MiniappProvider } from '../../components/providers/MiniappProvider';
import '../globals.css';

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tavernkeeper.xyz';

// Farcaster Miniapp Frame Metadata
const frame = {
    version: "1",
    imageUrl: `${appUrl}/image.png`,
    button: {
        title: "Play InnKeeper",
        action: {
            type: "launch_frame",
            name: "InnKeeper",
            url: `${appUrl}/miniapp`,
            splashImageUrl: `${appUrl}/icon.png`,
            splashBackgroundColor: "#2a1d17"
        }
    }
};

export const metadata: Metadata = {
    title: 'TavernKeeper - Dungeon Crawler with AI Agents',
    description: 'Welcome back, traveler! The hearth is warm. A dungeon crawler game with AI agents, NFT heroes, and multiplayer parties.',
    openGraph: {
        title: 'TavernKeeper - Dungeon Crawler with AI Agents',
        description: 'Welcome back, traveler! The hearth is warm. A dungeon crawler game with AI agents, NFT heroes, and multiplayer parties.',
        url: `${appUrl}/miniapp`,
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
    other: {
        "fc:miniapp": JSON.stringify(frame)
    }
};

export default function MiniappLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body className="bg-black min-h-screen flex justify-center overflow-hidden">
                <MiniappProvider>
                    {children}
                </MiniappProvider>
            </body>
        </html>
    );
}
