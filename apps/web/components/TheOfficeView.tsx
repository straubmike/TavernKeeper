'use client';

import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { formatEther } from 'viem';
import { type KeepMcapData } from '../lib/services/mcapService';
import { getMonPrice } from '../lib/services/monPriceService';
import { getOfficeManagerData } from '../lib/services/officeManagerCache';
import { type OfficePnlData } from '../lib/services/officePnlService';
import { OfficeState } from '../lib/services/tavernKeeperService';
import { CellarState, theCellarService } from '../lib/services/theCellarService';
import OfficeTabContent from './OfficeTabContent';
import { PixelBox, PixelButton } from './PixelComponents';
import StakingInterface from './StakingInterface';
import TheCellarView from './TheCellarView';

interface TheOfficeViewProps {
    state: OfficeState;
    timeHeld: string;
    keepBalance: string;
    isLoading: boolean;
    walletReady: boolean;
    isWalletConnected: boolean;
    isWrongNetwork?: boolean;
    onTakeOffice: () => Promise<void>;
    onDisconnect?: () => Promise<void>;
    children?: React.ReactNode;
    pnl?: string;
    enhancedPnl?: OfficePnlData | null;
    isKing?: boolean;
    // New props
    cellarState?: any;
    viewMode?: 'office' | 'cellar' | 'staking' | 'posse' | 'regulars' | null;
    monBalance?: string;
    onClaim?: () => void;
    onViewSwitch?: (mode: 'office' | 'cellar' | 'staking' | 'posse' | 'regulars' | null) => void;
    refreshKey?: number; // Key to trigger refresh when changed
    poolMon?: bigint;
    poolKeep?: bigint;
    mcapData?: KeepMcapData | null;
}

