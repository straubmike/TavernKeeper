'use client';

import HeroBuilder from '../../../components/heroes/HeroBuilder';
import { PixelButton } from '../../../components/PixelComponents';

// Force dynamic rendering to prevent Privy initialization during build
export const dynamic = 'force-dynamic';

export default function HeroBuilderPage() {
    return (
        <main className="min-h-screen p-4 sm:p-6 md:p-8 flex flex-col items-center gap-4 sm:gap-6 md:gap-8 font-pixel overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']" style={{
            backgroundColor: '#26211d',
            backgroundImage: 'radial-gradient(#26211d 2px, transparent 2px)',
            backgroundSize: '32px 32px',
            fontFamily: '"Press Start 2P", monospace'
        }}>
            <header className="w-full max-w-4xl flex justify-between items-center mb-4">
                <h1 className="text-2xl sm:text-3xl md:text-4xl text-yellow-400 drop-shadow-[2px_2px_0_rgba(0,0,0,1)] tracking-widest">Hero Builder</h1>
                <PixelButton variant="secondary" onClick={() => window.location.href = '/party'}>Back to Party</PixelButton>
            </header>

            <HeroBuilder />
        </main>
    );
}
