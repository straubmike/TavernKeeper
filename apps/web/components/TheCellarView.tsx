"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import { Flame, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { createPublicClient, createWalletClient, custom, formatEther, http, parseEther } from "viem";
import { monad } from "../lib/chains";
import { CONTRACT_REGISTRY, getContractAddress } from "../lib/contracts/registry";
import { CellarState, theCellarService } from "../lib/services/theCellarService";
import { PixelBox, PixelButton } from "./PixelComponents";

interface TheCellarViewProps {
    onBackToOffice?: () => void;
    monBalance?: string;
    keepBalance?: string;
}

// TEMPORARILY DISABLED - Cellar functionality disabled due to liquidity calculation overflow issue
const CELLAR_DISABLED = false;

export default function TheCellarView({ onBackToOffice, monBalance = "0", keepBalance = "0" }: TheCellarViewProps = {}) {
    const { authenticated, user } = usePrivy();
    const { wallets } = useWallets();
    const [state, setState] = useState<CellarState | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isClaiming, setIsClaiming] = useState(false);
    const [lpBalance, setLpBalance] = useState<bigint>(0n);
    const [isMinting, setIsMinting] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showMintModal, setShowMintModal] = useState(false);

    const wallet = wallets.find((w) => w.address === user?.wallet?.address);
    const address = user?.wallet?.address;
    const isConnected = authenticated && !!wallet;

    const fetchData = async () => {
        try {
            const data = await theCellarService.getCellarState();
            setState(data);

            if (address) {
                const balance = await theCellarService.getUserLpBalance(address);
                setLpBalance(balance);
            }
        } catch (error) {
            console.error("Failed to fetch cellar state", error);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, [address]);

    const handleClaimClick = () => {
        setShowConfirmModal(true);
    };

    const handleClaim = async () => {
        if (!address || !isConnected || !wallet) return;

        setShowConfirmModal(false);
        setIsClaiming(true);
        try {
            const provider = await wallet.getEthereumProvider();
            const client = createWalletClient({
                account: address as `0x${string}`,
                chain: monad,
                transport: custom(provider)
            });

            await theCellarService.claim(client, address);
            alert("Raid successful! You claimed the pot.");
        } catch (error) {
            console.error("Claim failed:", error);
            alert("Raid failed. See console for details.");
        } finally {
            setIsClaiming(false);
            fetchData();
        }
    };

    const handleMintLPClick = () => {
        const input = document.getElementById('mintAmount') as HTMLInputElement;
        const amount = input.value || "1";
        if (!amount || parseFloat(amount) <= 0) {
            alert("Please enter a valid amount");
            return;
        }
        setShowMintModal(true);
    };

    const handleMintLP = async () => {
        if (!wallet || !address || !isConnected) {
            alert("Please connect your wallet first.");
            return;
        }
        const input = document.getElementById('mintAmount') as HTMLInputElement;
        const amount = input.value || "1";

        setShowMintModal(false);
        setIsMinting(true);
        try {
            const provider = await wallet.getEthereumProvider();
            const client = createWalletClient({
                account: address as `0x${string}`,
                chain: monad,
                transport: custom(provider)
            });

            const amountMON = parseEther(amount);
            const amountKEEP = parseEther((parseFloat(amount) * 3).toString()); // 1:3 Ratio

            const zapConfig = CONTRACT_REGISTRY.CELLAR_ZAP;
            const zapAddress = getContractAddress(zapConfig);
            if (!zapAddress) throw new Error("Zap contract not found");

            // Check KEEP allowance
            const allowance = await theCellarService.getKeepAllowance(address, zapAddress);
            if (allowance < amountKEEP) {
                console.log("Approving KEEP...");
                const approveHash = await theCellarService.approveKeep(client, zapAddress, amountKEEP);
                const publicClient = createPublicClient({ chain: monad, transport: http() });
                await publicClient.waitForTransactionReceipt({ hash: approveHash });
                console.log("KEEP Approved");
            }

            console.log("Minting LP...");
            const mintHash = await client.writeContract({
                address: zapAddress,
                abi: zapConfig.abi,
                functionName: 'mintLP',
                args: [amountMON, amountKEEP],
                value: amountMON,
                chain: monad,
                account: address as `0x${string}`
            });

            // Wait for transaction to be confirmed before refreshing balance
            const publicClient = createPublicClient({ chain: monad, transport: http() });
            await publicClient.waitForTransactionReceipt({ hash: mintHash });
            console.log("Transaction confirmed!");

            // Clear cache to ensure fresh data
            theCellarService.clearCache();

            alert("LP Minted Successfully!");
            fetchData(); // Refresh balance
        } catch (e) {
            console.error(e);
            alert("Mint failed. See console for details.");
        } finally {
            setIsMinting(false);
        }
    };

    if (!state) {
        return (
            <div className="flex items-center justify-center h-full text-white">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
        );
    }

    const isPotEmpty = parseFloat(state.potSize) === 0;
    const currentPriceWei = state ? parseEther(state.currentPrice) : 0n;
    const hasEnoughLP = lpBalance >= currentPriceWei;

    // Show disabled message if cellar is disabled
    if (CELLAR_DISABLED) {
        return (
            <div className="flex flex-col gap-4 p-4 text-white font-pixel h-full justify-center items-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                    <Flame className="w-6 h-6 text-orange-500 animate-pulse" />
                    <h2 className="text-xl font-bold text-orange-400">THE CELLAR</h2>
                </div>
                <PixelBox variant="dark" className="p-6 max-w-md text-center">
                    <div className="text-red-400 font-bold text-lg mb-2">⚠️ TEMPORARILY DISABLED</div>
                    <div className="text-sm text-zinc-400 mb-4">
                        The Cellar is currently disabled due to a liquidity calculation issue.
                    </div>
                    <div className="text-xs text-zinc-500">
                        We're working on fixing an arithmetic overflow error in the liquidity addition function.
                        The Cellar will be re-enabled once the fix is deployed.
                    </div>
                    {onBackToOffice && (
                        <PixelButton
                            onClick={onBackToOffice}
                            variant="neutral"
                            className="mt-4 w-full"
                        >
                            Back to Office
                        </PixelButton>
                    )}
                </PixelBox>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 p-4 text-white font-pixel h-full justify-center">
            <div className="flex items-center justify-center gap-2 mb-2">
                <Flame className="w-6 h-6 text-orange-500 animate-pulse" />
                <h2 className="text-xl font-bold text-orange-400">THE CELLAR</h2>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <PixelBox variant="dark" className="p-4 flex flex-col items-center justify-center">
                    <div className="text-[10px] text-zinc-400 uppercase tracking-wider mb-1">Pot Size</div>
                    <div className="text-xl font-bold text-yellow-400">
                        {parseFloat(state.potSize).toFixed(6)} MON
                    </div>
                </PixelBox>

                <PixelBox variant="dark" className="p-4 flex flex-col items-center justify-center">
                    <div className="text-[10px] text-zinc-400 uppercase tracking-wider mb-1">Cellar Price</div>
                    <div className="text-xl font-bold text-orange-400">
                        {parseFloat(state.currentPrice).toFixed(2)} LP
                    </div>
                </PixelBox>
            </div>

            <div className="mt-4 pb-20"> {/* Added padding-bottom for sticky footer */}
                <PixelButton
                    onClick={handleClaimClick}
                    disabled={!isConnected || isClaiming || isPotEmpty || !hasEnoughLP}
                    variant="danger"
                    className={`w-full h-12 text-lg font-bold uppercase tracking-widest transition-all flex items-center justify-center ${(!isConnected || isClaiming || isPotEmpty || !hasEnoughLP) ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                    {isClaiming ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                    ) : isPotEmpty ? (
                        "POT EMPTY"
                    ) : !hasEnoughLP ? (
                        "INSUFFICIENT LP"
                    ) : (
                        "RAID CELLAR 🔥"
                    )}
                </PixelButton>

                <div className="bg-[#2a1d17] rounded p-2 border border-[#5c4033] grid grid-cols-3 gap-2 mt-2">
                    <div className="flex flex-col items-center justify-center border-r border-[#5c4033] last:border-0">
                        <span className="text-[8px] text-[#a8a29e] uppercase mb-0.5 tracking-wider">LP Balance</span>
                        <span className="text-[#f87171] font-bold text-xs font-mono">
                            {parseFloat(formatEther(lpBalance)).toFixed(2)}
                        </span>
                    </div>
                    <div className="flex flex-col items-center justify-center border-r border-[#5c4033] last:border-0">
                        <span className="text-[8px] text-[#a8a29e] uppercase mb-0.5 tracking-wider">MON Balance</span>
                        <span className="text-[#fbbf24] font-bold text-xs font-mono">
                            {monBalance ? parseFloat(formatEther(BigInt(monBalance))).toFixed(4) : '0.00'}
                        </span>
                    </div>
                    <div className="flex flex-col items-center justify-center">
                        <span className="text-[8px] text-[#a8a29e] uppercase mb-0.5 tracking-wider">KEEP Balance</span>
                        <span className="text-[#eaddcf] font-bold text-xs font-mono">
                            {keepBalance ? parseFloat(formatEther(BigInt(keepBalance))).toFixed(2) : '0.00'}
                        </span>
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t border-white/10">
                    <div className="text-xs text-zinc-400 mb-2 text-center uppercase tracking-wider">Need LP Tokens?</div>

                    <div className="flex gap-2 mb-2">
                        <input
                            type="number"
                            placeholder="Amount MON"
                            className="w-full bg-black/50 border border-white/10 p-2 text-sm text-white font-pixel"
                            id="mintAmount"
                            defaultValue="1"
                        />
                    </div>

                    <PixelButton
                        onClick={handleMintLPClick}
                        disabled={isMinting}
                        variant="primary"
                        className="w-full h-10 text-sm font-bold uppercase tracking-widest flex items-center justify-center"
                    >
                        {isMinting ? <Loader2 className="w-4 h-4 animate-spin" /> : "MINT LP (1:3 Ratio)"}
                    </PixelButton>
                </div>
            </div>

            {/* Sticky Bottom Navigation */}
            {onBackToOffice && (
                <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-black via-black to-transparent z-20">
                    <PixelButton
                        onClick={onBackToOffice}
                        variant="wood"
                        className="w-full h-12 text-sm font-bold uppercase tracking-widest shadow-lg"
                    >
                        ← BACK TO OFFICE
                    </PixelButton>
                </div>
            )}

            {/* Confirmation Modal */}
            {showConfirmModal && state && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
                    <PixelBox variant="dark" className="max-w-md w-full p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-orange-400">Confirm Raid</h3>
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                className="text-zinc-400 hover:text-white transition-colors"
                                disabled={isClaiming}
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-[#2a1d17] rounded p-4 border border-[#5c4033]">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-zinc-400 text-sm">Pot Size (You'll Receive):</span>
                                    <span className="text-xl font-bold text-yellow-400">
                                        {parseFloat(state.potSize).toFixed(6)} MON
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-zinc-400 text-sm">LP Tokens (You'll Spend):</span>
                                    <span className="text-xl font-bold text-orange-400">
                                        {parseFloat(state.currentPrice).toFixed(2)} LP
                                    </span>
                                </div>
                            </div>

                            <div className="bg-amber-50/10 border border-amber-800/50 rounded p-3">
                                <p className="text-xs text-amber-200">
                                    <strong>Note:</strong> You will also pay gas fees for this transaction. The wallet popup will show the gas cost.
                                </p>
                            </div>

                            <div className="flex gap-2 mt-4">
                                <PixelButton
                                    onClick={() => setShowConfirmModal(false)}
                                    variant="neutral"
                                    className="flex-1"
                                    disabled={isClaiming}
                                >
                                    Cancel
                                </PixelButton>
                                <PixelButton
                                    onClick={handleClaim}
                                    variant="danger"
                                    className="flex-1"
                                    disabled={isClaiming}
                                >
                                    {isClaiming ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin mr-2 inline" />
                                            Raiding...
                                        </>
                                    ) : (
                                        "Confirm Raid 🔥"
                                    )}
                                </PixelButton>
                            </div>
                        </div>
                    </PixelBox>
                </div>
            )}

            {/* Mint LP Confirmation Modal */}
            {showMintModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 overflow-y-auto">
                    <PixelBox variant="dark" className="max-w-md w-full p-6 my-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-orange-400">Confirm Mint LP</h3>
                            <button
                                onClick={() => setShowMintModal(false)}
                                className="text-zinc-400 hover:text-white transition-colors"
                                disabled={isMinting}
                            >
                                ✕
                            </button>
                        </div>

                        {(() => {
                            const input = document.getElementById('mintAmount') as HTMLInputElement;
                            const amount = input?.value || "1";
                            const amountMON = parseFloat(amount);
                            const amountKEEP = amountMON * 3;
                            const needsApproval = true; // We'll check this, but show the modal anyway

                            return (
                                <div className="space-y-4">
                                    <div className="bg-[#2a1d17] rounded p-4 border border-[#5c4033]">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-zinc-400 text-sm">MON (You'll Pay):</span>
                                            <span className="text-xl font-bold text-orange-400">
                                                {amountMON.toFixed(4)} MON
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-zinc-400 text-sm">KEEP (You'll Pay):</span>
                                            <span className="text-xl font-bold text-orange-400">
                                                {amountKEEP.toFixed(2)} KEEP
                                            </span>
                                        </div>
                                        <div className="mt-3 pt-3 border-t border-[#5c4033]">
                                            <div className="flex justify-between items-center">
                                                <span className="text-zinc-400 text-xs">LP Tokens (You'll Receive):</span>
                                                <span className="text-yellow-400 text-sm font-semibold">
                                                    ~{amountMON.toFixed(4)} LP
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {needsApproval && (
                                        <div className="bg-blue-50/10 border border-blue-800/50 rounded p-3">
                                            <p className="text-xs text-blue-200">
                                                <strong>Note:</strong> If this is your first time, you'll need to approve KEEP spending. This requires a separate transaction.
                                            </p>
                                        </div>
                                    )}

                                    <div className="bg-amber-50/10 border border-amber-800/50 rounded p-3">
                                        <p className="text-xs text-amber-200">
                                            <strong>Note:</strong> You will pay gas fees for this transaction (and approval if needed). The wallet popup will show the gas cost.
                                        </p>
                                    </div>

                                    {!isConnected && (
                                        <div className="bg-red-50/10 border border-red-800/50 rounded p-3">
                                            <p className="text-xs text-red-200">
                                                <strong>Warning:</strong> Wallet not connected. Please connect your wallet to proceed.
                                            </p>
                                        </div>
                                    )}

                                    <div className="flex gap-2 mt-4">
                                        <PixelButton
                                            onClick={() => setShowMintModal(false)}
                                            variant="neutral"
                                            className="flex-1"
                                            disabled={isMinting}
                                        >
                                            Cancel
                                        </PixelButton>
                                        <PixelButton
                                            onClick={handleMintLP}
                                            variant="primary"
                                            className="flex-1"
                                            disabled={isMinting || !isConnected}
                                        >
                                            {isMinting ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin mr-2 inline" />
                                                    Minting...
                                                </>
                                            ) : !isConnected ? (
                                                "Connect Wallet"
                                            ) : (
                                                "Confirm Mint LP"
                                            )}
                                        </PixelButton>
                                    </div>
                                </div>
                            );
                        })()}
                    </PixelBox>
                </div>
            )}
        </div >
    );
}