export const TheOfficeView: React.FC<TheOfficeViewProps> = ({
    state,
    timeHeld,
    keepBalance,
    isLoading,
    walletReady,
    isWalletConnected,
    isWrongNetwork,
    onTakeOffice,
    children,
    pnl,
    enhancedPnl,
    isKing = false,
    cellarState: propCellarState,
    viewMode = null,
    monBalance = '0',
    onClaim,
    onViewSwitch,
    refreshKey,
    poolMon = 0n,
    poolKeep = 0n,
    mcapData = null,
}) => {
    const [mounted, setMounted] = React.useState(false);
    const [cellarState, setCellarState] = React.useState<CellarState | null>(propCellarState || null);
    const [monPrice, setMonPrice] = useState<string>('Loading...');
    const [monPriceUsd, setMonPriceUsd] = useState<number>(0);
    const [showTakeOfficeModal, setShowTakeOfficeModal] = useState(false);
    const [showClaimModal, setShowClaimModal] = useState(false);
    const [isHeaderMinimized, setIsHeaderMinimized] = useState(false);

    // Format address for display (first 6 + last 4 chars)
    const formatAddress = (address: string): string => {
        if (!address || address === '0x0000000000000000000000000000000000000000' || address === 'Vacant' || address === 'Loading...') {
            return address;
        }
        if (address.length < 10) return address;
        return `${address.slice(0, 8)}...${address.slice(-4)}`;
    };

    // Get office manager data (from cache or database)
    const [officeManagerData, setOfficeManagerData] = React.useState<{ fid?: number; username?: string; displayName?: string } | null>(null);

    React.useEffect(() => {
        // Validate address before fetching
        if (!state.currentKing ||
            state.currentKing === '0x0000000000000000000000000000000000000000' ||
            state.currentKing === 'Loading...' ||
            state.currentKing === 'Vacant' ||
            !state.currentKing.startsWith('0x') ||
            state.currentKing.length !== 42) {
            setOfficeManagerData(null);
            return;
        }

        // Fetch office manager data (checks cache first, then database)
        getOfficeManagerData(state.currentKing).then(data => {
            setOfficeManagerData(data);
        }).catch(err => {
            console.error('Failed to fetch office manager data:', err);
            // Don't clear data on error - keep what we have
        });
    }, [state.currentKing]);


    React.useEffect(() => {
        setMounted(true);
        // Note: Cellar state is already fetched in TheOffice component parent
        // Only update if prop changes
        if (propCellarState) {
            setCellarState(propCellarState);
        }
    }, [propCellarState]);

    // Refresh cellar when refreshKey changes (only if prop not provided)
    React.useEffect(() => {
        if (refreshKey !== undefined && refreshKey > 0 && !propCellarState) {
            const fetchCellar = async () => {
                try {
                    theCellarService.clearCache();
                    const data = await theCellarService.getCellarState();
                    setCellarState(data);
                } catch (e) {
                    console.error("Failed to refresh cellar", e);
                }
            };
            fetchCellar();
        }
    }, [refreshKey, propCellarState]);

    // Fetch MON price periodically
    useEffect(() => {
        const fetchMonPrice = async () => {
            try {
                const price = await getMonPrice();
                setMonPriceUsd(price);
                setMonPrice(`$${price.toFixed(5)}`); // Show 5 decimals for precision
            } catch (e) {
                console.error('Failed to fetch MON price:', e);
                // Keep using last known price if available (monPriceUsd state persists)
            }
        };
        fetchMonPrice();
        const interval = setInterval(fetchMonPrice, 60000); // Update every minute
        return () => clearInterval(interval);
    }, []);

    // Prevent hydration mismatch by rendering a consistent state on server
    const buttonText = !mounted ? 'Connect Wallet' :
        isLoading ? 'Processing...' :
            !isWalletConnected ? 'Connect Wallet' :
                isWrongNetwork ? 'Switch Network' :
                    !walletReady ? 'Wallet Not Ready' :
                        'Take The Office';

    // Calculate Cellar PnL
    // Cost = Price (LP) (since 1 LP = 1 MON when 1:10 MON:KEEP ratio is enforced)
    // PnL = Pot (MON) - Cost (MON)
    let cellarPnL = "$0.00";
    let isCellarProfitable = false;

    if (cellarState) {
        const pot = parseFloat(cellarState.potSize || '0');
        const priceLP = parseFloat(cellarState.currentPrice || '0');
        const costMON = priceLP; // 1 LP = 1 MON (when 1:10 ratio is enforced)
        const profit = pot - costMON;

        isCellarProfitable = profit > 0;
        cellarPnL = (profit >= 0 ? "+" : "") + profit.toFixed(4) + " MON";
    }

    if (viewMode === 'cellar') {
        return (
            <>
                <TheCellarView
                    monBalance={monBalance}
                    keepBalance={keepBalance}
                />
                {/* Floating Back Button */}
                {onViewSwitch && (
                    <button
                        onClick={() => onViewSwitch('office')}
                        className="fixed bottom-20 left-4 z-50 w-12 h-12 bg-[#3e2b22] border-2 border-[#8c7b63] rounded-full flex items-center justify-center shadow-lg hover:bg-[#5c4033] transition-colors"
                        title="Back to Office"
                    >
                        <span className="text-xl">←</span>
                    </button>
                )}
            </>
        );
    }

    if (viewMode === 'staking') {
        return (
            <div className="w-full h-full flex flex-col font-pixel relative">
                <div className="flex-1 relative bg-[#1a120b] overflow-hidden flex flex-col">
                    <div
                        className="absolute inset-0 bg-repeat bg-center opacity-40 pointer-events-none"
                        style={{
                            backgroundImage: "url('/sprites/office_bg.png')",
                            backgroundSize: 'cover',
                            backgroundPosition: 'center'
                        }}
                    />
                    {/* Fallback solid color to prevent black bars */}
                    <div className="absolute inset-0 bg-[#1a120b] -z-10" />
                    <div className="relative z-10 flex-1 overflow-y-auto p-2">
                        <StakingInterface />
                    </div>
                    {/* Floating Back Button */}
                    {onViewSwitch && (
                        <button
                            onClick={() => onViewSwitch('office')}
                            className="fixed bottom-20 left-4 z-50 w-12 h-12 bg-[#3e2b22] border-2 border-[#8c7b63] rounded-full flex items-center justify-center shadow-lg hover:bg-[#5c4033] transition-colors"
                            title="Back to Office"
                        >
                            <span className="text-xl">←</span>
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full flex flex-col font-pixel relative">
            {/* Visual Area (Chat or Cellar) */}
            <div className="flex-1 relative bg-[#1a120b] overflow-hidden flex flex-col gap-4">
                {/* Background Image - Absolute to fill container with repeat */}
                <div
                    className="absolute inset-0 bg-repeat bg-center opacity-40 pointer-events-none"
                    style={{
                        backgroundImage: "url('/sprites/office_bg.png')",
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                    }}
                />
                {/* Fallback solid color to prevent black bars */}
                <div className="absolute inset-0 bg-[#1a120b] -z-10" />

                {/* Top Header - Protocol Info (Office & Cellar) - More compact */}
                <div className="relative bg-[#3e2b22] border-b-2 border-[#2a1d17] p-0.5 z-40 shadow-md flex flex-col gap-0.5 shrink-0">

                    {/* Error Banner */}
                    {state.error && (
                        <div className="bg-red-500 text-white text-[10px] font-bold p-1 text-center animate-pulse border-2 border-red-700">
                            ⚠️ {state.error} ⚠️
                        </div>
                    )}

                    {/* Row 1: Office Manager Info - More compact */}
                    <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1">
                            <div className="w-5 h-5 bg-[#5c4033] rounded border border-[#8c7b63] overflow-hidden relative shrink-0">
                                <div className="absolute inset-0 bg-[#8c7b63] flex items-center justify-center text-[10px] text-[#2a1d17]">
                                    👑
                                </div>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[6px] text-[#a8a29e] uppercase tracking-wider leading-none">Office Manager</span>
                                {officeManagerData && (officeManagerData.username || officeManagerData.fid) ? (
                                    <div className="flex flex-col">
                                        <span className="text-[#eaddcf] font-bold text-[9px] leading-none">
                                            {officeManagerData.username ? `@${officeManagerData.username}` : `FID: ${officeManagerData.fid}`}
                                        </span>
                                        <button
                                            onClick={() => {
                                                if (state.currentKing && state.currentKing !== '0x0000000000000000000000000000000000000000') {
                                                    navigator.clipboard.writeText(state.currentKing);
                                                }
                                            }}
                                            className="text-[#a8a29e] font-mono text-[7px] leading-none text-left hover:text-yellow-400 transition-colors cursor-pointer"
                                            title={`Click to copy: ${state.currentKing}`}
                                        >
                                            {formatAddress(state.currentKing)}
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => {
                                            if (state.currentKing && state.currentKing !== '0x0000000000000000000000000000000000000000') {
                                                navigator.clipboard.writeText(state.currentKing);
                                            }
                                        }}
                                        className="text-[#eaddcf] font-bold text-[9px] font-mono leading-none text-left hover:text-yellow-400 transition-colors cursor-pointer whitespace-nowrap"
                                        title={state.currentKing && state.currentKing !== '0x0000000000000000000000000000000000000000' ? `Click to copy: ${state.currentKing}` : 'Vacant'}
                                    >
                                        {state.currentKing && state.currentKing !== '0x0000000000000000000000000000000000000000' ? formatAddress(state.currentKing) : 'Vacant'}
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                            <div className="flex flex-col items-end">
                                <span className="text-[6px] text-[#a8a29e] uppercase tracking-wider leading-none">Time Held</span>
                                <span className="text-[#eaddcf] font-bold text-[9px] font-mono leading-none">{timeHeld}</span>
                            </div>
                            {state.currentKing && state.currentKing !== '0x0000000000000000000000000000000000000000' && (
                                <div className="flex flex-col items-end">
                                    <span className="text-[6px] text-[#a8a29e] uppercase tracking-wider leading-none">Earnings</span>
                                    <span className="text-[#eaddcf] font-bold text-[9px] font-mono leading-none">KEEP {state.totalEarned || '0.00'}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Minimize Toggle */}
                    <button
                        onClick={() => setIsHeaderMinimized(!isHeaderMinimized)}
                        className="absolute top-0.5 right-0.5 text-[#a8a29e] hover:text-[#eaddcf] transition-colors p-0.5"
                    >
                        {isHeaderMinimized ? <ChevronDown size={10} /> : <ChevronUp size={10} />}
                    </button>

                    {/* Row 2: Stats Grid (Office & Cellar) - Hidden when minimized, more compact */}
                    {!isHeaderMinimized && (
                        <div className="grid grid-cols-3 gap-0.5">
                            {/* Office Stats - More compact */}
                            <div className="bg-[#2a1d17] border border-[#5c4033] rounded p-0.5 flex flex-col items-center justify-center">
                                <div className="text-[5px] text-[#a8a29e] uppercase tracking-widest mb-0.5">Rate</div>
                                <div className="text-[#fbbf24] font-bold text-[9px]">
                                    {state.officeRate && !isNaN(parseFloat(state.officeRate)) ? parseFloat(state.officeRate).toFixed(3) : '0.000'}
                                    <span className="text-[5px] text-[#78716c]">/s</span>
                                </div>
                            </div>
                            <div className="bg-[#2a1d17] border border-[#5c4033] rounded p-0.5 flex flex-col items-center justify-center">
                                <div className="text-[5px] text-[#fca5a5] uppercase tracking-widest mb-0.5">Price</div>
                                <div className="text-[#f87171] font-bold text-[9px]">
                                    <span className="text-purple-400">{Math.max(1.0, parseFloat(state.currentPrice || '1.0')).toFixed(3)}</span>
                                    {monPriceUsd > 0 && (
                                        <span className="text-green-400 text-[7px]"> ${(Math.max(1.0, parseFloat(state.currentPrice || '1.0')) * monPriceUsd).toFixed(2)}</span>
                                    )}
                                </div>
                            </div>
                            <div className="bg-[#2a1d17] border border-[#5c4033] rounded p-0.5 flex flex-col items-center justify-center">
                                <div className="text-[5px] text-[#86efac] uppercase tracking-widest mb-0.5">PNL</div>
                                <div className={`font-bold text-[9px] ${enhancedPnl?.totalPnl.color === 'green' ? 'text-green-400' : enhancedPnl?.totalPnl.color === 'red' ? 'text-red-400' : (pnl && pnl.startsWith('+') ? 'text-green-400' : 'text-red-400')}`}>
                                    {enhancedPnl?.totalPnl.formatted || pnl || '$0.00'}
                                </div>
                            </div>

                            {/* Cellar Stats - More compact */}
                            <div className="bg-[#2a1d17] border border-[#5c4033] rounded p-0.5 flex flex-col items-center justify-center">
                                <div className="text-[5px] text-[#a8a29e] uppercase tracking-widest mb-0.5">Pot</div>
                                <div className="text-[#fbbf24] font-bold text-[9px]">{cellarState ? parseFloat(cellarState.potSize).toFixed(4) : '0.00'}</div>
                            </div>
                            <div className="bg-[#2a1d17] border border-[#5c4033] rounded p-0.5 flex flex-col items-center justify-center">
                                <div className="text-[5px] text-[#fca5a5] uppercase tracking-widest mb-0.5">Price</div>
                                <div className="text-[#f87171] font-bold text-[9px]">{cellarState ? parseFloat(cellarState.currentPrice).toFixed(2) : '0.00'} LP</div>
                            </div>
                            <div className="bg-[#2a1d17] border border-[#5c4033] rounded p-0.5 flex flex-col items-center justify-center">
                                <div className="text-[5px] text-[#86efac] uppercase tracking-widest mb-0.5">PNL</div>
                                <div className={`font-bold text-[9px] ${isCellarProfitable ? 'text-green-400' : 'text-red-400'}`}>{cellarPnL}</div>
                            </div>
                        </div>
                    )}

                    {/* Row 3: Pool Stats - Hidden when minimized */}
                    {!isHeaderMinimized && (
                        <div className="grid grid-cols-3 gap-0.5 mt-0.5">
                            <div className="bg-[#2a1d17] border border-[#5c4033] rounded p-0.5 flex flex-col items-center justify-center">
                                <div className="text-[5px] text-[#a8a29e] uppercase tracking-widest mb-0.5">Pool MON</div>
                                <div className="text-yellow-400 font-bold text-[9px] font-mono">
                                    {parseFloat(formatEther(poolMon)).toFixed(4)}
                                </div>
                            </div>
                            <div className="bg-[#2a1d17] border border-[#5c4033] rounded p-0.5 flex flex-col items-center justify-center">
                                <div className="text-[5px] text-[#a8a29e] uppercase tracking-widest mb-0.5">Pool KEEP</div>
                                <div className="text-orange-400 font-bold text-[9px] font-mono">
                                    {parseFloat(formatEther(poolKeep)).toFixed(2)}
                                </div>
                            </div>
                            <div className="bg-[#2a1d17] border border-[#5c4033] rounded p-0.5 flex flex-col items-center justify-center">
                                <div className="text-[5px] text-[#a8a29e] uppercase tracking-widest mb-0.5">MCAP</div>
                                <div className="text-green-400 font-bold text-[9px] font-mono">
                                    {mcapData?.mcapUsd ? `$${parseFloat(mcapData.mcapUsd).toFixed(2)}` : '...'}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Tab Navigation - Only show when in Office view (CELLAR GameView), not Tavern (INN GameView) - Two rows */}
                {viewMode && (viewMode === 'office' || viewMode === 'cellar' || viewMode === 'staking' || viewMode === 'posse' || viewMode === 'regulars') && (
                    <div className="relative z-30 bg-[#2a1d17] border-b-2 border-[#5c4033] p-0.5 shrink-0">
                        <div className="grid grid-cols-3 gap-1">
                            <button
                                onClick={() => onViewSwitch?.('office')}
                                className={`h-7 text-[8px] font-bold uppercase tracking-wider border-2 transition-all ${
                                    viewMode === 'office'
                                        ? 'bg-[#8c7b63] border-[#eaddcf] text-[#2a1d17] shadow-[inset_0_0_0_2px_#5c4033]'
                                        : 'bg-[#3e2b22] border-[#5c4033] text-[#eaddcf] hover:bg-[#4a3b32]'
                                }`}
                            >
                                Office
                            </button>
                            <button
                                onClick={() => onViewSwitch?.('cellar')}
                                className={`h-7 text-[8px] font-bold uppercase tracking-wider border-2 transition-all ${
                                    viewMode === 'cellar'
                                        ? 'bg-[#8c7b63] border-[#eaddcf] text-[#2a1d17] shadow-[inset_0_0_0_2px_#5c4033]'
                                        : 'bg-[#3e2b22] border-[#5c4033] text-[#eaddcf] hover:bg-[#4a3b32]'
                                }`}
                            >
                                Cellar
                            </button>
                            <button
                                onClick={() => onViewSwitch?.('staking')}
                                className={`h-7 text-[8px] font-bold uppercase tracking-wider border-2 transition-all ${
                                    viewMode === 'staking'
                                        ? 'bg-[#8c7b63] border-[#eaddcf] text-[#2a1d17] shadow-[inset_0_0_0_2px_#5c4033]'
                                        : 'bg-[#3e2b22] border-[#5c4033] text-[#eaddcf] hover:bg-[#4a3b32]'
                                }`}
                            >
                                Staking
                            </button>
                            <button
                                onClick={() => onViewSwitch?.('posse')}
                                className={`h-7 text-[8px] font-bold uppercase tracking-wider border-2 transition-all ${
                                    viewMode === 'posse'
                                        ? 'bg-[#8c7b63] border-[#eaddcf] text-[#2a1d17] shadow-[inset_0_0_0_2px_#5c4033]'
                                        : 'bg-[#3e2b22] border-[#5c4033] text-[#eaddcf] hover:bg-[#4a3b32]'
                                }`}
                            >
                                🤠 Posse
                            </button>
                            <button
                                onClick={() => onViewSwitch?.('regulars')}
                                className={`h-7 text-[8px] font-bold uppercase tracking-wider border-2 transition-all col-span-2 ${
                                    viewMode === 'regulars'
                                        ? 'bg-[#8c7b63] border-[#eaddcf] text-[#2a1d17] shadow-[inset_0_0_0_2px_#5c4033]'
                                        : 'bg-[#3e2b22] border-[#5c4033] text-[#eaddcf] hover:bg-[#4a3b32]'
                                }`}
                            >
                                🍻 Regulars
                            </button>
                        </div>
                    </div>
                )}

                {/* Content Overlay - Office content or children */}
                <div className="flex-1 relative z-30 p-2 overflow-y-auto">
                    {viewMode === 'office' ? (
                        children || (
                            <OfficeTabContent
                                buttonText={buttonText}
                                isLoading={isLoading}
                                walletReady={walletReady}
                                isWrongNetwork={isWrongNetwork}
                                isWalletConnected={isWalletConnected}
                                onTakeOffice={onTakeOffice}
                                onShowTakeOfficeModal={() => setShowTakeOfficeModal(true)}
                                keepBalance={keepBalance}
                                monBalance={monBalance}
                                isKing={isKing}
                                totalEarned={state.totalEarned}
                                onClaim={onClaim}
                            />
                        )
                    ) : viewMode === null ? (
                        // When viewMode is null (Tavern page), just show children
                        children
                    ) : null}
                </div>
            </div>

            {/* Bottom Control Panel - Only show in Office Mode - Just stats, no actions */}
            {viewMode === 'office' && (
            <div className="shrink-0 z-20">
                <PixelBox variant="wood" className="!p-0 overflow-hidden shadow-2xl">
                    {/* Player Stats Bar */}
                    <div className="bg-[#3e2b22] p-1 shrink-0">
                        <div className="flex justify-between items-center bg-[#2a1d17] rounded p-0.5 border border-[#5c4033]">
                            <div className="flex flex-col justify-center">
                                <span className="text-[5px] text-[#a8a29e] uppercase leading-none mb-0.5">Your Balance</span>
                                <div className="flex gap-1">
                                    <span className="text-[#eaddcf] font-bold text-[8px] leading-none">KEEP {parseFloat(formatEther(BigInt(keepBalance))).toFixed(2)}</span>
                                    <span className="text-[#eaddcf] font-bold text-[8px] leading-none">MON {parseFloat(formatEther(BigInt(monBalance))).toFixed(4)}</span>
                                </div>
                            </div>
                            <div className="h-5 w-px bg-[#5c4033]"></div>
                            <div className="flex flex-col items-end justify-center">
                                <span className="text-[5px] text-[#a8a29e] uppercase leading-none mb-0.5">
                                    Pending Rewards
                                </span>
                                <div className="flex items-center gap-0.5">
                                    <span className="text-[#eaddcf] font-bold text-[8px] leading-none">
                                        KEEP {isKing ? (state.totalEarned || '0.00') : '0.00'}
                                    </span>
                                    {isKing && onClaim && (
                                        <PixelButton
                                            onClick={() => setShowClaimModal(true)}
                                            disabled={isLoading}
                                            variant="primary"
                                            className="!py-0.5 !px-1 !text-[7px] !h-auto"
                                        >
                                            CLAIM
                                        </PixelButton>
                                    )}
                                </div>
                                {isKing && (
                                    <span className="text-[5px] text-green-400 leading-none mt-0.5">(You)</span>
                                )}
                            </div>
                        </div>
                    </div>
                </PixelBox>
            </div>
            )}

            {/* Take Office Confirmation Modal */}
            {
                showTakeOfficeModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
                        <PixelBox variant="dark" className="max-w-md w-full p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-bold text-orange-400">Confirm Take Office</h3>
                                <button
                                    onClick={() => setShowTakeOfficeModal(false)}
                                    className="text-zinc-400 hover:text-white transition-colors"
                                    disabled={isLoading}
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="bg-[#2a1d17] rounded p-4 border border-[#5c4033]">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-zinc-400 text-sm">Office Price (You'll Pay):</span>
                                        <span className="text-xl font-bold text-orange-400">
                                            {Math.max(1.0, parseFloat(state.currentPrice || '1.0')).toFixed(4)} MON
                                        </span>
                                    </div>
                                    {monPriceUsd > 0 && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-zinc-400 text-xs">USD Value:</span>
                                            <span className="text-green-400 text-sm font-semibold">
                                                ${(Math.max(1.0, parseFloat(state.currentPrice || '1.0')) * monPriceUsd).toFixed(2)}
                                            </span>
                                        </div>
                                    )}
                                    <div className="mt-3 pt-3 border-t border-[#5c4033]">
                                        {state.currentKing && state.currentKing !== '0x0000000000000000000000000000000000000000' && (
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-zinc-400 text-xs">Previous Owner Will Receive (80%):</span>
                                                <span className="text-yellow-400 text-sm font-semibold">
                                                    {(Math.max(1.0, parseFloat(state.currentPrice || '1.0')) * 0.8).toFixed(4)} MON
                                                </span>
                                            </div>
                                        )}
                                        <div className="flex justify-between items-center">
                                            <span className="text-zinc-400 text-xs">Office Rate:</span>
                                            <span className="text-[#fbbf24] text-sm font-semibold">
                                                {state.officeRate && !isNaN(parseFloat(state.officeRate)) ? parseFloat(state.officeRate).toFixed(4) : '0.0000'} KEEP/s
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {isKing && (
                                    <div className="bg-red-900/30 border border-red-800/50 rounded p-3">
                                        <p className="text-xs text-red-200 font-bold mb-1">
                                            ⚠️ WARNING: You Already Own The Office!
                                        </p>
                                        <p className="text-xs text-red-300">
                                            Taking the office from yourself does nothing - you'll just pay yourself back (minus 20% in fees). You won't make any profit from this.
                                        </p>
                                    </div>
                                )}
                                <div className="bg-amber-50/10 border border-amber-800/50 rounded p-3">
                                    <p className="text-xs text-amber-200 mb-2">
                                        <strong>Important:</strong> The "Previous Owner PNL" shown above is what the PREVIOUS owner would receive if you take the office, NOT what you'll earn. You earn KEEP tokens over time while holding the office.
                                    </p>
                                    <p className="text-xs text-amber-200">
                                        <strong>Note:</strong> You will also pay gas fees for this transaction. The wallet popup will show the gas cost.
                                    </p>
                                </div>

                                <div className="flex gap-2 mt-4">
                                    <PixelButton
                                        onClick={() => setShowTakeOfficeModal(false)}
                                        variant="neutral"
                                        className="flex-1"
                                        disabled={isLoading}
                                    >
                                        Cancel
                                    </PixelButton>
                                    <PixelButton
                                        onClick={async () => {
                                            setShowTakeOfficeModal(false);
                                            await onTakeOffice();
                                        }}
                                        variant="danger"
                                        className="flex-1"
                                        disabled={isLoading}
                                    >
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin mr-2 inline" />
                                                Processing...
                                            </>
                                        ) : (
                                            "Confirm Take Office 👑"
                                        )}
                                    </PixelButton>
                                </div>
                            </div>
                        </PixelBox>
                    </div>
                )
            }

            {/* Claim Rewards Confirmation Modal */}
            {
                showClaimModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
                        <PixelBox variant="dark" className="max-w-md w-full p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-bold text-green-400">Confirm Claim Rewards</h3>
                                <button
                                    onClick={() => setShowClaimModal(false)}
                                    className="text-zinc-400 hover:text-white transition-colors"
                                    disabled={isLoading}
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="bg-[#2a1d17] rounded p-4 border border-[#5c4033]">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-zinc-400 text-sm">KEEP Rewards (You'll Receive):</span>
                                        <span className="text-xl font-bold text-green-400">
                                            {state.totalEarned || '0.00'} KEEP
                                        </span>
                                    </div>
                                    {state.totalEarnedUsd && (
                                        <div className="flex justify-between items-center mt-2">
                                            <span className="text-zinc-400 text-xs">USD Value:</span>
                                            <span className="text-green-400 text-sm font-semibold">
                                                {state.totalEarnedUsd}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="bg-amber-50/10 border border-amber-800/50 rounded p-3">
                                    <p className="text-xs text-amber-200">
                                        <strong>Note:</strong> You will pay gas fees for this transaction. The wallet popup will show the gas cost.
                                    </p>
                                </div>

                                <div className="flex gap-2 mt-4">
                                    <PixelButton
                                        onClick={() => setShowClaimModal(false)}
                                        variant="neutral"
                                        className="flex-1"
                                        disabled={isLoading}
                                    >
                                        Cancel
                                    </PixelButton>
                                    <PixelButton
                                        onClick={async () => {
                                            setShowClaimModal(false);
                                            if (onClaim) {
                                                await onClaim();
                                            }
                                        }}
                                        variant="success"
                                        className="flex-1"
                                        disabled={isLoading}
                                    >
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin mr-2 inline" />
                                                Claiming...
                                            </>
                                        ) : (
                                            "Confirm Claim"
                                        )}
                                    </PixelButton>
                                </div>
                            </div>
                        </PixelBox>
                    </div>
                )
            }
        </div >
    );
};
