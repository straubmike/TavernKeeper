'use client';

import { useEffect, useState } from 'react';
import { PixelButton, PixelPanel } from '../../../../components/PixelComponents';
import { useParams } from 'next/navigation';

export default function PartyInvitePage() {
    const params = useParams();
    const code = params.code as string;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [party, setParty] = useState<any>(null);

    useEffect(() => {
        if (!code) return;

        fetch(`/api/parties/invite/${code}`)
            .then(res => {
                if (!res.ok) throw new Error('Invalid or expired invite');
                return res.json();
            })
            .then(data => {
                setParty(data.party);
                setLoading(false);
            })
            .catch(err => {
                setError(err.message);
                setLoading(false);
            });
    }, [code]);

    const handleJoinWeb = () => {
        // Redirect to party page with invite code param to auto-trigger join modal?
        // Or just go to party page and let user manually join.
        // Ideally, we pass the code.
        window.location.href = `/miniapp-v2?party=${code}`;
    };

    const handleJoinMiniapp = () => {
        // Deep link to miniapp
        window.location.href = `miniapp://party/${code}`;
    };

    if (loading) {
        return (
            <main className="min-h-screen bg-[#2a1d17] flex items-center justify-center font-pixel text-yellow-400">
                Loading invite...
            </main>
        );
    }

    if (error) {
        return (
            <main className="min-h-screen bg-[#2a1d17] flex items-center justify-center font-pixel">
                <PixelPanel title="Error" variant="wood" className="max-w-md">
                    <p className="text-[#eaddcf] text-center mb-4">{error}</p>
                    <PixelButton variant="neutral" onClick={() => window.location.href = '/'} className="w-full">Back to Home</PixelButton>
                </PixelPanel>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[#2a1d17] flex items-center justify-center font-pixel p-4">
            <PixelPanel title="Party Invite" variant="paper" className="max-w-md w-full">
                <div className="text-center mb-6">
                    <h2 className="text-xl font-bold text-amber-950 mb-2">You've been invited!</h2>
                    <div className="bg-[#d4c5b0] p-4 rounded border border-[#8c7b63] mb-4">
                        <p className="text-amber-900 text-sm uppercase font-bold">Party ID</p>
                        <p className="text-amber-950 font-mono">{party.id.substring(0, 8)}...</p>
                        <p className="text-amber-900 text-xs mt-2">Status: {party.status}</p>
                    </div>
                </div>

                <div className="flex flex-col gap-3">
                    <PixelButton variant="primary" onClick={handleJoinWeb} className="w-full">
                        Join via Web App
                    </PixelButton>
                    <PixelButton variant="neutral" onClick={handleJoinMiniapp} className="w-full">
                        Open in Farcaster
                    </PixelButton>
                </div>
            </PixelPanel>
        </main>
    );
}
