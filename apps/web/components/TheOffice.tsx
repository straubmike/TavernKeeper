'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import React, { useEffect, useState } from 'react';
import { createPublicClient, createWalletClient, custom, http, type Address } from 'viem';
import { useAccount, useConnect, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { monad } from '../lib/chains';
import { getFarcasterWalletAddress } from '../lib/services/farcasterWallet';
import { setOfficeManagerData } from '../lib/services/officeManagerCache';
import { OfficeState, tavernKeeperService } from '../lib/services/tavernKeeperService';
import { CellarState, theCellarService } from '../lib/services/theCellarService';
import { useGameStore } from '../lib/stores/gameStore';
import { GameView } from '../lib/types';
import { isInFarcasterMiniapp } from '../lib/utils/farcasterDetection';
import { TheOfficeView } from './TheOfficeView';

type UserContext = {
    fid?: number;
    username?: string;
    displayName?: string;
    pfpUrl?: string;
} | undefined;

export const TheOffice: React.FC<{
    children?: React.ReactNode;
    userContext?: UserContext;
}> = ({ children, userContext }) => {
    const { keepBalance, currentView } = useGameStore();

    // Detect context
    const isMiniapp = isInFarcasterMiniapp();

    // Use context-appropriate hooks (both available, just use the right one)
    const privy = usePrivy(); // Available in web context
    const { wallets } = useWallets(); // For web
    const { address: wagmiAddress, isConnected: wagmiConnected, chainId: wagmiChainId } = useAccount(); // Available in miniapp
    const { connectAsync, connectors } = useConnect(); // For miniapp
    const { writeContract, data: txHash, isPending: isWriting, reset: resetWrite } = useWriteContract(); // For miniapp
    const { data: receipt, isLoading: isConfirming } = useWaitForTransactionReceipt({
        hash: txHash,
        chainId: monad.id,
    });

    // Fallback to Farcaster SDK if wagmi connection fails (for miniapp context)
    const [farcasterAddress, setFarcasterAddress] = useState<Address | null>(null);

    useEffect(() => {
        if (!isMiniapp) {
            setFarcasterAddress(null);
            return;
        }

        // Check Farcaster SDK immediately on mount and as fallback
        const checkFarcaster = async () => {
            try {
                const addr = await getFarcasterWalletAddress();
                setFarcasterAddress(addr);
            } catch (error) {
                console.debug('Farcaster wallet not available:', error);
                setFarcasterAddress(null);
            }
        };

        checkFarcaster();

        // Only poll if wagmi is not connected (to avoid unnecessary checks)
        if (!wagmiConnected) {
            const interval = setInterval(checkFarcaster, 2000);
            return () => clearInterval(interval);
        }
    }, [isMiniapp, wagmiConnected]);

    // Unified state based on context
    const privyWallet = wallets.find((w) => w.address === privy.user?.wallet?.address);
    const address = isMiniapp ? (wagmiAddress || farcasterAddress) : privy.user?.wallet?.address;
    const isConnected = isMiniapp ? (wagmiConnected || !!farcasterAddress) : (privy.authenticated && !!privyWallet);
    const chainId = isMiniapp ? wagmiChainId : (privyWallet?.chainId ? parseInt(privyWallet.chainId.split(':')[1]) : undefined);

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
        startTime: isMiniapp ? Math.floor(Date.now() / 1000) : 0,
        nextDps: '0',
        initPrice: '0'
    });
    const [isLoading, setIsLoading] = useState(false);
    const [timeHeld, setTimeHeld] = useState<string>('0m 0s');
    const [viewMode, setViewMode] = useState<'office' | 'cellar'>('office');
    const [monBalance, setMonBalance] = useState<string>('0');
    const [cellarState, setCellarState] = useState<CellarState | null>(null);
    const [pnl, setPnl] = useState<string>('$0.00');
    const [interpolatedState, setInterpolatedState] = useState<OfficeState>(state);
    const [refreshKey, setRefreshKey] = useState<number>(0);

    // Sync viewMode with GameView.CELLAR
    useEffect(() => {
        if (currentView === GameView.CELLAR) {
            setViewMode('cellar');
        } else if (currentView === GameView.INN) {
            setViewMode('office');
        }
    }, [currentView]);

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

    // Fetch Cellar State (for miniapp, also works in web)
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
    }, [state.kingSince, state.initPrice, state.officeRate]);

    // Handle transaction receipt (for miniapp/wagmi)
    useEffect(() => {
        if (!isMiniapp || !receipt) return;
        if (receipt.status === 'success' || receipt.status === 'reverted') {
            setIsLoading(false);
            theCellarService.clearCache();

            // Capture previous manager address before state refresh
            const previousManagerAddress = state.currentKing;

            // If transaction was successful and we have userContext, cache the FID/name
            if (receipt.status === 'success' && address && userContext && (userContext.fid || userContext.username)) {
                setOfficeManagerData(address, {
                    fid: userContext.fid,
                    username: userContext.username,
                    displayName: userContext.displayName,
                });
            }

            // Send notification to previous manager if office was taken
            if (receipt.status === 'success' && previousManagerAddress &&
                previousManagerAddress !== '0x0000000000000000000000000000000000000000' &&
                previousManagerAddress.toLowerCase() !== address?.toLowerCase()) {

                // Send notification asynchronously (don't await - don't block UI)
                fetch('/api/office/notify-previous-manager', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        previousManagerAddress,
                        newManagerAddress: address,
                        pricePaid: state.currentPrice
                    })
                }).catch(err => console.error('Failed to send notification:', err));
            }

            fetchOfficeState(true); // Force refresh after transaction
            const resetTimer = setTimeout(() => {
                resetWrite();
            }, 500);
            return () => clearTimeout(resetTimer);
        }
    }, [receipt, resetWrite, address, userContext, state.currentKing, state.currentPrice, isMiniapp]);

    const { switchChainAsync } = useSwitchChain(); // For miniapp

    // Unified transaction handlers
    const handleTakeOffice = async () => {
        if (isMiniapp) {
            // Miniapp: Use wagmi writeContract

            // 1. Ensure Connected
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

            // 2. Ensure Correct Network
            if (chainId !== monad.id) {
                try {
                    await switchChainAsync({ chainId: monad.id });
                } catch (error) {
                    console.error('Failed to switch network:', error);
                    alert('Please switch to Monad Mainnet manually.');
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
                    address as Address
                );
                console.log('Transaction sent:', hash);
                // Don't set isLoading to false here - let the receipt handler do it
            } catch (error) {
                console.error('Failed to take office:', error);
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                alert(`Failed to take office: ${errorMessage}`);
                setIsLoading(false);
            }
        } else {
            // Web: Use Privy wallet client
            if (!address || !isConnected || !privyWallet) {
                alert('Please connect your wallet first!');
                return;
            }

            if (chainId !== monad.id) {
                try {
                    await privyWallet.switchChain(monad.id);
                } catch (error) {
                    console.error('Failed to switch chain:', error);
                    alert('Please switch to Monad Mainnet manually.');
                }
                return;
            }

            await executeTakeOffice(privyWallet, address);
        }
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
    const isLoadingState = isLoading || (isMiniapp && (isWriting || isConfirming));

    // Additional loading state check for miniapp
    useEffect(() => {
        if (isMiniapp && receipt && (receipt.status === 'success' || receipt.status === 'reverted')) {
            setIsLoading(false);
        }
    }, [receipt, isMiniapp]);

    const handleClaim = async () => {
        if (!address || !isConnected || !isKing) {
            alert('You must be the office holder to claim rewards.');
            return;
        }

        if (isMiniapp) {
            // Miniapp: Use wagmi writeContract
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
                    account: address as Address,
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
        } else {
            // Web: Use Privy wallet client
            if (!privyWallet) return;

            try {
                setIsLoading(true);
                const provider = await privyWallet.getEthereumProvider();
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
        }
    };

    const walletReady = isConnected && !!address;

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
            onDisconnect={isMiniapp ? undefined : () => privy.logout()}
            pnl={pnl}
            isKing={!!isKing}
            viewMode={viewMode}
            onViewSwitch={setViewMode}
            monBalance={monBalance}
            cellarState={cellarState}
            onClaim={handleClaim}
            refreshKey={refreshKey}
        >
            {children}
        </TheOfficeView>
    );
};
