'use client';

import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { formatEther } from 'viem';
import { getMonPrice } from '../lib/services/monPriceService';
import { getOfficeManagerData } from '../lib/services/officeManagerCache';
import { OfficeState } from '../lib/services/tavernKeeperService';
import { CellarState, theCellarService } from '../lib/services/theCellarService';
import { PixelBox, PixelButton } from './PixelComponents';
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
    isKing?: boolean;
    // New props
    cellarState?: any;
    viewMode?: 'office' | 'cellar';
    monBalance?: string;
    onClaim?: () => void;
    onViewSwitch?: (mode: 'office' | 'cellar') => void;
    refreshKey?: number; // Key to trigger refresh when changed
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
    isKing = false,
    cellarState: propCellarState,
    viewMode = 'office',
    monBalance = '0',
    onClaim,
    onViewSwitch,
    refreshKey,
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

    // Get cached office manager data
    const officeManagerData = React.useMemo(() => {
        if (!state.currentKing || state.currentKing === '0x0000000000000000000000000000000000000000') {
            return null;
        }
        return getOfficeManagerData(state.currentKing);
    }, [state.currentKing]);


    React.useEffect(() => {
        setMounted(true);

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

    // Refresh cellar when refreshKey changes
    React.useEffect(() => {
        if (refreshKey !== undefined && refreshKey > 0) {
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
    }, [refreshKey]);

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
    // Cost = Price (LP) (since 1 LP = 1 MON when 1:3 MON:KEEP ratio is enforced)
    // PnL = Pot (MON) - Cost (MON)
    let cellarPnL = "$0.00";
    let isCellarProfitable = false;

    if (cellarState) {
        const pot = parseFloat(cellarState.potSize || '0');
        const priceLP = parseFloat(cellarState.currentPrice || '0');
        const costMON = priceLP; // 1 LP = 1 MON (when 1:3 ratio is enforced)
        const profit = pot - costMON;

        isCellarProfitable = profit > 0;
        cellarPnL = (profit >= 0 ? "+" : "") + profit.toFixed(4) + " MON";
    }

    if (viewMode === 'cellar') {
        return (
            <TheCellarView
                onBackToOffice={() => onViewSwitch?.('office')}
                monBalance={monBalance}
                keepBalance={keepBalance}
            />
        );
    }

    return (
        <div className="w-full h-full flex flex-col font-pixel relative">
            {/* Visual Area (Chat or Cellar) */}
            <div className="flex-1 relative bg-[#1a120b] overflow-hidden flex flex-col gap-4">
                {/* Background Image - Absolute to fill container */}
                <div
                    className="absolute inset-0 bg-cover bg-center opacity-40 pointer-events-none"
                    style={{ backgroundImage: "url('/sprites/office_bg.png')" }}
                />

                {/* Top Header - Protocol Info (Office & Cellar) - Relative to push content down */}
                <div className="relative bg-[#3e2b22] border-b-4 border-[#2a1d17] p-1 z-40 shadow-md flex flex-col gap-1 shrink-0">

                    {/* Error Banner */}
                    {state.error && (
                        <div className="bg-red-500 text-white text-[10px] font-bold p-1 text-center animate-pulse border-2 border-red-700">
                            ⚠️ {state.error} ⚠️
                        </div>
                    )}

                    {/* Row 1: Office Manager Info */}
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                            <div className="w-6 h-6 bg-[#5c4033] rounded border-2 border-[#8c7b63] overflow-hidden relative shrink-0">
                                <div className="absolute inset-0 bg-[#8c7b63] flex items-center justify-center text-xs text-[#2a1d17]">
                                    👑
                                </div>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[7px] text-[#a8a29e] uppercase tracking-wider leading-none">Office Manager</span>
                                {officeManagerData && (officeManagerData.username || officeManagerData.fid) ? (
                                    <div className="flex flex-col">
                                        <span className="text-[#eaddcf] font-bold text-[10px] leading-none">
                                            {officeManagerData.username ? `@${officeManagerData.username}` : `FID: ${officeManagerData.fid}`}
                                        </span>
                                        <button
                                            onClick={() => {
                                                if (state.currentKing && state.currentKing !== '0x0000000000000000000000000000000000000000') {
                                                    navigator.clipboard.writeText(state.currentKing);
                                                }
                                            }}
                                            className="text-[#a8a29e] font-mono text-[8px] leading-none text-left hover:text-yellow-400 transition-colors cursor-pointer"
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
                                        className="text-[#eaddcf] font-bold text-[10px] font-mono leading-none text-left hover:text-yellow-400 transition-colors cursor-pointer whitespace-nowrap"
                                        title={state.currentKing && state.currentKing !== '0x0000000000000000000000000000000000000000' ? `Click to copy: ${state.currentKing}` : 'Vacant'}
                                    >
                                        {state.currentKing && state.currentKing !== '0x0000000000000000000000000000000000000000' ? formatAddress(state.currentKing) : 'Vacant'}
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="flex flex-col items-end">
                                <span className="text-[7px] text-[#a8a29e] uppercase tracking-wider leading-none">Time Held</span>
                                <span className="text-[#eaddcf] font-bold text-[10px] font-mono leading-none">{timeHeld}</span>
                            </div>
                            {state.currentKing && state.currentKing !== '0x0000000000000000000000000000000000000000' && (
                                <div className="flex flex-col items-end">
                                    <span className="text-[7px] text-[#a8a29e] uppercase tracking-wider leading-none">Manager Earnings</span>
                                    <span className="text-[#eaddcf] font-bold text-[10px] font-mono leading-none">KEEP {state.totalEarned || '0.00'}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Minimize Toggle */}
                    <button
                        onClick={() => setIsHeaderMinimized(!isHeaderMinimized)}
                        className="absolute top-1 right-1 text-[#a8a29e] hover:text-[#eaddcf] transition-colors p-0.5"
                    >
                        {isHeaderMinimized ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                    </button>

                    {/* Row 2: Stats Grid (Office & Cellar) - Hidden when minimized */}
                    {!isHeaderMinimized && (
                        <div className="grid grid-cols-3 gap-1">
                            {/* Office Stats */}
                            <div className="bg-[#2a1d17] border border-[#5c4033] rounded p-1 flex flex-col items-center justify-center">
                                <div className="text-[6px] text-[#a8a29e] uppercase tracking-widest mb-0.5">Office Rate</div>
                                <div className="text-[#fbbf24] font-bold text-[10px]">
                                    {state.officeRate && !isNaN(parseFloat(state.officeRate)) ? parseFloat(state.officeRate).toFixed(4) : '0.0000'}
                                    <span className="text-[6px] text-[#78716c]">/s</span>
                                </div>
                            </div>
                            <div className="bg-[#2a1d17] border border-[#5c4033] rounded p-1 flex flex-col items-center justify-center">
                                <div className="text-[6px] text-[#fca5a5] uppercase tracking-widest mb-0.5">Office Price</div>
                                <div className="text-[#f87171] font-bold text-[10px]">
                                    <span className="text-purple-400">{Math.max(1.0, parseFloat(state.currentPrice || '1.0')).toFixed(4)} MON</span>
                                    {monPriceUsd > 0 && (
                                        <>
                                            <span className="text-[#78716c]"> (~</span>
                                            <span className="text-green-400">${(Math.max(1.0, parseFloat(state.currentPrice || '1.0')) * monPriceUsd).toFixed(2)}</span>
                                            <span className="text-[#78716c]">)</span>
                                        </>
                                    )}
                                </div>
                                {monPriceUsd > 0 && parseFloat(state.currentPrice || '1.0') >= 1.0 && (
                                    <div className="text-[4px] text-[#78716c] mt-0.5 text-center leading-tight">
                                        1 MON = {monPrice}
                                    </div>
                                )}
                            </div>
                            <div className="bg-[#2a1d17] border border-[#5c4033] rounded p-1 flex flex-col items-center justify-center">
                                <div className="text-[6px] text-[#86efac] uppercase tracking-widest mb-0.5">Office PNL</div>
                                <div className={`font-bold text-[10px] ${pnl && pnl.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>{pnl || '$0.00'}</div>
                            </div>

                            {/* Cellar Stats */}
                            <div className="bg-[#2a1d17] border border-[#5c4033] rounded p-1 flex flex-col items-center justify-center">
                                <div className="text-[6px] text-[#a8a29e] uppercase tracking-widest mb-0.5">Cellar Pot</div>
                                <div className="text-[#fbbf24] font-bold text-[10px]">{cellarState ? parseFloat(cellarState.potSize).toFixed(6) : '0.00'} <span className="text-[6px] text-[#78716c]">MON</span></div>
                            </div>
                            <div className="bg-[#2a1d17] border border-[#5c4033] rounded p-1 flex flex-col items-center justify-center">
                                <div className="text-[6px] text-[#fca5a5] uppercase tracking-widest mb-0.5">Cellar Price</div>
                                <div className="text-[#f87171] font-bold text-[10px]">{cellarState ? parseFloat(cellarState.currentPrice).toFixed(2) : '0.00'} <span className="text-[6px] text-[#78716c]">LP</span></div>
                            </div>
                            <div className="bg-[#2a1d17] border border-[#5c4033] rounded p-1 flex flex-col items-center justify-center">
                                <div className="text-[6px] text-[#86efac] uppercase tracking-widest mb-0.5">Cellar PNL</div>
                                <div className={`font-bold text-[10px] ${isCellarProfitable ? 'text-green-400' : 'text-red-400'}`}>{cellarPnL}</div>
                            </div>

                            {/* Previous Owner Payout - Only show if there's a current king */}
                            {state.currentKing && state.currentKing !== '0x0000000000000000000000000000000000000000' && (
                                <div className="bg-[#2a1d17] border border-[#5c4033] rounded p-1 flex flex-col items-center justify-center col-span-3">
                                    <div className="text-[6px] text-[#a8a29e] uppercase tracking-widest mb-0.5">To Previous Owner</div>
                                    <div className="text-[#fbbf24] font-bold text-[10px]">
                                        {(Math.max(1.0, parseFloat(state.currentPrice || '1.0')) * 0.8).toFixed(4)} <span className="text-[6px] text-[#78716c]">MON</span>
                                        {monPriceUsd > 0 && (
                                            <>
                                                <span className="text-[#78716c]"> (~</span>
                                                <span className="text-green-400">${(Math.max(1.0, parseFloat(state.currentPrice || '1.0')) * 0.8 * monPriceUsd).toFixed(2)}</span>
                                                <span className="text-[#78716c]">)</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Content Overlay - Chat positioned below header */}
                <div className="flex-1 relative z-30 p-4 overflow-y-auto">
                    {children}
                </div>
            </div>

            {/* Bottom Control Panel - Only show in Office Mode */}
            <div className="shrink-0 z-20">
                <PixelBox variant="wood" className="!p-0 overflow-hidden shadow-2xl">

                    {/* Player Stats & Action Area */}
                    <div className="bg-[#3e2b22] p-1.5 shrink-0 flex flex-col gap-1.5">

                        {/* Player Stats Bar */}
                        <div className="flex justify-between items-center bg-[#2a1d17] rounded p-1 border border-[#5c4033]">
                            <div className="flex flex-col justify-center">
                                <span className="text-[6px] text-[#a8a29e] uppercase leading-none mb-0.5">Your Balance</span>
                                <div className="flex gap-2">
                                    <span className="text-[#eaddcf] font-bold text-[10px] leading-none">KEEP {parseFloat(formatEther(BigInt(keepBalance))).toFixed(2)}</span>
                                    <span className="text-[#eaddcf] font-bold text-[10px] leading-none">MON {parseFloat(formatEther(BigInt(monBalance))).toFixed(4)}</span>
                                </div>
                            </div>
                            <div className="h-6 w-px bg-[#5c4033]"></div>
                            <div className="flex flex-col items-end justify-center">
                                <span className="text-[6px] text-[#a8a29e] uppercase leading-none mb-0.5">
                                    Pending Rewards
                                </span>
                                <div className="flex items-center gap-1">
                                    <span className="text-[#eaddcf] font-bold text-[10px] leading-none">
                                        KEEP {isKing ? (state.totalEarned || '0.00') : '0.00'}
                                    </span>
                                    {isKing && onClaim && (
                                        <PixelButton
                                            onClick={() => setShowClaimModal(true)}
                                            disabled={isLoading}
                                            variant="primary"
                                            className="!py-0.5 !px-1.5 !text-[8px] !h-auto"
                                        >
                                            CLAIM
                                        </PixelButton>
                                    )}
                                </div>
                                {isKing && (
                                    <span className="text-[6px] text-green-400 leading-none mt-0.5">(You)</span>
                                )}
                            </div>
                        </div>

                        {/* Action Buttons - Split Take Office / Raid Cellar */}
                        {isWalletConnected ? (
                            <div className="flex gap-2">
                                <PixelButton
                                    onClick={() => setShowTakeOfficeModal(true)}
                                    disabled={isLoading || !walletReady}
                                    variant="danger"
                                    className="flex-1 !py-2 !text-xs shadow-lg flex items-center justify-center"
                                >
                                    {buttonText}
                                </PixelButton>
                                <PixelButton
                                    onClick={() => onViewSwitch?.('cellar')}
                                    variant="neutral"
                                    className="flex-1 !py-2 !text-xs shadow-lg flex items-center justify-center"
                                >
                                    RAID CELLAR
                                </PixelButton>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                <div className="text-center py-1">
                                    <span className="text-[10px] text-[#a8a29e] italic">Connect wallet to play</span>
                                </div>
                            </div>
                        )}
                    </div>
                </PixelBox>
            </div>

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

                                <div className="bg-amber-50/10 border border-amber-800/50 rounded p-3">
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
