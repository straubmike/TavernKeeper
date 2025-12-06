'use client';

import Link from 'next/link';
import { PixelBox, PixelButton } from '../components/PixelComponents';

export default function NotFound() {
    return (
        <main className="min-h-screen bg-[#1a120b] flex items-center justify-center font-pixel p-4">
            <PixelBox variant="wood" className="max-w-md w-full text-center">
                <h1 className="text-4xl font-bold text-[#eaddcf] mb-4">404</h1>
                <h2 className="text-xl font-bold text-[#a8a29e] mb-4">Page Not Found</h2>
                <p className="text-[#eaddcf] mb-6 text-sm">
                    The page you're looking for doesn't exist or has been moved.
                </p>
                <Link href="/">
                    <PixelButton variant="primary" className="!px-4 !py-2">
                        Return Home
                    </PixelButton>
                </Link>
            </PixelBox>
        </main>
    );
}
