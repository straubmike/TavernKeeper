'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import React, { useEffect, useState } from 'react';
import { createPublicClient, createWalletClient, custom, http } from 'viem';
import { monad } from '../lib/chains';
import { OfficeState, tavernKeeperService } from '../lib/services/tavernKeeperService';
import { theCellarService } from '../lib/services/theCellarService';
import { useGameStore } from '../lib/stores/gameStore';
import { GameView } from '../lib/types';
import { TheOfficeView } from './TheOfficeView';

export const TheOffice: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
    const { authenticated, user, logout } = usePrivy();
    const { wallets } = useWallets();
    const { keepBalance, currentView } = useGameStore();

    const wallet = wallets.find((w) => w.address === user?.wallet?.address);
    const address = user?.wallet?.address;
    const isConnected = authenticated && !!wallet;
    const chainId = wallet?.chainId ? parseInt(wallet.chainId.split(':')[1]) : undefined;
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
        startTime: 0,
        nextDps: '0',
        initPrice: '0'
    });
    const [isLoading, setIsLoading] = useState(false);
    const [timeHeld, setTimeHeld] = useState<string>('0m 0s');
    const [viewMode, setViewMode] = useState<'office' | 'cellar'>('office');
    const [monBalance, setMonBalance] = useState<string>('0');

    // Sync viewMode with GameView.CELLAR
    useEffect(() => {
        if (currentView === GameView.CELLAR) {
            setViewMode('cellar');
        } else if (currentView === GameView.INN) {
            setViewMode('office');
        }
    }, [currentView]);

    const [interpolatedState, setInterpolatedState] = useState<OfficeState>(state);
    const [pnl, setPnl] = useState<string>('$0.00');
    const [refreshKey, setRefreshKey] = useState<number>(0);

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

    // Fetch MON balance (native token)
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

    // Interpolation Loop
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            const timeSinceStart = (now - state.kingSince) / 1000; // seconds

            // 1. Time Held
            const minutes = Math.floor(timeSinceStart / 60);
            const seconds = Math.floor(timeSinceStart % 60);
            setTimeHeld(`${minutes}m ${seconds}s`);

            // 2. Interpolate Price (Dutch Auction)
            // Price decays linearly from initPrice to MIN_PRICE over 1 hour (3600s)
            const EPOCH_PERIOD = 3600;
            const MIN_PRICE = 1.0; // Minimum price is always 1 MON (contract enforces this)
            const initPrice = Math.max(MIN_PRICE, parseFloat(state.initPrice || '1.0'));
            let currentPrice = MIN_PRICE;

            if (timeSinceStart < EPOCH_PERIOD && initPrice > MIN_PRICE) {
                // Linear decay from initPrice to MIN_PRICE
                const decayProgress = timeSinceStart / EPOCH_PERIOD;
                currentPrice = initPrice - (initPrice - MIN_PRICE) * decayProgress;
            }
            // Ensure price never goes below minimum
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
                totalEarned: earned.toFixed(2)
            }));

        }, 1000);
        return () => clearInterval(interval);
    }, [state]);

    const handleTakeOffice = async () => {
        if (!address || !isConnected || !wallet) {
            alert('Please connect your wallet first!');
            return;
        }

        if (chainId !== monad.id) {
            try {
                await wallet.switchChain(monad.id);
            } catch (error) {
                console.error('Failed to switch chain:', error);
                alert('Please switch to Monad Testnet manually.');
            }
            return;
        }

        await executeTakeOffice(wallet, address);
    };

    const executeTakeOffice = async (wallet: any, clientAddress: string) => {
        try {
            setIsLoading(true);
            const provider = await wallet.getEthereumProvider();
            const client = createWalletClient({
                account: clientAddress as `0x${string}`,
                chain: monad,
                transport: custom(provider)
            });

            // The takeOffice function will fetch fresh state and use the contract's actual price
            // We pass a placeholder value - the service will use the contract's price directly
            const hash = await tavernKeeperService.takeOffice(client, '0', clientAddress);
            console.log('Transaction sent:', hash);
            alert('Transaction sent! Waiting for confirmation...');

            // Wait for transaction confirmation
            try {
                const publicClient = createPublicClient({
                    chain: monad,
                    transport: http(),
                });
                await publicClient.waitForTransactionReceipt({ hash });
                console.log('Transaction confirmed!');

                // Clear caches and force refresh both states
                theCellarService.clearCache();
                tavernKeeperService._cache.data = null;
                tavernKeeperService._cache.timestamp = 0;

                // Force refresh office state
                await fetchOfficeState(true);

                // Trigger cellar refresh in TheOfficeView
                setRefreshKey(prev => prev + 1);
            } catch (waitError) {
                console.error('Error waiting for transaction:', waitError);
                // Still refresh after delay if wait fails
                setTimeout(async () => {
                    theCellarService.clearCache();
                    tavernKeeperService._cache.data = null;
                    tavernKeeperService._cache.timestamp = 0;
                    await fetchOfficeState(true);
                    setRefreshKey(prev => prev + 1);
                }, 5000);
            }
        } catch (error) {
            console.error('Failed to take office:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            alert(`Failed to take office: ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    };

    const isKing = address && state.currentKing && address.toLowerCase() === state.currentKing.toLowerCase();

    const handleClaim = async () => {
        if (!address || !isConnected || !wallet || !isKing) return;

        try {
            setIsLoading(true);
            const provider = await wallet.getEthereumProvider();
            const client = createWalletClient({
                account: address as `0x${string}`,
                chain: monad,
                transport: custom(provider)
            });

            await tavernKeeperService.claimOfficeRewards(client, address);
            alert('Rewards claimed successfully!');
            fetchOfficeState();
        } catch (error) {
            console.error('Failed to claim rewards:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            alert(`Failed to claim rewards: ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <TheOfficeView
            state={interpolatedState}
            timeHeld={timeHeld}
            keepBalance={keepBalance}
            isLoading={isLoading}
            walletReady={isConnected}
            isWalletConnected={isConnected}
            isWrongNetwork={isConnected && chainId !== monad.id}
            onTakeOffice={handleTakeOffice}
            onDisconnect={() => logout()}
            pnl={pnl}
            isKing={!!isKing}
            viewMode={viewMode}
            onViewSwitch={setViewMode}
            monBalance={monBalance}
            onClaim={handleClaim}
            refreshKey={refreshKey}
        >
            {children}
        </TheOfficeView>
    );
};
