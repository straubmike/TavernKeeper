'use client';

import React, { useEffect, useState } from 'react';
import { useAccount, useConnect, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { monad } from '../lib/chains';
import { OfficeState, tavernKeeperService } from '../lib/services/tavernKeeperService';
import { theCellarService } from '../lib/services/theCellarService';
import { useGameStore } from '../lib/stores/gameStore';
import { TheOfficeView } from './TheOfficeView';

type UserContext = {
    fid?: number;
    username?: string;
    displayName?: string;
    pfpUrl?: string;
} | undefined;

export const TheOfficeMiniapp: React.FC<{
    children?: React.ReactNode;
    userContext?: UserContext;
}> = ({ children, userContext }) => {
    const { keepBalance } = useGameStore();
    const [state, setState] = useState<OfficeState>({
        currentKing: 'Loading...',
        currentPrice: '0.00',
        kingSince: Date.now(),
        officeRate: '0',
        officeRateUsd: '$0.00',
        priceUsd: '$0.00',
        totalEarned: '0',
        totalEarnedUsd: '$0.00',
        epochId: 0,
        startTime: Math.floor(Date.now() / 1000),
        nextDps: '0',
        initPrice: '0'
    });
    const [isLoading, setIsLoading] = useState(false);
    const [timeHeld, setTimeHeld] = useState<string>('0m 0s');

    // Use wagmi hooks for wallet connection
    const { address, isConnected } = useAccount();
    const { connectAsync, connectors, isPending: isConnecting } = useConnect();
    const { writeContract, data: txHash, isPending: isWriting, reset: resetWrite } = useWriteContract();
    const { data: receipt, isLoading: isConfirming } = useWaitForTransactionReceipt({
        hash: txHash,
        chainId: monad.id,
    });

    const walletReady = isConnected && !!address;

    // Fetch Office State
    const fetchOfficeState = async () => {
        const data = await tavernKeeperService.getOfficeState();
        setState(data);
    };

    useEffect(() => {
        fetchOfficeState();
        const interval = setInterval(fetchOfficeState, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            const diff = Date.now() - state.kingSince;
            const minutes = Math.floor(diff / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            setTimeHeld(`${minutes}m ${seconds}s`);
        }, 1000);
        return () => clearInterval(interval);
    }, [state.kingSince]);

    // Handle transaction receipt
    useEffect(() => {
        if (!receipt) return;
        if (receipt.status === 'success' || receipt.status === 'reverted') {
            setIsLoading(false);
            theCellarService.clearCache();
            fetchOfficeState();
            const resetTimer = setTimeout(() => {
                resetWrite();
            }, 500);
            return () => clearTimeout(resetTimer);
        }
    }, [receipt, resetWrite]);

    const handleTakeOffice = async () => {
        if (!isConnected || !address) {
            // Try to connect if not connected
            if (!isConnected && connectors[0]) {
                try {
                    await connectAsync({
                        connector: connectors[0],
                        chainId: monad.id,
                    });
                    // Wait a bit for connection to complete
                    await new Promise(resolve => setTimeout(resolve, 500));
                    // Re-check after connection
                    if (!address) {
                        alert('Wallet connected but address not available. Please try again.');
                        return;
                    }
                } catch (error) {
                    alert('Failed to connect wallet. Please try again.');
                    return;
                }
            } else {
                alert('Wallet not connected. Please connect your wallet.');
                return;
            }
        }

        if (!address) {
            alert('Could not determine wallet address.');
            return;
        }

        try {
            setIsLoading(true);
            const hash = await tavernKeeperService.takeOfficeWithWriteContract(
                writeContract,
                state.currentPrice,
                address
            );
            console.log('Transaction sent:', hash);
            // Don't set isLoading to false here - let the receipt handler do it
        } catch (error) {
            console.error('Failed to take office:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            alert(`Failed to take office: ${errorMessage}`);
            setIsLoading(false);
        }
    };

    const isLoadingState = isLoading || isWriting || isConfirming;

    useEffect(() => {
        if (receipt && (receipt.status === 'success' || receipt.status === 'reverted')) {
            setIsLoading(false);
        }
    }, [receipt]);

    const [viewMode, setViewMode] = useState<'office' | 'cellar'>('office');

    const handleClaim = async () => {
        // Implement claim logic or leave empty for now
        console.log('Claiming rewards...');
    };

    return (
        <TheOfficeView
            state={state}
            timeHeld={timeHeld}
            keepBalance={keepBalance}
            isLoading={isLoadingState}
            walletReady={walletReady}
            isWalletConnected={isConnected && !!address}
            onTakeOffice={handleTakeOffice}
            viewMode={viewMode}
            onViewSwitch={setViewMode}
            onClaim={handleClaim}
            monBalance="0" // Placeholder
            cellarState={null} // Placeholder
        >
            {children}
            {/* Debug Info Overlay */}
            <div className="absolute top-0 left-0 w-full bg-black/80 text-[8px] text-green-400 p-2 pointer-events-none z-50 font-mono">
                <div>Wagmi: {isConnected ? 'Connected' : 'Not Connected'}</div>
                <div>Addr: {address ? address.slice(0, 6) + '...' : 'None'}</div>
                <div>User: {userContext?.username ? `@${userContext.username}` : userContext?.fid ? `FID ${userContext.fid}` : 'None'}</div>
            </div>
        </TheOfficeView>
    );
};
