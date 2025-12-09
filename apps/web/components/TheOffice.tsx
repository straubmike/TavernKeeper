'use client';

import sdk from '@farcaster/miniapp-sdk';
import React, { useEffect, useState } from 'react';
import { createPublicClient, http, type Address } from 'viem';
import { useAccount, useConnect, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { monad } from '../lib/chains';
import { mcapService, type KeepMcapData } from '../lib/services/mcapService';
import { getMonPrice } from '../lib/services/monPriceService';
import { getOfficeManagerData, setOfficeManagerData } from '../lib/services/officeManagerCache';
import { officePnlService, type OfficePnlData } from '../lib/services/officePnlService';
import { OfficeState, tavernKeeperService } from '../lib/services/tavernKeeperService';
import { CellarState, theCellarService } from '../lib/services/theCellarService';
import { getPoolLiquidity } from '../lib/services/uniswapV4SwapService';
import { useGameStore } from '../lib/stores/gameStore';
import { GameView } from '../lib/types';
import { checkIsInFarcasterMiniapp } from '../lib/utils/farcasterDetection';
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

    // Detect context (async check)
    const [isMiniapp, setIsMiniapp] = React.useState(false);

    useEffect(() => {
        const checkMiniapp = async () => {
            try {
                const inMiniapp = await checkIsInFarcasterMiniapp();
                setIsMiniapp(inMiniapp);
            } catch (error) {
                console.error('Error checking miniapp status:', error);
                setIsMiniapp(false);
            }
        };
        checkMiniapp();
    }, []);

    // Unified Wagmi Hooks (Works for both Web via RainbowKit & Miniapp via Farcaster Connector)
    const { address, isConnected, chainId } = useAccount();
    const { connectAsync, connectors } = useConnect();
    const { switchChainAsync } = useSwitchChain();
    const { writeContractAsync, data: txHash, isPending: isWriting, reset: resetWrite } = useWriteContract();

    const { data: receipt, isLoading: isConfirming } = useWaitForTransactionReceipt({
        hash: txHash,
        chainId: monad.id,
    });

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
    const [viewMode, setViewMode] = useState<'office' | 'cellar' | 'staking' | 'posse' | 'regulars' | null>(null);
    const [monBalance, setMonBalance] = useState<string>('0');
    const [cellarState, setCellarState] = useState<CellarState | null>(null);
    const [pnl, setPnl] = useState<string>('$0.00');
    const [enhancedPnl, setEnhancedPnl] = useState<OfficePnlData | null>(null);
    const [interpolatedState, setInterpolatedState] = useState<OfficeState>(state);
    const [refreshKey, setRefreshKey] = useState<number>(0);
    const [poolMon, setPoolMon] = useState<bigint>(0n);
    const [poolKeep, setPoolKeep] = useState<bigint>(0n);
    const [mcapData, setMcapData] = useState<KeepMcapData | null>(null);

    // Set viewMode based on currentView
    useEffect(() => {
        if (currentView === GameView.CELLAR) {
            // When entering Office view, always start on Office tab
            setViewMode('office');
        } else {
            // When not in Office view (e.g., Tavern/INN), clear viewMode so tabs don't show
            setViewMode(null);
        }
    }, [currentView]);

    // Fetch pool liquidity and MCAP
    useEffect(() => {
        let cancelled = false;

        const fetchPoolData = async () => {
            // Delay initial fetch to let other components load first
            await new Promise(resolve => setTimeout(resolve, 1500));

            if (cancelled) return;

            try {
                // Fetch pool liquidity
                const poolLiquidity = await getPoolLiquidity();
                if (poolLiquidity && !cancelled) {
                    setPoolMon(poolLiquidity.mon);
                    setPoolKeep(poolLiquidity.keep);
                }

                // Fetch MCAP data
                const data = await mcapService.getKeepMcap();
                if (data && !cancelled) {
                    setMcapData(data);
                }
            } catch (error) {
                if (!cancelled) {
                    console.error('Error fetching pool data:', error);
                }
            }
        };

        fetchPoolData();
        const interval = setInterval(fetchPoolData, 30000); // Poll every 30s
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, []);

    // Fetch Office State
    const fetchOfficeState = async (forceRefresh = false) => {
        const data = await tavernKeeperService.getOfficeState(forceRefresh);

        if (state.currentKing !== 'Loading...' && data.currentKing === 'OFFLINE') {
            console.warn("Background fetch failed, preserving existing state.");
            return;
        }

        setState(data);
        setInterpolatedState(data);
    };

    // Sequenced data fetching
    useEffect(() => {
        let cancelled = false;

        const loadData = async () => {
            if (!cancelled) {
                await fetchOfficeState();
            }

            await new Promise(resolve => setTimeout(resolve, 500));
            if (!cancelled) {
                try {
                    const data = await theCellarService.getCellarState();
                    setCellarState(data);
                } catch (e) {
                    console.error("Failed to fetch cellar", e);
                }
            }

            // Load MON balance
            if (address && !cancelled) {
                await new Promise(resolve => setTimeout(resolve, 500));
                if (!cancelled) {
                    try {
                        const rpcUrl = monad.rpcUrls.default.http[0];
                        const publicClient = createPublicClient({
                            chain: monad,
                            transport: http(rpcUrl),
                        });
                        const balance = await publicClient.getBalance({
                            address: address,
                        });
                        setMonBalance(balance.toString());
                    } catch (error) {
                        console.error('Failed to fetch MON balance:', error);
                    }
                }
            }
        };

        loadData();
        return () => { cancelled = true; };
    }, [address]);

    // Poll office state periodically (every 30 seconds)
    useEffect(() => {
        const pollOfficeState = async () => {
            try {
                await fetchOfficeState(true); // Force refresh to get latest on-chain data
            } catch (e) {
                console.error("Failed to poll office state", e);
            }
        };

        pollOfficeState();
        const interval = setInterval(pollOfficeState, 30000); // Update every 30 seconds
        return () => clearInterval(interval);
    }, []);

    // Poll cellar state periodically
    useEffect(() => {
        const fetchCellarState = async () => {
            try {
                const data = await theCellarService.getCellarState(true); // Force refresh to bypass cache
                setCellarState(data);
            } catch (e) {
                console.error("Failed to fetch cellar state", e);
            }
        };

        fetchCellarState();
        const interval = setInterval(fetchCellarState, 30000); // Update every 30 seconds
        return () => clearInterval(interval);
    }, []);

    // Poll office state periodically (every 30 seconds) - ensures price and other state updates
    useEffect(() => {
        const pollOfficeState = async () => {
            try {
                await fetchOfficeState(true); // Force refresh to get latest on-chain data
            } catch (e) {
                console.error("Failed to poll office state", e);
            }
        };

        pollOfficeState();
        const interval = setInterval(pollOfficeState, 30000); // Update every 30 seconds
        return () => clearInterval(interval);
    }, []);

    // Interpolation Loop (updates UI smoothly between polling intervals)
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            const timeSinceStart = (now - state.kingSince) / 1000;

            const minutes = Math.floor(timeSinceStart / 60);
            const seconds = Math.floor(timeSinceStart % 60);
            setTimeHeld(`${minutes}m ${seconds}s`);

            const EPOCH_PERIOD = 3600;
            const MIN_PRICE = 1.0;
            const initPrice = Math.max(MIN_PRICE, parseFloat(state.initPrice || '1.0'));
            let currentPrice = MIN_PRICE;

            if (timeSinceStart < EPOCH_PERIOD && initPrice > MIN_PRICE) {
                const decayProgress = timeSinceStart / EPOCH_PERIOD;
                currentPrice = initPrice - (initPrice - MIN_PRICE) * decayProgress;
            }
            currentPrice = Math.max(MIN_PRICE, currentPrice);

            const dps = parseFloat(state.officeRate || '0');
            const earned = timeSinceStart * dps;

            // Match donut miner PnL calculation logic
            const halfInitPrice = initPrice / 2.0;
            const pnlValue = currentPrice > initPrice
                ? (currentPrice * 0.8) - halfInitPrice  // If price went UP: 80% of current - half init
                : currentPrice - halfInitPrice;          // If price went DOWN: current - half init

            const pnlFormatted = pnlValue >= 0
                ? `+Ξ${pnlValue.toFixed(4)}`
                : `-Ξ${Math.abs(pnlValue).toFixed(4)}`;
            setPnl(pnlFormatted);

            setInterpolatedState(prev => ({
                ...prev,
                currentPrice: currentPrice.toFixed(4),
                totalEarned: earned.toFixed(2)
            }));

        }, 5000);
        return () => clearInterval(interval);
    }, [state.kingSince, state.initPrice, state.officeRate]);

    // Calculate enhanced PnL (Dutch Auction + KEEP Earnings)
    useEffect(() => {
        // Only calculate if user is the current king
        if (!address || !state.currentKing || address.toLowerCase() !== state.currentKing.toLowerCase()) {
            setEnhancedPnl(null);
            return;
        }

        let cancelled = false;

        const calculateEnhancedPnl = async () => {
            try {
                const monPriceUsd = await getMonPrice();
                const pnlData = await officePnlService.calculateOfficePnl(state, monPriceUsd);

                if (!cancelled && pnlData) {
                    setEnhancedPnl(pnlData);
                }
            } catch (error) {
                if (!cancelled) {
                    console.error('Error calculating enhanced PnL:', error);
                }
            }
        };

        // Calculate immediately
        calculateEnhancedPnl();

        // Recalculate every 30 seconds
        const interval = setInterval(calculateEnhancedPnl, 30000);

        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [state, address]);

    // Handle transaction receipt
    useEffect(() => {
        if (!receipt) return;
        if (receipt.status === 'success' || receipt.status === 'reverted') {
            setIsLoading(false);
            theCellarService.clearCache();

            // Try to get previous manager from sessionStorage first (captured before transaction)
            // Fallback to state.currentKing if not found
            let previousManagerAddress: string | undefined;
            if (typeof window !== 'undefined' && receipt.transactionHash) {
                const stored = sessionStorage.getItem(`previousManager_${receipt.transactionHash}`);
                if (stored) {
                    previousManagerAddress = stored;
                    sessionStorage.removeItem(`previousManager_${receipt.transactionHash}`); // Clean up
                }
            }
            // Fallback to state.currentKing (might be updated already, but better than nothing)
            if (!previousManagerAddress) {
                previousManagerAddress = state.currentKing;
            }

            // Save office manager data to database (always try, even without userContext)
            if (receipt.status === 'success' && address) {
                // Save to local cache first (for immediate UI updates)
                if (userContext && (userContext.fid || userContext.username)) {
                    setOfficeManagerData(address, {
                        fid: userContext.fid,
                        username: userContext.username,
                        displayName: userContext.displayName,
                    });
                }

                // Always save to database (will fetch from Neynar if needed)
                fetch('/api/office/save-manager', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        address,
                        fid: userContext?.fid,
                        username: userContext?.username,
                        displayName: userContext?.displayName,
                    })
                }).catch(err => console.error('Failed to save office manager to database:', err));

                // Prompt user to share their office takeover on Farcaster (only in miniapp)
                // Double-check miniapp status before triggering compose cast
                (async () => {
                    try {
                        const doubleCheckMiniapp = await checkIsInFarcasterMiniapp();
                        if (doubleCheckMiniapp) {
                            // Small delay to let the transaction complete UI update
                            setTimeout(async () => {
                                try {
                                    // Get current user's username (from userContext or try to fetch)
                                    let currentUsername = userContext?.username;
                                    if (!currentUsername && address) {
                                        // Try to get username from database
                                        const currentManagerData = await getOfficeManagerData(address);
                                        currentUsername = currentManagerData?.username;
                                    }

                                    // Get previous manager username if available
                                    const previousManagerData = await getOfficeManagerData(previousManagerAddress);
                                    let shareText: string;

                                    if (previousManagerData?.username && currentUsername) {
                                        shareText = `@${currentUsername} just took the Office from @${previousManagerData.username}! 👑 Take it from them at tavernkeeper.xyz/miniapp`;
                                    } else if (currentUsername) {
                                        shareText = `@${currentUsername} just took the Office! 👑 Take it from them at tavernkeeper.xyz/miniapp`;
                                    } else if (previousManagerData?.username) {
                                        shareText = `I just took the Office from @${previousManagerData.username}! 👑 Take it from me at tavernkeeper.xyz/miniapp`;
                                    } else {
                                        shareText = `I just took the Office! 👑 Take it from me at tavernkeeper.xyz/miniapp`;
                                    }

                                    console.log('📝 Prompting user to compose cast...', {
                                        isMiniapp,
                                        doubleCheckMiniapp,
                                        hasUserContext: !!userContext,
                                        username: currentUsername,
                                        shareText
                                    });

                                    await sdk.actions.composeCast({
                                        text: shareText,
                                        embeds: [{ url: 'https://farcaster.xyz/miniapps/dDsKsz-XG5KU/tavernkeeper' }],
                                    });
                                    console.log('✅ Compose cast prompt completed');
                                } catch (error: any) {
                                    // User cancelled or error - log for debugging but don't show error to user
                                    console.warn('⚠️ Compose cast failed (user may have cancelled or SDK error):', {
                                        error: error?.message || error,
                                        errorType: error?.constructor?.name,
                                        isMiniapp,
                                        doubleCheckMiniapp,
                                        hasUserContext: !!userContext
                                    });
                                }
                            }, 1500);
                        } else {
                            console.log('ℹ️ Skipping compose cast - not in miniapp', { isMiniapp, doubleCheckMiniapp, hasUserContext: !!userContext });
                        }
                    } catch (error) {
                        console.error('Error checking miniapp status:', error);
                    }
                })();
            }

            if (receipt.status === 'success' && previousManagerAddress &&
                previousManagerAddress !== '0x0000000000000000000000000000000000000000' &&
                previousManagerAddress.toLowerCase() !== address?.toLowerCase()) {

                console.log('📨 Sending notification to previous manager:', previousManagerAddress);
                fetch('/api/office/notify-previous-manager', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        previousManagerAddress,
                        newManagerAddress: address,
                        pricePaid: state.currentPrice
                    })
                })
                    .then(async (response) => {
                        const data = await response.json();
                        if (response.ok && data.success) {
                            console.log('✅ Notification sent successfully:', data);
                        } else {
                            console.error('❌ Notification failed:', data);
                        }
                    })
                    .catch(err => {
                        console.error('❌ Failed to send notification:', err);
                    });
            }

            fetchOfficeState(true);
            const resetTimer = setTimeout(() => {
                resetWrite();
            }, 500);
            return () => clearTimeout(resetTimer);
        }
    }, [receipt, resetWrite, address, userContext, state.currentKing, state.currentPrice]);

    // ... (keep state defs)

    const handleTakeOffice = async () => {
        if (!isConnected || !address) {
            // ... (keep logic)
            alert('Please connect your wallet first.');
            return;
        }

        if (chainId !== monad.id) {
            // ... (keep logic)
            alert('Please switch to Monad Mainnet manually.');
            return;
        }

        // Check if user is trying to take office from themselves
        const currentKing = state.currentKing?.toLowerCase();
        const userAddress = address?.toLowerCase();
        if (currentKing && userAddress && currentKing === userAddress) {
            alert('⚠️ You already own the Office!\n\nTaking it from yourself does nothing - you\'ll just pay yourself back (minus fees).\n\nThe Office PnL shown is what the PREVIOUS owner would receive, not what you get from taking it.');
            return;
        }

        try {
            setIsLoading(true);

            // Fetch FRESH state BEFORE transaction to capture previous manager
            const freshState = await tavernKeeperService.getOfficeState(true);
            const previousManagerAddress = freshState.currentKing; // Capture BEFORE transaction

            const epochId = BigInt(freshState.epochId);
            const deadline = BigInt(Math.floor(Date.now() / 1000) + 300); // 5 mins

            // Calculate Price
            const { parseEther, formatEther } = await import('viem');
            const currentPriceWei = parseEther(freshState.currentPrice);
            const minPriceWei = parseEther('1.0');
            const effectivePriceWei = currentPriceWei < minPriceWei ? minPriceWei : currentPriceWei;
            const buffer = (effectivePriceWei * 5n) / 100n; // 5% buffer
            const safePrice = effectivePriceWei + buffer;

            console.log(`Taking Office: Epoch ${epochId}, Price ${freshState.currentPrice}, Sending ${formatEther(safePrice)}`);
            console.log(`Previous Manager: ${previousManagerAddress}`);

            const { CONTRACT_REGISTRY, getContractAddress } = await import('../lib/contracts/registry');
            const contractConfig = CONTRACT_REGISTRY.TAVERNKEEPER;
            const contractAddress = getContractAddress(contractConfig);

            if (!contractAddress) throw new Error("TavernKeeper contract not found");

            // Store previous manager address in a way that survives state updates
            // We'll use a ref or store it in the receipt handler
            const hash = await writeContractAsync({
                address: contractAddress,
                abi: contractConfig.abi,
                functionName: 'takeOffice',
                value: safePrice,
                args: [epochId, deadline, safePrice, ""], // maxPrice = safePrice
                account: address as Address,
                chainId: monad.id,
            });

            // Store previous manager address with the transaction hash for later retrieval
            // We'll use sessionStorage or a ref to persist this
            if (typeof window !== 'undefined') {
                sessionStorage.setItem(`previousManager_${hash}`, previousManagerAddress);
            }

            console.log('Transaction sent:', hash);
        } catch (error) {
            console.error('Failed to take office:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            alert(`Failed to take office: ${errorMessage}`);
            setIsLoading(false);
        }
    };

    const handleClaim = async () => {
        if (!address || !isConnected || !isKing) {
            alert('You must be the office holder to claim rewards.');
            return;
        }

        if (chainId !== monad.id) {
            try {
                await switchChainAsync({ chainId: monad.id });
                return;
            } catch (error) {
                alert('Please switch to Monad Mainnet manually.');
                return;
            }
        }

        try {
            setIsLoading(true);

            const { CONTRACT_REGISTRY, getContractAddress } = await import('../lib/contracts/registry');
            const contractConfig = CONTRACT_REGISTRY.TAVERNKEEPER;
            const contractAddress = getContractAddress(contractConfig);

            if (!contractAddress) {
                throw new Error("TavernKeeper contract not found");
            }

            const hash = await writeContractAsync({
                address: contractAddress as `0x${string}`,
                abi: contractConfig.abi,
                functionName: 'claimOfficeRewards',
                args: [],
                account: address as Address,
                chainId: monad.id,
            });

            console.log('Claim transaction sent:', hash);
        } catch (error) {
            console.error('Failed to claim rewards:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            alert(`Failed to claim rewards: ${errorMessage}`);
            setIsLoading(false);
        }
    };

    const isKing = address && state.currentKing && address.toLowerCase() === state.currentKing.toLowerCase();
    const isLoadingState = isLoading || isWriting || isConfirming;
    const walletReady = isConnected && !!address;

    // Test compose cast function - simulates what happens when someone takes office
    const handleTestComposeCast = async () => {
        try {
            const isMiniapp = checkIsInFarcasterMiniapp();
            if (!isMiniapp) {
                alert('This test only works in the Farcaster miniapp!');
                return;
            }

            // Get current user's username (from userContext or try to fetch)
            let currentUsername = userContext?.username;
            if (!currentUsername && address) {
                // Try to get username from database
                const currentManagerData = await getOfficeManagerData(address);
                currentUsername = currentManagerData?.username;
            }

            // Get previous manager username if available
            const previousManagerAddress = state.currentKing;
            const previousManagerData = previousManagerAddress && previousManagerAddress !== '0x0000000000000000000000000000000000000000'
                ? await getOfficeManagerData(previousManagerAddress)
                : null;

            let shareText: string;

            if (previousManagerData?.username && currentUsername) {
                shareText = `@${currentUsername} just took the Office from @${previousManagerData.username}! 👑 Take it from them at tavernkeeper.xyz/miniapp`;
            } else if (currentUsername) {
                shareText = `@${currentUsername} just took the Office! 👑 Take it from them at tavernkeeper.xyz/miniapp`;
            } else if (previousManagerData?.username) {
                shareText = `I just took the Office from @${previousManagerData.username}! 👑 Take it from me at tavernkeeper.xyz/miniapp`;
            } else {
                shareText = `I just took the Office! 👑 Take it from me at tavernkeeper.xyz/miniapp`;
            }

            console.log('🧪 Test compose cast:', {
                isMiniapp,
                hasUserContext: !!userContext,
                username: currentUsername,
                previousManager: previousManagerData?.username,
                shareText
            });

            await sdk.actions.composeCast({
                text: shareText,
                embeds: [{ url: 'https://farcaster.xyz/miniapps/dDsKsz-XG5KU/tavernkeeper' }],
            });

            console.log('✅ Test compose cast completed');
        } catch (error: any) {
            console.error('❌ Test compose cast failed:', {
                error: error?.message || error,
                errorType: error?.constructor?.name,
            });
            alert(`Test compose cast failed: ${error?.message || error}`);
        }
    };

    return (
        <TheOfficeView
            state={interpolatedState}
            timeHeld={timeHeld}
            keepBalance={keepBalance}
            isLoading={isLoadingState}
            walletReady={walletReady}
            isWalletConnected={walletReady}
            isWrongNetwork={walletReady && chainId !== monad.id}
            onTakeOffice={handleTakeOffice}
            onDisconnect={undefined} // Disconnect handled by main UI/RainbowKit/Context
            pnl={pnl}
            enhancedPnl={enhancedPnl}
            isKing={!!isKing}
            viewMode={viewMode}
            onViewSwitch={setViewMode}
            monBalance={monBalance}
            cellarState={cellarState}
            onClaim={handleClaim}
            refreshKey={refreshKey}
            poolMon={poolMon}
            poolKeep={poolKeep}
            mcapData={mcapData}
        >
            {children}
        </TheOfficeView>
    );
};
