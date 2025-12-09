"use client";

import sdk from '@farcaster/miniapp-sdk';
import { Flame, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { formatEther, parseAbi, parseEther, type Address } from "viem";
import { useAccount, usePublicClient, useWalletClient, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { monad } from "../lib/chains";
import { CONTRACT_ADDRESSES } from "../lib/contracts/addresses";
import { CONTRACT_REGISTRY, getContractAddress } from "../lib/contracts/registry";
import { CellarState, theCellarService } from "../lib/services/theCellarService";
import { checkIsInFarcasterMiniapp } from "../lib/utils/farcasterDetection";
import { useSmartNavigate } from "../lib/utils/smartNavigation";
import { PixelBox, PixelButton } from "./PixelComponents";

interface TheCellarViewProps {
    onBackToOffice?: () => void;
    monBalance?: string;
    keepBalance?: string;
}

// TEMPORARILY DISABLED - Cellar functionality disabled due to liquidity calculation overflow issue
const CELLAR_DISABLED = false;

type MiniAppContext = {
    user?: {
        fid: number;
        username?: string;
        displayName?: string;
        pfpUrl?: string;
    };
};

export default function TheCellarView({ onBackToOffice, monBalance = "0", keepBalance = "0" }: TheCellarViewProps = {}) {
    const { address, isConnected } = useAccount();
    const { data: walletClient } = useWalletClient();
    const publicClient = usePublicClient();
    const { writeContractAsync, data: raidTxHash, isPending: isWritingRaid, reset: resetRaidWrite } = useWriteContract();

    const { data: raidReceipt, isLoading: isConfirmingRaid } = useWaitForTransactionReceipt({
        hash: raidTxHash,
        chainId: monad.id,
    });

    const { navigate } = useSmartNavigate();
    const [state, setState] = useState<CellarState | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isClaiming, setIsClaiming] = useState(false);
    const [lpBalance, setLpBalance] = useState<bigint>(0n);
    const [isMinting, setIsMinting] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showMintModal, setShowMintModal] = useState(false);
    const [showRecoverModal, setShowRecoverModal] = useState(false);
    const [isRecovering, setIsRecovering] = useState(false);
    const [keepPerMonRatio, setKeepPerMonRatio] = useState<number | null>(null);
    const [poolStats, setPoolStats] = useState<{
        totalCLPSupply: bigint;
        positionLiquidity: bigint;
        totalLiquidity: bigint;
    } | null>(null);
    const [raidData, setRaidData] = useState<{
        monProfit: bigint;
        keepProfit: bigint;
        monProfitFormatted: string;
        keepProfitFormatted: string;
    } | null>(null);
    const [context, setContext] = useState<MiniAppContext | null>(null);

    // Get user context from SDK
    useEffect(() => {
        let cancelled = false;
        const hydrateContext = async () => {
            try {
                const ctx = (await (sdk as unknown as {
                    context: Promise<MiniAppContext> | MiniAppContext;
                }).context) as MiniAppContext;
                if (!cancelled) {
                    setContext(ctx);
                }
            } catch {
                if (!cancelled) setContext(null);
            }
        };
        hydrateContext();
        return () => {
            cancelled = true;
        };
    }, []);

    // Handle raid transaction receipt (same pattern as office notification)
    useEffect(() => {
        if (!raidReceipt) return;
        if (raidReceipt.status === 'success' || raidReceipt.status === 'reverted') {
            setIsClaiming(false);
            theCellarService.clearCache();

            if (raidReceipt.status === 'success' && address && publicClient) {
                // Parse Raid event to get profit amounts
                const contractConfig = CONTRACT_REGISTRY.THECELLAR;
                const cellarAddress = getContractAddress(contractConfig);
                if (cellarAddress) {
                    const raidEventAbi = parseAbi([
                        'event Raid(address indexed user, uint256 lpBurned, uint256 monPayout, uint256 keepPayout, uint256 newInitPrice, uint256 epochId)'
                    ]);

                    try {
                        const logs = raidReceipt.logs.filter(log =>
                            log.address.toLowerCase() === cellarAddress.toLowerCase()
                        );

                        let monProfit = 0n;
                        let keepProfit = 0n;

                        for (const log of logs) {
                            try {
                                const decoded = publicClient.decodeEventLog({
                                    abi: raidEventAbi,
                                    data: log.data,
                                    topics: log.topics,
                                });

                                if (decoded.eventName === 'Raid') {
                                    monProfit = decoded.args.monPayout as bigint;
                                    keepProfit = decoded.args.keepPayout as bigint;
                                    break;
                                }
                            } catch (e) {
                                // Not a Raid event, continue
                            }
                        }

                        const monProfitFormatted = formatEther(monProfit);
                        const keepProfitFormatted = formatEther(keepProfit);
                        alert(`Raid successful! You claimed ${monProfitFormatted} MON and ${keepProfitFormatted} KEEP.`);

                        // Store raid data for notification
                        if (monProfit > 0n || keepProfit > 0n) {
                            setRaidData({
                                monProfit,
                                keepProfit,
                                monProfitFormatted,
                                keepProfitFormatted
                            });
                        }

                        // Trigger compose cast if in miniapp (optional user action)
                        (async () => {
                            try {
                                const doubleCheckMiniapp = await checkIsInFarcasterMiniapp();
                                if (doubleCheckMiniapp) {
                                    setTimeout(async () => {
                                        try {
                                            const username = context?.user?.username;
                                            const monFormatted = parseFloat(monProfitFormatted).toFixed(2);
                                            const keepFormatted = parseFloat(keepProfitFormatted).toFixed(2);

                                            let shareText: string;
                                            if (username) {
                                                shareText = `@${username} just raided The Cellar and claimed ${monFormatted} MON + ${keepFormatted} KEEP! 🔥 Raid it yourself at tavernkeeper.xyz/miniapp`;
                                            } else {
                                                shareText = `I just raided The Cellar and claimed ${monFormatted} MON + ${keepFormatted} KEEP! 🔥 Raid it yourself at tavernkeeper.xyz/miniapp`;
                                            }

                                            console.log('📝 Prompting user to compose cast for raid...', {
                                                username,
                                                monProfit: monFormatted,
                                                keepProfit: keepFormatted,
                                                shareText
                                            });

                                            await sdk.actions.composeCast({
                                                text: shareText,
                                                embeds: [{ url: 'https://farcaster.xyz/miniapps/dDsKsz-XG5KU/tavernkeeper' }],
                                            });
                                            console.log('✅ Compose cast prompt completed for raid');
                                        } catch (error: any) {
                                            console.warn('⚠️ Compose cast failed for raid (user may have cancelled):', {
                                                error: error?.message || error,
                                                errorType: error?.constructor?.name,
                                            });
                                        }
                                    }, 1500);
                                }
                            } catch (error) {
                                console.error('Error checking miniapp status:', error);
                            }
                        })();
                    } catch (error) {
                        console.error('Error parsing Raid event:', error);
                        alert("Raid successful! You claimed the pot.");
                    }
                } else {
                    alert("Raid successful! You claimed the pot.");
                }
            } else if (raidReceipt.status === 'reverted') {
                alert("Raid transaction failed.");
            }

            fetchData();
            const resetTimer = setTimeout(() => {
                resetRaidWrite();
            }, 500);
            return () => clearTimeout(resetTimer);
        }
    }, [raidReceipt, resetRaidWrite, address, publicClient, context]);

    // Handle raid notification (same pattern as office notification)
    useEffect(() => {
        if (!raidData || !address) return;

        const { monProfit, keepProfit, monProfitFormatted, keepProfitFormatted } = raidData;

        if (monProfit > 0n || keepProfit > 0n) {
            console.log('📨 Sending raid notification to feed...');
            fetch('/api/cellar/notify-raid', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    raiderAddress: address,
                    monProfit: monProfitFormatted,
                    keepProfit: keepProfitFormatted
                })
            })
                .then(async (response) => {
                    const data = await response.json();
                    if (response.ok && data.success) {
                        console.log('✅ Raid notification sent successfully:', data);
                    } else {
                        console.error('❌ Raid notification failed:', data);
                    }
                })
                .catch(err => {
                    console.error('❌ Failed to send raid notification:', err);
                });
        }

        // Clear raid data after processing
        setRaidData(null);
    }, [raidData, address]);

    const fetchPoolRatio = async () => {
        if (!publicClient) return;

        try {
            const poolAddress = CONTRACT_ADDRESSES.V3_POOL;
            if (!poolAddress || poolAddress === '0x0000000000000000000000000000000000000000') {
                return;
            }

            const [slot0, token0, token1] = await Promise.all([
                publicClient.readContract({
                    address: poolAddress as `0x${string}`,
                    abi: parseAbi(['function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)']),
                    functionName: 'slot0',
                }),
                publicClient.readContract({
                    address: poolAddress as `0x${string}`,
                    abi: parseAbi(['function token0() view returns (address)']),
                    functionName: 'token0',
                }),
                publicClient.readContract({
                    address: poolAddress as `0x${string}`,
                    abi: parseAbi(['function token1() view returns (address)']),
                    functionName: 'token1',
                }),
            ]);

            const sqrtPriceX96 = slot0[0] as bigint;
            const Q96 = 2n ** 96n;
            const sqrtPrice = Number(sqrtPriceX96) / Number(Q96);
            const price = sqrtPrice * sqrtPrice; // price = token1/token0

            const wmonAddress = CONTRACT_ADDRESSES.WMON;
            const keepAddress = CONTRACT_ADDRESSES.KEEP_TOKEN;
            const isToken0WMON = (token0 as string).toLowerCase() === wmonAddress.toLowerCase();
            const isToken0KEEP = (token0 as string).toLowerCase() === keepAddress.toLowerCase();

            // Calculate KEEP per MON ratio
            let keepPerMon: number;
            if (isToken0WMON) {
                // token0 = WMON, token1 = KEEP, price = KEEP/WMON = KEEP/MON
                keepPerMon = price;
            } else if (isToken0KEEP) {
                // token0 = KEEP, token1 = WMON, price = WMON/KEEP = MON/KEEP, so KEEP/MON = 1/price
                keepPerMon = 1 / price;
            } else {
                keepPerMon = 10; // Fallback
            }

            setKeepPerMonRatio(keepPerMon);
        } catch (error) {
            console.error("Failed to fetch pool ratio:", error);
            setKeepPerMonRatio(10); // Fallback to 10
        }
    };

    const fetchData = async () => {
        try {
            const data = await theCellarService.getCellarState();
            setState(data);

            if (address) {
                const balance = await theCellarService.getUserLpBalance(address);
                setLpBalance(balance);
            }

            // Fetch pool stats for percentage calculation
            const stats = await theCellarService.getPoolStats();
            setPoolStats(stats);
        } catch (error) {
            console.error("Failed to fetch cellar state", error);
        }
    };

    useEffect(() => {
        fetchData();
        fetchPoolRatio();
    }, [address, publicClient]);

    // Poll cellar state periodically
    useEffect(() => {
        const pollData = async () => {
            try {
                const data = await theCellarService.getCellarState(true); // Force refresh to bypass cache
                setState(data);

                if (address) {
                    const balance = await theCellarService.getUserLpBalance(address);
                    setLpBalance(balance);
                }

                // Fetch pool stats
                const stats = await theCellarService.getPoolStats();
                setPoolStats(stats);
            } catch (error) {
                console.error("Failed to poll cellar state", error);
            }
        };

        pollData();
        fetchPoolRatio(); // Also refresh ratio
        const interval = setInterval(() => {
            pollData();
            fetchPoolRatio();
        }, 30000); // Update every 30 seconds
        return () => clearInterval(interval);
    }, [address, publicClient]);

    const handleClaimClick = () => {
        setShowConfirmModal(true);
    };

    const handleClaim = async () => {
        if (!address || !isConnected || !walletClient || !publicClient || !state) return;

        setShowConfirmModal(false);
        setIsClaiming(true);
        try {
            // Raid Bid: Use current auction price from contract
            if (!state.currentPrice) {
                throw new Error("Unable to fetch current auction price. Please refresh.");
            }
            const bid = parseEther(state.currentPrice);

            // Get TheCellar address and CLP token address
            const contractConfig = CONTRACT_REGISTRY.THECELLAR;
            const cellarAddress = getContractAddress(contractConfig);
            if (!cellarAddress) throw new Error("TheCellar contract not found");

            // Get CLP token address
            const clpTokenAddress = await publicClient.readContract({
                address: cellarAddress,
                abi: parseAbi(['function cellarToken() view returns (address)']),
                functionName: 'cellarToken',
            }) as string;

            // Check CLP balance
            const clpBalance = await publicClient.readContract({
                address: clpTokenAddress as `0x${string}`,
                abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
                functionName: 'balanceOf',
                args: [address],
            }) as bigint;

            if (clpBalance < bid) {
                throw new Error(`Insufficient CLP balance. You have ${formatEther(clpBalance)} CLP but need ${formatEther(bid)} CLP.`);
            }

            // Check and approve CLP if needed
            const clpAllowance = await publicClient.readContract({
                address: clpTokenAddress as `0x${string}`,
                abi: parseAbi(['function allowance(address,address) view returns (uint256)']),
                functionName: 'allowance',
                args: [address, cellarAddress],
            }) as bigint;

            if (clpAllowance < bid) {
                console.log("Approving CLP tokens...");
                const approveHash = await walletClient.writeContract({
                    address: clpTokenAddress as `0x${string}`,
                    abi: parseAbi(['function approve(address,uint256) returns (bool)']),
                    functionName: 'approve',
                    chain: monad,
                    account: address,
                    args: [cellarAddress, bid],
                });
                await publicClient.waitForTransactionReceipt({ hash: approveHash });
                console.log("CLP Approved");
            }

            // Use writeContractAsync directly to integrate with useWaitForTransactionReceipt hook
            await writeContractAsync({
                address: cellarAddress,
                abi: contractConfig.abi,
                functionName: 'raid',
                args: [bid],
                account: address as Address,
                chainId: monad.id,
            });
        } catch (error: any) {
            console.error("Claim failed:", error);
            alert("Raid failed: " + (error.message || "Unknown error. See console for details."));
            setIsClaiming(false);
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
        if (!walletClient || !address || !isConnected || !publicClient) {
            alert("Please connect your wallet first.");
            return;
        }
        const input = document.getElementById('mintAmount') as HTMLInputElement;
        const amount = input.value || "1";

        setShowMintModal(false);
        setIsMinting(true);
        try {
            // Get current pool price to calculate correct ratio
            const poolAddress = CONTRACT_ADDRESSES.V3_POOL;
            if (!poolAddress || poolAddress === '0x0000000000000000000000000000000000000000') {
                throw new Error("V3 Pool address not configured");
            }

            // Get pool state to calculate correct ratio
            const [slot0, token0, token1] = await Promise.all([
                publicClient.readContract({
                    address: poolAddress as `0x${string}`,
                    abi: parseAbi(['function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)']),
                    functionName: 'slot0',
                }),
                publicClient.readContract({
                    address: poolAddress as `0x${string}`,
                    abi: parseAbi(['function token0() view returns (address)']),
                    functionName: 'token0',
                }),
                publicClient.readContract({
                    address: poolAddress as `0x${string}`,
                    abi: parseAbi(['function token1() view returns (address)']),
                    functionName: 'token1',
                }),
            ]);

            const sqrtPriceX96 = slot0[0] as bigint;
            const Q96 = 2n ** 96n;
            const sqrtPrice = Number(sqrtPriceX96) / Number(Q96);
            const price = sqrtPrice * sqrtPrice; // price = token1/token0

            const wmonAddress = CONTRACT_ADDRESSES.WMON;
            const keepAddress = CONTRACT_ADDRESSES.KEEP_TOKEN;
            const isToken0WMON = (token0 as string).toLowerCase() === wmonAddress.toLowerCase();
            const isToken0KEEP = (token0 as string).toLowerCase() === keepAddress.toLowerCase();

            // Calculate KEEP per MON ratio
            let keepPerMon: number;
            if (isToken0WMON) {
                // token0 = WMON, token1 = KEEP, price = KEEP/WMON = KEEP/MON
                keepPerMon = price;
            } else if (isToken0KEEP) {
                // token0 = KEEP, token1 = WMON, price = WMON/KEEP = MON/KEEP, so KEEP/MON = 1/price
                keepPerMon = 1 / price;
            } else {
                console.warn("Could not determine token order, using fallback 1:10 ratio");
                keepPerMon = 10; // Fallback (1 MON = 10 KEEP)
            }

            const amountMON = parseEther(amount);
            // Always use TARGET ratio: 10 KEEP = 1 MON (to fix pool price, not reinforce wrong ratio)
            const TARGET_KEEP_PER_MON = 10;
            const amountKEEP = parseEther((parseFloat(amount) * TARGET_KEEP_PER_MON).toString());

            // Get TheCellar address for approval
            const contractConfig = CONTRACT_REGISTRY.THECELLAR;
            const cellarAddress = getContractAddress(contractConfig);
            if (!cellarAddress) throw new Error("TheCellar contract not found");

            // 1. Check and wrap MON to WMON if needed, then check/approve WMON
            if (wmonAddress && wmonAddress !== '0x0000000000000000000000000000000000000000') {
                try {
                    // Check WMON balance first
                    const wmonBalance = await publicClient.readContract({
                        address: wmonAddress,
                        abi: parseAbi(['function balanceOf(address) view returns (uint256)']),
                        functionName: 'balanceOf',
                        args: [address],
                    });

                    // If not enough WMON, wrap MON
                    if (wmonBalance < amountMON) {
                        const wrapAmount = amountMON - wmonBalance;
                        const nativeBalance = await publicClient.getBalance({ address });

                        if (nativeBalance < wrapAmount) {
                            throw new Error(`Insufficient MON balance. Need ${formatEther(wrapAmount)} MON to wrap, but only have ${formatEther(nativeBalance)} MON.`);
                        }

                        console.log(`Wrapping ${formatEther(wrapAmount)} MON to WMON...`);
                        const wrapHash = await walletClient.writeContract({
                            address: wmonAddress,
                            abi: parseAbi(['function deposit() payable']),
                            functionName: 'deposit',
                            chain: monad,
                            value: wrapAmount,
                            account: address
                        });
                        await publicClient.waitForTransactionReceipt({ hash: wrapHash });
                        console.log("MON wrapped to WMON");
                    }

                    // Approve WMON (skip allowance check to avoid errors with WMON contract)
                    try {
                        console.log("Approving WMON...");
                        const approveHash = await theCellarService.approve(walletClient, wmonAddress, amountMON);
                        await publicClient.waitForTransactionReceipt({ hash: approveHash });
                        console.log("WMON Approved");
                    } catch (approveError: any) {
                        console.warn("WMON approval failed, but continuing:", approveError.message);
                    }
                } catch (error: any) {
                    console.error("WMON handling error:", error);
                    throw error;
                }
            }

            // 2. Check KEEP allowance
            const allowance = await theCellarService.getKeepAllowance(address, cellarAddress);
            if (allowance < amountKEEP) {
                console.log("Approving KEEP...");
                const approveHash = await theCellarService.approveKeep(walletClient, cellarAddress, amountKEEP);
                await publicClient.waitForTransactionReceipt({ hash: approveHash });
                console.log("KEEP Approved");
            }

            console.log("Adding Liquidity (Minting LP)...");
            const hash = await theCellarService.addLiquidity(walletClient, amountMON, amountKEEP);

            await publicClient.waitForTransactionReceipt({ hash });
            console.log("Transaction confirmed!");

            // Clear cache to ensure fresh data
            theCellarService.clearCache();

            alert("LP Minted Successfully!");
            fetchData(); // Refresh balance
        } catch (e: any) {
            console.error(e);
            alert("Mint failed: " + (e.message || "Unknown error"));
        } finally {
            setIsMinting(false);
        }
    };

    const handleRecoverLP = async () => {
        if (!walletClient || !address || !isConnected) return;

        setShowRecoverModal(false);
        setIsRecovering(true);
        try {
            // Check CLP allowance first
            const contractConfig = CONTRACT_REGISTRY.THECELLAR;
            const cellarAddress = getContractAddress(contractConfig);
            if (!cellarAddress) throw new Error("TheCellar contract not found");

            // Get CLP token address
            const clpTokenAddress = await publicClient.readContract({
                address: cellarAddress,
                abi: parseAbi(['function cellarToken() view returns (address)']),
                functionName: 'cellarToken',
            }) as string;

            // Check and approve CLP if needed
            const clpAllowance = await publicClient.readContract({
                address: clpTokenAddress as `0x${string}`,
                abi: parseAbi(['function allowance(address,address) view returns (uint256)']),
                functionName: 'allowance',
                args: [address, cellarAddress],
            }) as bigint;

            if (clpAllowance < lpBalance) {
                console.log("Approving CLP tokens for withdrawal...");
                const approveHash = await walletClient.writeContract({
                    address: clpTokenAddress as `0x${string}`,
                    abi: parseAbi(['function approve(address,uint256) returns (bool)']),
                    functionName: 'approve',
                    chain: monad,
                    account: address,
                    args: [cellarAddress, lpBalance],
                });
                await publicClient.waitForTransactionReceipt({ hash: approveHash });
                console.log("CLP Approved");
            }

            // Recover all LP tokens
            const hash = await theCellarService.recoverLiquidity(walletClient, lpBalance);

            // Wait for transaction receipt
            const receipt = await publicClient.waitForTransactionReceipt({ hash });

            if (receipt.status === 'success') {
                alert("Liquidity Recovered Successfully!");
                theCellarService.clearCache();
                fetchData();
            } else {
                throw new Error("Transaction failed");
            }
        } catch (e: any) {
            console.error("Recovery failed:", e);

            // Provide better error messages for new contract checks
            let errorMessage = e.message || "Unknown error";

            if (errorMessage.includes("Insufficient position liquidity")) {
                errorMessage = "Cannot withdraw: Position has less liquidity than your CLP balance. This can happen if liquidity was removed. Try withdrawing a smaller amount.";
            } else if (errorMessage.includes("Amount exceeds uint128 max")) {
                errorMessage = "Cannot withdraw: Amount is too large. Please contact support.";
            } else if (errorMessage.includes("No liquidity in position")) {
                errorMessage = "Cannot withdraw: No liquidity available in the position.";
            } else if (errorMessage.includes("Insufficient total liquidity")) {
                errorMessage = "Cannot withdraw: Insufficient liquidity in the contract.";
            } else if (errorMessage.includes("user rejected") || errorMessage.includes("User rejected")) {
                errorMessage = "Transaction cancelled by user.";
            }

            alert("Recovery failed: " + errorMessage);
        } finally {
            setIsRecovering(false);
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
    const currentPriceWei = state && state.currentPrice ? parseEther(state.currentPrice) : 0n;
    const hasEnoughLP = lpBalance >= currentPriceWei;

    // Calculate time remaining in epoch (epochPeriod is 3600 seconds = 1 hour)
    const epochPeriodSeconds = 3600; // 1 hour
    const timeRemaining = state && state.startTime > 0
        ? Math.max(0, epochPeriodSeconds - Math.floor((Date.now() - state.startTime) / 1000))
        : 0;
    const timeRemainingMinutes = Math.floor(timeRemaining / 60);
    const timeRemainingSeconds = timeRemaining % 60;

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
                </PixelBox>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2 p-2 text-white font-pixel h-full bg-[#1a120b] relative overflow-y-auto">
            {/* Background Image - Same as office */}
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

            <div className="relative z-10">
                <div className="flex items-center justify-center gap-1 mb-1">
                    <Flame className="w-4 h-4 text-orange-500 animate-pulse" />
                    <h2 className="text-base font-bold text-orange-400">THE CELLAR</h2>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <PixelBox variant="dark" className="p-2 flex flex-col items-center justify-center">
                        <div className="text-[8px] text-zinc-400 uppercase tracking-wider mb-0.5">Pot (MON)</div>
                        <div className="text-sm font-bold text-yellow-400">
                            {parseFloat(state.potSize).toFixed(4)} MON
                        </div>
                    </PixelBox>

                    <PixelBox variant="dark" className="p-2 flex flex-col items-center justify-center">
                        <div className="text-[8px] text-zinc-400 uppercase tracking-wider mb-0.5">Pot (KEEP)</div>
                        <div className="text-sm font-bold text-[#eaddcf]">
                            {parseFloat(state.potSizeKeep || "0").toFixed(2)} KEEP
                        </div>
                    </PixelBox>
                </div>
                {/* Auction Info Display */}
                <div className="flex flex-col items-center mt-2 gap-1">
                    <div className="text-[10px] text-zinc-500">
                        Raid Cost: <span className="text-orange-400 font-bold">{state ? parseFloat(state.currentPrice || '0').toFixed(2) : '0.00'} LP</span>
                    </div>
                    {state && state.epochId > 0 && (
                        <div className="text-[8px] text-zinc-600 text-center">
                            Epoch #{state.epochId} • Starts at {parseFloat(state.initPrice || '0').toFixed(2)} LP
                            {timeRemaining > 0 && (
                                <span className="ml-1">• {timeRemainingMinutes}m {timeRemainingSeconds}s remaining</span>
                            )}
                        </div>
                    )}
                </div>

                <div className="mt-2 pb-16"> {/* Reduced padding for mobile */}
                    <PixelButton
                        onClick={handleClaimClick}
                        disabled={!isConnected || isClaiming || isPotEmpty || !hasEnoughLP}
                        variant="danger"
                        className={`w-full h-10 text-sm font-bold uppercase tracking-widest transition-all flex items-center justify-center ${(!isConnected || isClaiming || isPotEmpty || !hasEnoughLP) ? "opacity-50 cursor-not-allowed" : ""}`}
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

                    {/* Your Share of the Pool - Prominent Display */}
                    {lpBalance > 0n && poolStats && poolStats.totalCLPSupply > 0n && (
                        <div className="bg-gradient-to-r from-green-900/40 to-green-800/20 rounded p-2 border-2 border-green-500/50 mt-2">
                            <div className="text-[8px] text-green-300 uppercase mb-1 text-center tracking-wider font-bold">
                                🎯 YOUR POOL SHARE
                            </div>
                            <div className="text-center mb-1">
                                <span className="text-green-400 font-bold text-lg">
                                    {((Number(lpBalance) / Number(poolStats.totalCLPSupply)) * 100).toFixed(2)}%
                                </span>
                                <span className="text-[10px] text-green-300 ml-1">of the pool</span>
                            </div>
                            <div className="text-[8px] text-green-200/80 text-center mb-1">
                                You own {parseFloat(formatEther(lpBalance)).toFixed(2)} CLP out of {parseFloat(formatEther(poolStats.totalCLPSupply)).toFixed(2)} total
                            </div>
                            <div className="text-[7px] text-green-200/60 text-center border-t border-green-500/30 pt-1 mt-1">
                                💡 This means you own {((Number(lpBalance) / Number(poolStats.totalCLPSupply)) * 100).toFixed(2)}% of all tokens in the pool
                            </div>
                        </div>
                    )}

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

                    <div className="mt-2 pt-2 border-t border-white/10">
                        <div className="text-[10px] text-zinc-400 mb-1 text-center uppercase tracking-wider">Need LP Tokens?</div>

                        {/* LP Farming Warning */}
                        <div className="bg-red-900/20 border border-red-800/50 rounded p-2 mb-2">
                            <p className="text-[9px] text-red-300 leading-tight">
                                <strong className="text-red-400">⚠️ WARNING:</strong> LP tokens are harvested by the system every hour. LP is meant to be <strong>locked by raids</strong>, not farmed. Your LP may be claimed by others through raids.
                            </p>
                        </div>

                        <div className="flex gap-1 mb-1">
                            <input
                                type="number"
                                placeholder="Amount MON"
                                className="w-full bg-black/50 border border-white/10 p-1.5 text-xs text-white font-pixel"
                                id="mintAmount"
                                defaultValue="1"
                            />
                        </div>

                        <PixelButton
                            onClick={handleMintLPClick}
                            disabled={isMinting}
                            variant="primary"
                            className="w-full h-8 text-xs font-bold uppercase tracking-widest flex items-center justify-center"
                        >
                            {isMinting ? <Loader2 className="w-3 h-3 animate-spin" /> : "MINT LP (1:10)"}
                        </PixelButton>

                        {lpBalance > 0n && (
                            <PixelButton
                                onClick={() => setShowRecoverModal(true)}
                                disabled={isRecovering}
                                variant="wood"
                                className="w-full h-6 mt-1 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center text-zinc-400 hover:text-white"
                            >
                                {isRecovering ? <Loader2 className="w-3 h-3 animate-spin" /> : "RECOVER LIQUIDITY"}
                            </PixelButton>
                        )}
                    </div>

                </div>


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
                                            {state ? parseFloat(state.currentPrice || '0').toFixed(2) : '0.00'} LP
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
                                // Always use TARGET ratio: 10 KEEP = 1 MON (to fix pool price, not reinforce wrong ratio)
                                const TARGET_KEEP_PER_MON = 10;
                                const amountKEEP = amountMON * TARGET_KEEP_PER_MON;
                                const needsApproval = true; // We'll check this, but show the modal anyway

                                // Estimate LP tokens based on historical data
                                // From chain: 5 MON + 7.42 KEEP = 6,091,697,987,201,539,195 liquidity units
                                // So roughly: 1 MON ≈ 1,218,339,597,440,307,839 liquidity units
                                // This is an estimate - actual will vary slightly
                                const estimatedLiquidityPerMON = 1218339597440307839n; // Approximate from recent events (BigInt)
                                const amountMONWei = BigInt(Math.floor(amountMON * 1e18)); // Convert to wei
                                const estimatedLPWei = (amountMONWei * estimatedLiquidityPerMON) / BigInt(1e18);

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
                                                    <span className="text-zinc-400 text-xs">CLP Tokens (You'll Receive):</span>
                                                    <span className="text-yellow-400 text-sm font-semibold">
                                                        ~{parseFloat(formatEther(estimatedLPWei)).toFixed(2)} CLP
                                                    </span>
                                                </div>
                                                <div className="mt-2 text-xs text-zinc-500">
                                                    (Estimate - actual amount may vary slightly)
                                                </div>
                                            </div>
                                        </div>

                                        {/* Critical LP Farming Warning */}
                                        <div className="bg-red-900/30 border-2 border-red-600/70 rounded p-3">
                                            <p className="text-xs text-red-200 leading-relaxed">
                                                <strong className="text-red-400 text-sm">⚠️ CRITICAL WARNING:</strong>
                                                <br />
                                                LP tokens are harvested by the system <strong>every hour</strong>.
                                                <br />
                                                LP is meant to be <strong>locked by raids</strong>, not farmed.
                                                <br />
                                                Your LP may be claimed by others through raids at any time.
                                            </p>
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
                {/* Recover Modal */}
                {showRecoverModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
                        <PixelBox variant="dark" className="max-w-md w-full p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-bold text-orange-400">Recover Liquidity</h3>
                                <button
                                    onClick={() => setShowRecoverModal(false)}
                                    className="text-zinc-400 hover:text-white transition-colors"
                                    disabled={isRecovering}
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="bg-[#2a1d17] rounded p-4 border border-[#5c4033]">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-zinc-400 text-sm">Amount to Recover:</span>
                                        <span className="text-xl font-bold text-orange-400">
                                            {parseFloat(formatEther(lpBalance)).toFixed(4)} CLP
                                        </span>
                                    </div>
                                    <div className="mt-2 text-xs text-zinc-500">
                                        This will burn your CLP tokens and return your MON and KEEP share + 90% of your proportional fees.
                                    </div>
                                </div>

                                <div className="bg-green-900/20 border border-green-800/50 rounded p-3">
                                    <p className="text-xs text-green-200">
                                        <strong className="text-green-400">✅ Improved Withdrawal:</strong>
                                        <br />
                                        The contract now includes safety checks to ensure withdrawals work correctly, even for ZAP-created LP tokens.
                                    </p>
                                </div>

                                <div className="flex gap-2 mt-4">
                                    <PixelButton
                                        onClick={() => setShowRecoverModal(false)}
                                        variant="neutral"
                                        className="flex-1"
                                        disabled={isRecovering}
                                    >
                                        Cancel
                                    </PixelButton>
                                    <PixelButton
                                        onClick={handleRecoverLP}
                                        variant="danger"
                                        className="flex-1"
                                        disabled={isRecovering}
                                    >
                                        {isRecovering ? "Recovering..." : "Confirm Recover"}
                                    </PixelButton>
                                </div>
                            </div>
                        </PixelBox>
                    </div>
                )}
            </div>
        </div>
    );
}
