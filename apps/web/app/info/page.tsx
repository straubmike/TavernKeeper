'use client';

import { SmartLink } from '../../lib/utils/smartNavigation';

export default function InfoPage() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-[#1a120b] via-[#2a1f15] to-[#1a120b] text-[#e5e5e5] font-sans">
            {/* Hero Section */}
            <div className="relative overflow-hidden">
                <div className="max-w-7xl mx-auto px-4 py-20 text-center">
                    <h1 className="text-7xl font-bold mb-6 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400 bg-clip-text text-transparent animate-pulse">
                        TavernKeeper
                    </h1>
                    <p className="text-2xl text-gray-300 mb-8 max-w-3xl mx-auto">
                        A decentralized game economy built on Monad with Dutch auctions, liquidity pools, and epic adventures
                    </p>
                    <div className="flex justify-center gap-4 flex-wrap">
                        <SmartLink
                            href="/tutorial"
                            className="px-8 py-4 bg-yellow-600 text-black font-bold rounded-lg hover:bg-yellow-500 transition-all transform hover:scale-105 shadow-lg shadow-yellow-600/50 inline-block"
                        >
                            📚 Start Tutorial
                        </SmartLink>
                        <SmartLink
                            href="/docs"
                            className="px-8 py-4 bg-gray-800 text-white font-bold rounded-lg hover:bg-gray-700 transition-all transform hover:scale-105 border-2 border-gray-600 inline-block"
                        >
                            📖 Full Docs
                        </SmartLink>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 pb-20">
                {/* Core Mechanics */}
                <section className="mb-20">
                    <h2 className="text-4xl font-bold mb-8 text-center text-yellow-400">Core Mechanics</h2>
                    <div className="grid md:grid-cols-2 gap-8">
                        {/* The Office */}
                        <div className="bg-gradient-to-br from-[#2a1f15] to-[#1a120b] rounded-xl p-8 border-2 border-yellow-600/30 shadow-xl hover:shadow-yellow-600/20 transition-all">
                            <div className="text-5xl mb-4">👑</div>
                            <h3 className="text-2xl font-bold text-yellow-400 mb-4">The Office</h3>
                            <p className="text-gray-300 mb-4">
                                Dutch auction system where players bid MON to become Manager and earn KEEP tokens over time.
                            </p>
                            <ul className="space-y-2 text-gray-400 mb-6">
                                <li className="flex items-start gap-2">
                                    <span className="text-yellow-500">•</span>
                                    <span>Price decreases from high to 1 MON over 1 hour</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-yellow-500">•</span>
                                    <span>Earn KEEP tokens while you're Manager</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-yellow-500">•</span>
                                    <span>Get 80% of payment when dethroned</span>
                                </li>
                            </ul>
                            <SmartLink
                                href="/tutorial/office"
                                className="text-yellow-400 hover:text-yellow-300 font-semibold inline-block"
                            >
                                Learn More →
                            </SmartLink>
                        </div>

                        {/* The Cellar */}
                        <div className="bg-gradient-to-br from-[#2a1f15] to-[#1a120b] rounded-xl p-8 border-2 border-yellow-600/30 shadow-xl hover:shadow-yellow-600/20 transition-all">
                            <div className="text-5xl mb-4">🏴‍☠️</div>
                            <h3 className="text-2xl font-bold text-yellow-400 mb-4">The Cellar</h3>
                            <p className="text-gray-300 mb-4">
                                Add liquidity to get CLP tokens (receipt tokens representing your share of the pool). Raid the pot by burning CLP tokens. 10% of fees from Uniswap V3 swaps accumulate in the pot (90% goes to deployer).
                            </p>
                            <div className="bg-blue-900/30 rounded-lg p-4 mb-4 border border-blue-500/50">
                                <h4 className="text-lg font-bold text-blue-300 mb-2">💡 Understanding Your Share</h4>
                                <p className="text-sm text-gray-200 mb-2">
                                    <strong className="text-blue-300">CLP tokens = Your ownership percentage</strong>
                                </p>
                                <ul className="text-xs text-gray-300 space-y-1">
                                    <li>• If you have 100 CLP and total supply is 1000 CLP, you own <strong className="text-blue-300">10% of the pool</strong></li>
                                    <li>• Your CLP tokens stay in your wallet until you raid or withdraw</li>
                                    <li>• The more CLP you have, the bigger your share of the pool</li>
                                </ul>
                            </div>
                            <ul className="space-y-2 text-gray-400 mb-6">
                                <li className="flex items-start gap-2">
                                    <span className="text-yellow-500">•</span>
                                    <span>Add liquidity to get CLP tokens (receipt tokens representing your share)</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-yellow-500">•</span>
                                    <span>10% of swap fees go to pot (90% to deployer)</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-yellow-500">•</span>
                                    <span>Burn CLP tokens to raid the entire pot</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-green-500 font-bold">✓</span>
                                    <span className="text-green-400 font-semibold">Your actual LP position is NEVER touched during raids</span>
                                </li>
                            </ul>
                            <SmartLink
                                href="/tutorial/office"
                                className="text-yellow-400 hover:text-yellow-300 font-semibold inline-block"
                            >
                                Learn More →
                            </SmartLink>
                        </div>
                    </div>
                </section>

                {/* Dutch Auction Explained */}
                <section className="mb-20">
                    <h2 className="text-4xl font-bold mb-8 text-center text-yellow-400">Dutch Auction System</h2>
                    <div className="bg-gradient-to-br from-[#2a1f15] to-[#1a120b] rounded-xl p-8 border-2 border-yellow-600/30 shadow-xl">
                        <div className="grid md:grid-cols-3 gap-6 mb-8">
                            <div className="text-center">
                                <div className="text-4xl mb-3">📈</div>
                                <h3 className="text-xl font-semibold text-yellow-400 mb-2">High Start</h3>
                                <p className="text-gray-400">Price starts at initPrice</p>
                            </div>
                            <div className="text-center">
                                <div className="text-4xl mb-3">⏱️</div>
                                <h3 className="text-xl font-semibold text-yellow-400 mb-2">Time Decay</h3>
                                <p className="text-gray-400">Price decreases linearly over epoch period</p>
                            </div>
                            <div className="text-center">
                                <div className="text-4xl mb-3">💰</div>
                                <h3 className="text-xl font-semibold text-yellow-400 mb-2">Floor Price</h3>
                                <p className="text-gray-400">Reaches minimum floor (1000 MON)</p>
                            </div>
                        </div>
                        <div className="bg-[#1a120b] rounded-lg p-6 border border-yellow-600/30">
                            <p className="text-center text-lg text-gray-300 mb-4">Price Formula</p>
                            <code className="block text-center text-yellow-400 font-mono text-xl">
                                price = initPrice - (initPrice × timePassed / epochPeriod)
                            </code>
                        </div>
                    </div>
                </section>

                {/* CRITICAL SAFETY SECTION */}
                <section className="mb-20">
                    <h2 className="text-4xl font-bold mb-8 text-center text-green-400">🛡️ Safety Guarantees: Your LP is Protected</h2>
                    <div className="bg-gradient-to-br from-green-900/30 to-green-800/20 rounded-xl p-8 border-4 border-green-500 shadow-xl">
                        <div className="bg-green-500/20 rounded-lg p-6 mb-6 border-2 border-green-400">
                            <h3 className="text-2xl font-bold text-green-300 mb-4 text-center">⚠️ IMPORTANT: CLP Tokens ≠ Your Actual Liquidity</h3>
                            <p className="text-lg text-gray-200 mb-4 text-center">
                                <strong className="text-green-300">CLP tokens are ERC20 receipt tokens</strong> - they represent your share but are NOT the actual liquidity locked in Uniswap V3.
                            </p>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6 mb-6">
                            <div className="bg-[#1a120b] rounded-lg p-6 border-2 border-green-500/50">
                                <h4 className="text-xl font-bold text-green-400 mb-3">✅ What Happens During a Raid</h4>
                                <ul className="space-y-2 text-gray-300">
                                    <li className="flex items-start gap-2">
                                        <span className="text-green-500 font-bold">✓</span>
                                        <span>Raider burns their CLP tokens (ERC20 token supply decreases)</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-green-500 font-bold">✓</span>
                                        <span>Raider receives the pot (MON + KEEP)</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-green-500 font-bold">✓</span>
                                        <span><strong>Uniswap V3 position is NEVER touched</strong></span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-green-500 font-bold">✓</span>
                                        <span>Your liquidity continues earning fees normally</span>
                                    </li>
                                </ul>
                            </div>

                            <div className="bg-[#1a120b] rounded-lg p-6 border-2 border-green-500/50">
                                <h4 className="text-xl font-bold text-green-400 mb-3">🔒 Your LP Remains Safe</h4>
                                <ul className="space-y-2 text-gray-300">
                                    <li className="flex items-start gap-2">
                                        <span className="text-green-500 font-bold">✓</span>
                                        <span>Uniswap V3 NFT position stays intact</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-green-500 font-bold">✓</span>
                                        <span>You can withdraw liquidity anytime via <code className="text-yellow-400">withdraw()</code></span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-green-500 font-bold">✓</span>
                                        <span>Fees continue accumulating normally</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-green-500 font-bold">✓</span>
                                        <span>Only raider's CLP balance decreases - yours is unaffected</span>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        <div className="bg-[#1a120b] rounded-lg p-6 border-2 border-yellow-500/50">
                            <h4 className="text-xl font-bold text-yellow-400 mb-3">📊 How It Works: Two-Layer System</h4>
                            <div className="space-y-4 text-gray-300">
                                <div className="flex items-start gap-3">
                                    <div className="text-2xl">1️⃣</div>
                                    <div>
                                        <strong className="text-yellow-400">Uniswap V3 NFT Position</strong> - The actual liquidity locked in Uniswap V3. This is NEVER touched during raids. It continues earning fees and can only be removed via the <code className="text-yellow-400">withdraw()</code> function.
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="text-2xl">2️⃣</div>
                                    <div>
                                        <strong className="text-yellow-400">CLP Tokens (ERC20)</strong> - Receipt tokens minted 1:1 when you add liquidity. These represent your share but are separate from the actual LP. During raids, only CLP tokens are burned - the actual Uniswap position remains untouched.
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 bg-blue-900/30 rounded-lg p-6 border-2 border-blue-500/50">
                            <h4 className="text-xl font-bold text-blue-400 mb-3">💡 Understanding Your Pool Share</h4>
                            <div className="space-y-3 text-gray-300">
                                <p>
                                    <strong className="text-blue-300">Your CLP tokens = Your ownership percentage of the pool</strong>
                                </p>
                                <div className="bg-blue-950/50 rounded p-3 border border-blue-500/30">
                                    <p className="text-sm mb-2"><strong>Formula:</strong></p>
                                    <code className="block text-blue-300 font-mono text-sm mb-2">
                                        Your Share = (Your CLP / Total CLP Supply) × 100%
                                    </code>
                                    <p className="text-xs text-gray-400 mt-2">
                                        Example: If you have 100 CLP and total supply is 1000 CLP, you own <strong className="text-blue-300">10% of the pool</strong>
                                    </p>
                                </div>
                                <ul className="space-y-2 text-sm">
                                    <li className="flex items-start gap-2">
                                        <span className="text-blue-400">•</span>
                                        <span>Your CLP tokens stay in your wallet - you don't have to raid or withdraw</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-blue-400">•</span>
                                        <span>The "Pool MON" display shows actual tokens in the pool, not CLP tokens</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-blue-400">•</span>
                                        <span>When you withdraw, you get your proportional share of the pool's tokens + fees</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-blue-400">•</span>
                                        <span>The more CLP you have, the bigger your share of the pool</span>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        <div className="mt-6 bg-red-900/30 rounded-lg p-6 border-2 border-red-500/50">
                            <h4 className="text-xl font-bold text-red-400 mb-3">🚫 Common Misconception (WRONG)</h4>
                            <p className="text-gray-300 mb-2">
                                <strong className="text-red-400">WRONG:</strong> "Raids remove liquidity from Uniswap V3"
                            </p>
                            <p className="text-gray-300">
                                <strong className="text-green-400">CORRECT:</strong> Raids only burn CLP tokens (ERC20 supply reduction). The Uniswap V3 position is completely separate and untouched. Think of CLP tokens like movie tickets - burning a ticket doesn't destroy the theater seat!
                            </p>
                        </div>
                    </div>
                </section>

                {/* LP Seeding System */}
                <section className="mb-20">
                    <h2 className="text-4xl font-bold mb-8 text-center text-yellow-400">LP Seeding & Fee Generation</h2>
                    <div className="bg-gradient-to-br from-[#2a1f15] to-[#1a120b] rounded-xl p-8 border-2 border-yellow-600/30 shadow-xl">
                        <div className="grid md:grid-cols-4 gap-6">
                            <div className="text-center">
                                <div className="text-5xl mb-4">💧</div>
                                <h3 className="text-lg font-semibold text-yellow-400 mb-2">Add Liquidity</h3>
                                <p className="text-sm text-gray-400">WMON + KEEP → CLP tokens</p>
                                <p className="text-xs text-green-400 mt-2">(Receipt tokens, not actual LP)</p>
                            </div>
                            <div className="text-center">
                                <div className="text-5xl mb-4">🔄</div>
                                <h3 className="text-lg font-semibold text-yellow-400 mb-2">Swaps Happen</h3>
                                <p className="text-sm text-gray-400">Traders swap on V3 pool</p>
                                <p className="text-xs text-green-400 mt-2">(LP position earns fees)</p>
                            </div>
                            <div className="text-center">
                                <div className="text-5xl mb-4">💸</div>
                                <h3 className="text-lg font-semibold text-yellow-400 mb-2">Fees Accumulate</h3>
                                <p className="text-sm text-gray-400">1% fee per swap → Pot</p>
                                <p className="text-xs text-green-400 mt-2">(10% to pot, 90% to deployer)</p>
                            </div>
                            <div className="text-center">
                                <div className="text-5xl mb-4">⚔️</div>
                                <h3 className="text-lg font-semibold text-yellow-400 mb-2">Raid Pot</h3>
                                <p className="text-sm text-gray-400">Burn CLP → Get pot</p>
                                <p className="text-xs text-green-400 mt-2 font-bold">(LP position untouched!)</p>
                            </div>
                        </div>
                        <div className="mt-8 bg-[#1a120b] rounded-lg p-6 border border-yellow-600/30">
                            <p className="text-center text-gray-300 mb-4">
                                <span className="text-yellow-400 font-semibold">Uniswap V3 Integration:</span> All liquidity is managed through a single V3 NFT position.
                                CLP tokens represent your proportional share of the position. Swap fees are split: 90% to deployer, 10% to pot.
                            </p>
                            <div className="bg-green-900/30 rounded p-4 border border-green-500/50 mt-4">
                                <p className="text-center text-green-300 font-semibold">
                                    🔒 Safety: The Uniswap V3 position is NEVER modified during raids. Only CLP token supply decreases. Your actual liquidity remains locked and earning fees.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* How Raids Work - Detailed Explanation */}
                <section className="mb-20">
                    <h2 className="text-4xl font-bold mb-8 text-center text-yellow-400">How Raids Work: Step-by-Step</h2>
                    <div className="bg-gradient-to-br from-[#2a1f15] to-[#1a120b] rounded-xl p-8 border-2 border-yellow-600/30 shadow-xl">
                        <div className="space-y-6">
                            <div className="bg-[#1a120b] rounded-lg p-6 border-2 border-yellow-600/30">
                                <h3 className="text-xl font-bold text-yellow-400 mb-3">Step 1: Check Current Auction Price</h3>
                                <p className="text-gray-300 mb-2">
                                    The raid price decreases over time via Dutch auction. Price starts high and decreases linearly to a minimum floor.
                                </p>
                                <code className="block bg-black/50 rounded p-2 text-yellow-400 font-mono text-sm mt-2">
                                    price = initPrice - (initPrice × timePassed / epochPeriod)
                                </code>
                            </div>

                            <div className="bg-[#1a120b] rounded-lg p-6 border-2 border-yellow-600/30">
                                <h3 className="text-xl font-bold text-yellow-400 mb-3">Step 2: Burn CLP Tokens (NOT Your LP!)</h3>
                                <p className="text-gray-300 mb-2">
                                    When you raid, you burn CLP tokens (ERC20 receipt tokens). This reduces the CLP token supply but does NOT touch the Uniswap V3 position.
                                </p>
                                <div className="bg-green-900/30 rounded p-3 border border-green-500/50 mt-3">
                                    <p className="text-green-300 text-sm">
                                        <strong>Critical:</strong> The <code className="text-green-400">raid()</code> function only calls <code className="text-green-400">cellarToken.burn()</code>.
                                        It NEVER calls <code className="text-green-400">decreaseLiquidity()</code> on the Uniswap position. Your actual LP is completely safe.
                                    </p>
                                </div>
                            </div>

                            <div className="bg-[#1a120b] rounded-lg p-6 border-2 border-yellow-600/30">
                                <h3 className="text-xl font-bold text-yellow-400 mb-3">Step 3: Receive Pot Contents</h3>
                                <p className="text-gray-300 mb-2">
                                    You receive the entire pot (MON + KEEP tokens accumulated from fees). The pot resets to zero and a new epoch begins.
                                </p>
                            </div>

                            <div className="bg-[#1a120b] rounded-lg p-6 border-2 border-green-600/30">
                                <h3 className="text-xl font-bold text-green-400 mb-3">✅ What Does NOT Happen</h3>
                                <ul className="space-y-2 text-gray-300">
                                    <li className="flex items-start gap-2">
                                        <span className="text-red-500">✗</span>
                                        <span><strong>Your Uniswap V3 position is NOT decreased</strong> - no <code className="text-yellow-400">decreaseLiquidity()</code> call</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-red-500">✗</span>
                                        <span><strong>Your actual liquidity is NOT removed</strong> - WMON and KEEP stay in the pool</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-red-500">✗</span>
                                        <span><strong>Fee earning stops</strong> - NO, fees continue accumulating normally</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-red-500">✗</span>
                                        <span><strong>You lose your LP</strong> - NO, you can still withdraw via <code className="text-yellow-400">withdraw()</code></span>
                                    </li>
                                </ul>
                            </div>

                            <div className="bg-[#1a120b] rounded-lg p-6 border-2 border-blue-600/30">
                                <h3 className="text-xl font-bold text-blue-400 mb-3">📋 Comparison: Raid vs Withdraw</h3>
                                <div className="grid md:grid-cols-2 gap-4 mt-4">
                                    <div className="bg-yellow-900/20 rounded p-4 border border-yellow-600/30">
                                        <h4 className="font-bold text-yellow-400 mb-2">Raid Operation</h4>
                                        <ul className="text-sm text-gray-300 space-y-1">
                                            <li>• Burns CLP tokens only</li>
                                            <li>• Does NOT touch Uniswap V3</li>
                                            <li>• Gets pot contents</li>
                                            <li>• LP position unchanged</li>
                                        </ul>
                                    </div>
                                    <div className="bg-blue-900/20 rounded p-4 border border-blue-600/30">
                                        <h4 className="font-bold text-blue-400 mb-2">Withdraw Operation</h4>
                                        <ul className="text-sm text-gray-300 space-y-1">
                                            <li>• Burns CLP tokens</li>
                                            <li>• Calls decreaseLiquidity()</li>
                                            <li>• Removes actual LP</li>
                                            <li>• Returns WMON + KEEP</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Quick Stats */}
                <section className="mb-20">
                    <h2 className="text-4xl font-bold mb-8 text-center text-yellow-400">Key Numbers</h2>
                    <div className="grid md:grid-cols-4 gap-6">
                        <div className="bg-gradient-to-br from-[#2a1f15] to-[#1a120b] rounded-xl p-6 border-2 border-yellow-600/30 text-center">
                            <div className="text-3xl font-bold text-yellow-400 mb-2">1%</div>
                            <p className="text-gray-400">Swap Fee</p>
                        </div>
                        <div className="bg-gradient-to-br from-[#2a1f15] to-[#1a120b] rounded-xl p-6 border-2 border-yellow-600/30 text-center">
                            <div className="text-3xl font-bold text-yellow-400 mb-2">1 Hour</div>
                            <p className="text-gray-400">Epoch Period</p>
                        </div>
                        <div className="bg-gradient-to-br from-[#2a1f15] to-[#1a120b] rounded-xl p-6 border-2 border-yellow-600/30 text-center">
                            <div className="text-3xl font-bold text-yellow-400 mb-2">1 MON</div>
                            <p className="text-gray-400">Min Price Floor</p>
                        </div>
                        <div className="bg-gradient-to-br from-[#2a1f15] to-[#1a120b] rounded-xl p-6 border-2 border-yellow-600/30 text-center">
                            <div className="text-3xl font-bold text-yellow-400 mb-2">V3</div>
                            <p className="text-gray-400">Uniswap Version</p>
                        </div>
                    </div>
                </section>

                {/* Token Economics */}
                <section className="mb-20">
                    <h2 className="text-4xl font-bold mb-8 text-center text-yellow-400">Token Economics</h2>
                    <div className="grid md:grid-cols-3 gap-6">
                        <div className="bg-gradient-to-br from-[#2a1f15] to-[#1a120b] rounded-xl p-6 border-2 border-yellow-600/30">
                            <h3 className="text-xl font-semibold text-yellow-400 mb-3">MON</h3>
                            <p className="text-gray-300 mb-4">Native currency on Monad. Used for:</p>
                            <ul className="space-y-2 text-gray-400">
                                <li>• Taking The Office</li>
                                <li>• Adding liquidity</li>
                                <li>• All transactions</li>
                            </ul>
                        </div>
                        <div className="bg-gradient-to-br from-[#2a1f15] to-[#1a120b] rounded-xl p-6 border-2 border-yellow-600/30">
                            <h3 className="text-xl font-semibold text-yellow-400 mb-3">KEEP</h3>
                            <p className="text-gray-300 mb-4">Game token. Earned by:</p>
                            <ul className="space-y-2 text-gray-400">
                                <li>• Being Manager of The Office</li>
                                <li>• Raiding The Cellar</li>
                                <li>• Gameplay rewards</li>
                            </ul>
                        </div>
                        <div className="bg-gradient-to-br from-[#2a1f15] to-[#1a120b] rounded-xl p-6 border-2 border-yellow-600/30">
                            <h3 className="text-xl font-semibold text-yellow-400 mb-3">CLP</h3>
                            <p className="text-gray-300 mb-4">Cellar LP tokens. Represent:</p>
                            <ul className="space-y-2 text-gray-400">
                                <li>• Your share of V3 position</li>
                                <li>• Used to raid the pot</li>
                                <li>• 1:1 with liquidity units</li>
                            </ul>
                        </div>
                    </div>
                </section>

                {/* Call to Action */}
                <section className="text-center">
                    <div className="bg-gradient-to-br from-yellow-600/20 to-yellow-500/10 rounded-xl p-12 border-2 border-yellow-600/50">
                        <h2 className="text-4xl font-bold mb-4 text-yellow-400">Ready to Get Started?</h2>
                        <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
                            Dive deep into the mechanics with our comprehensive tutorial, or explore the full documentation for technical details.
                        </p>
                        <div className="flex justify-center gap-4 flex-wrap">
                            <SmartLink
                                href="/tutorial"
                                className="px-8 py-4 bg-yellow-600 text-black font-bold rounded-lg hover:bg-yellow-500 transition-all transform hover:scale-105 shadow-lg shadow-yellow-600/50 inline-block"
                            >
                                📚 View Tutorial
                            </SmartLink>
                            <SmartLink
                                href="/docs"
                                className="px-8 py-4 bg-gray-800 text-white font-bold rounded-lg hover:bg-gray-700 transition-all transform hover:scale-105 border-2 border-gray-600 inline-block"
                            >
                                📖 Read Docs
                            </SmartLink>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}

