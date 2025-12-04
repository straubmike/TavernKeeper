'use client';

import React, { useEffect, useState } from 'react';
import { createPublicClient, http } from 'viem';
import { useAccount, useConnect, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { monad } from '../lib/chains';
import { setOfficeManagerData } from '../lib/services/officeManagerCache';
import { OfficeState, tavernKeeperService } from '../lib/services/tavernKeeperService';
import { CellarState, theCellarService } from '../lib/services/theCellarService';
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
    const [monBalance, setMonBalance] = useState<string>('0');
    const [cellarState, setCellarState] = useState<CellarState | null>(null);
    const [pnl, setPnl] = useState<string>('$0.00');
    const [interpolatedState, setInterpolatedState] = useState<OfficeState>(state);

    // Use wagmi hooks for wallet connection
    const { address, isConnected, chainId } = useAccount();
    const { connectAsync, connectors, isPending: isConnecting } = useConnect();
    const { writeContract, data: txHash, isPending: isWriting, reset: resetWrite } = useWriteContract();
    const { data: receipt, isLoading: isConfirming } = useWaitForTransactionReceipt({
        hash: txHash,
        chainId: monad.id,
    });

    const walletReady = isConnected && !!address;

    // Check if current user is the office holder
    const isKing = address && state.currentKing && address.toLowerCase() === state.currentKing.toLowerCase();

    // Fetch Office State
    const fetchOfficeState = async (forceRefresh = false) => {
        const data = await tavernKeeperService.getOfficeState(forceRefresh);

        // Prevent flashing: If we have valid data and the new data is an error/offline state,
        // ignore the update to keep the UI stable.
        if (state.currentKing !== 'Loading...' && data.currentKing === 'OFFLINE') {
            console.warn("Background fetch failed, preserving existing state.");
            return;
        }

        setState(data);
        setInterpolatedState(data); // Reset interpolation on fetch
    };

    useEffect(() => {
        fetchOfficeState();
        const interval = setInterval(fetchOfficeState, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, []);

    // Fetch MON balance
    useEffect(() => {
        if (!address) {
            setMonBalance('0');
            return;
        }

        const fetchMonBalance = async () => {
            try {
                const publicClient = createPublicClient({
                    chain: monad,
                    transport: http(),
                });
                const balance = await publicClient.getBalance({
                    address: address as `0x${string}`,
                });
                setMonBalance(balance.toString());
            } catch (error) {
                console.error('Failed to fetch MON balance:', error);
            }
        };

        fetchMonBalance();
        const interval = setInterval(fetchMonBalance, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, [address]);

    // Fetch Cellar State
    useEffect(() => {
        const fetchCellar = async (forceRefresh = false) => {
            try {
                if (forceRefresh) {
                    theCellarService.clearCache();
                }
                const data = await theCellarService.getCellarState();
                setCellarState(data);
            } catch (e) {
                console.error("Failed to fetch cellar", e);
            }
        };

        fetchCellar();
        const interval = setInterval(() => fetchCellar(false), 5000);
        return () => clearInterval(interval);
    }, []);

    // Interpolation Loop for smooth updates
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            const timeSinceStart = (now - state.kingSince) / 1000; // seconds

            // 1. Time Held
            const minutes = Math.floor(timeSinceStart / 60);
            const seconds = Math.floor(timeSinceStart % 60);
            setTimeHeld(`${minutes}m ${seconds}s`);

            // 2. Interpolate Price (Dutch Auction)
            const EPOCH_PERIOD = 3600;
            const MIN_PRICE = 1.0;
            const initPrice = Math.max(MIN_PRICE, parseFloat(state.initPrice || '1.0'));
            let currentPrice = MIN_PRICE;

            if (timeSinceStart < EPOCH_PERIOD && initPrice > MIN_PRICE) {
                const decayProgress = timeSinceStart / EPOCH_PERIOD;
                currentPrice = initPrice - (initPrice - MIN_PRICE) * decayProgress;
            }
            currentPrice = Math.max(MIN_PRICE, currentPrice);

            // 3. Interpolate Earnings
            const dps = parseFloat(state.officeRate || '0');
            const earned = timeSinceStart * dps;

            // 4. Calculate PNL
            // Cost = Price Paid. We estimate this from initPrice.
            // newInitPrice = pricePaid * 2.0. So pricePaid = initPrice / 2.0.
            const pricePaid = initPrice / 2.0;
            // Revenue = 80% of currentPrice (if someone buys now)
            const revenue = currentPrice * 0.8;
            const pnlValue = revenue - pricePaid;

            // Format PNL
            const pnlFormatted = pnlValue >= 0
                ? `+Ξ${pnlValue.toFixed(4)}`
                : `-Ξ${Math.abs(pnlValue).toFixed(4)}`;
            setPnl(pnlFormatted);

            // Update Interpolated State
            setInterpolatedState(prev => ({
                ...prev,
                currentPrice: currentPrice.toFixed(4),
                totalEarned: earned.toFixed(2),
            }));
        }, 1000);
        return () => clearInterval(interval);
    }, [state.kingSince, state.initPrice, state.officeRate]);

    // Handle transaction receipt
    useEffect(() => {
        if (!receipt) return;
        if (receipt.status === 'success' || receipt.status === 'reverted') {
            setIsLoading(false);
            theCellarService.clearCache();

            // If transaction was successful and we have userContext, cache the FID/name
            if (receipt.status === 'success' && address && userContext && (userContext.fid || userContext.username)) {
                setOfficeManagerData(address, {
                    fid: userContext.fid,
                    username: userContext.username,
                    displayName: userContext.displayName,
                });
            }

            fetchOfficeState(true); // Force refresh after transaction
            const resetTimer = setTimeout(() => {
                resetWrite();
            }, 500);
            return () => clearTimeout(resetTimer);
        }
    }, [receipt, resetWrite, address, userContext]);

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
        if (!address || !isConnected || !isKing) {
            alert('You must be the office holder to claim rewards.');
            return;
        }

        try {
            setIsLoading(true);

            // Get contract address and ABI
            const { CONTRACT_REGISTRY, getContractAddress } = await import('../lib/contracts/registry');
            const contractConfig = CONTRACT_REGISTRY.TAVERNKEEPER;
            const contractAddress = getContractAddress(contractConfig);

            if (!contractAddress) {
                throw new Error("TavernKeeper contract not found");
            }

            const hash = await writeContract({
                address: contractAddress,
                abi: contractConfig.abi,
                functionName: 'claimOfficeRewards',
                args: [],
                account: address,
                chainId: monad.id,
            });

            console.log('Claim transaction sent:', hash);
            // Don't set isLoading to false here - let the receipt handler do it
        } catch (error) {
            console.error('Failed to claim rewards:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            alert(`Failed to claim rewards: ${errorMessage}`);
            setIsLoading(false);
        }
    };

    return (
        <TheOfficeView
            state={interpolatedState}
            timeHeld={timeHeld}
            keepBalance={keepBalance}
            isLoading={isLoadingState}
            walletReady={walletReady}
            isWalletConnected={isConnected && !!address}
            isWrongNetwork={isConnected && chainId !== monad.id}
            onTakeOffice={handleTakeOffice}
            viewMode={viewMode}
            onViewSwitch={setViewMode}
            onClaim={handleClaim}
            monBalance={monBalance}
            cellarState={cellarState}
            isKing={!!isKing}
            pnl={pnl}
        >
            {children}
        </TheOfficeView>
    );
};
