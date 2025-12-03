import type { Metadata } from 'next';
import '../globals.css';

// Farcaster Miniapp Frame Metadata
const frame = {
    version: "1",
    imageUrl: "https://tavernkeeper.xyz/image.png",
    button: {
        title: "Play InnKeeper",
        action: {
            type: "launch_frame",
            name: "InnKeeper",
            url: "https://tavernkeeper.xyz/miniapp",
            splashImageUrl: "https://tavernkeeper.xyz/icon.png",
            splashBackgroundColor: "#2a1d17"
        }
    }
};

export const metadata: Metadata = {
    title: 'InnKeeper Miniapp',
    description: 'Play InnKeeper directly in Farcaster',
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
                {children}
            </body>
        </html>
    );
}
