'use client';

import { useState } from 'react';
import { SmartLink } from '../../../lib/utils/smartNavigation';

export default function OfficeTutorialPage() {
    const [activeStep, setActiveStep] = useState(0);

    const officeSteps = [
        {
            title: 'Understanding The Office',
            description: 'The Office is a Dutch auction system where players bid MON to become the "Manager" and earn KEEP tokens over time.',
            details: [
                'Each epoch starts with a high initial price',
                'Price decreases linearly over 1 hour (3600 seconds)',
                'Minimum price floor is 1000 MON',
                'When someone takes office, they become the new Manager',
                'Previous Manager receives 80% of the payment + accumulated KEEP tokens'
            ],
            visual: '📊'
        },
        {
            title: 'Step 1: Check Current Price',
            description: 'Before taking office, check the current auction price which decreases over time.',
            details: [
                'Price starts at initPrice (set by previous Manager)',
                'Formula: price = initPrice - (initPrice × timePassed / 3600)',
                'Price cannot go below 1000 MON minimum',
                'The longer you wait, the cheaper it gets (but someone else might take it!)'
            ],
            visual: '💰'
        },
        {
            title: 'Step 2: Prepare Your Bid',
            description: 'You need MON tokens to take office. The contract will refund any excess payment.',
            details: [
                'Calculate the current price from the auction',
                'Add a small buffer (5%) to handle price changes',
                'Ensure you have enough MON in your wallet',
                'Set a maxPrice to protect against price increases'
            ],
            visual: '💼'
        },
        {
            title: 'Step 3: Take Office',
            description: 'Call the takeOffice function with your bid amount and optional message.',
            details: [
                'Send transaction with MON payment',
                'Contract validates epoch ID and price',
                'Excess payment is automatically refunded',
                'You become the new Manager immediately'
            ],
            visual: '👑'
        },
        {
            title: 'Step 4: Earn KEEP Tokens',
            description: 'As Manager, you earn KEEP tokens at a rate that decreases over time (halving mechanism).',
            details: [
                'Earning rate starts at 0.1 KEEP/second',
                'Rate halves every 30 days',
                'Minimum rate is 0.01 KEEP/second',
                'KEEP accumulates until you claim or are dethroned'
            ],
            visual: '⏰'
        },
        {
            title: 'Step 5: Claim Rewards',
            description: 'When you are dethroned, you automatically receive your accumulated KEEP tokens.',
            details: [
                'KEEP is minted when new Manager takes office',
                'You receive 80% of the payment from new Manager',
                'Total reward = KEEP earned + 80% of new Manager payment',
                'No action needed - rewards are automatic'
            ],
            visual: '🎁'
        }
    ];

    const dutchAuctionSection = {
        title: 'Dutch Auction Mechanics Explained',
        description: 'Both The Office and The Cellar use Dutch auctions - prices start high and decrease over time.',
        points: [
            {
                title: 'Price Decay Formula',
                content: 'price = initPrice - (initPrice × timePassed / epochPeriod)',
                example: 'If initPrice = 10 MON and 30 minutes (1800s) have passed: price = 10 - (10 × 1800 / 3600) = 5 MON'
            },
            {
                title: 'Why Dutch Auctions?',
                content: 'Creates urgency - prices get cheaper over time, but someone else might take it first. Rewards early action with higher prices, but allows latecomers to get better deals.',
                example: 'Early raider pays more but gets pot first. Late raider pays less but risks missing out.'
            },
            {
                title: 'Price Reset',
                content: 'When someone takes office or raids, the price resets to a new initPrice (usually higher).',
                example: 'After raid: newInitPrice = oldInitPrice × multiplier (typically 1.1x to 2x)'
            },
            {
                title: 'Minimum Floor',
                content: 'Prices cannot go below a minimum floor (1000 MON for Office, configurable for Cellar).',
                example: 'Even after full epoch period, price stays at minimum floor'
            }
        ]
    };

    return (
        <div className="min-h-screen bg-[#1a120b] text-[#e5e5e5] font-sans">
            <div className="max-w-6xl mx-auto px-4 py-12">
                <h1 className="text-5xl font-bold mb-4 text-yellow-400">Tutorial: Taking Office & Raiding The Cellar</h1>
                <p className="text-xl text-gray-300 mb-12">
                    A complete visual walkthrough of the core mechanics in TavernKeeper
                </p>

                {/* Taking Office Section */}
                <section className="mb-16">
                    <h2 className="text-3xl font-bold mb-6 text-yellow-400 border-b-2 border-yellow-600 pb-2">
                        Part 1: Taking The Office 👑
                    </h2>
                    <div className="space-y-8">
                        {officeSteps.map((step, index) => (
                            <div
                                key={index}
                                className={`bg-[#2a1f15] rounded-lg p-6 border-2 transition-all ${
                                    activeStep === index
                                        ? 'border-yellow-500 shadow-lg shadow-yellow-500/20'
                                        : 'border-gray-700 hover:border-yellow-600'
                                }`}
                                onClick={() => setActiveStep(index)}
                            >
                                <div className="flex items-start gap-4">
                                    <div className="text-4xl">{step.visual}</div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="text-2xl font-bold text-yellow-400">Step {index + 1}</span>
                                            <h3 className="text-2xl font-semibold">{step.title}</h3>
                                        </div>
                                        <p className="text-lg text-gray-300 mb-4">{step.description}</p>
                                        <ul className="space-y-2">
                                            {step.details.map((detail, i) => (
                                                <li key={i} className="flex items-start gap-2 text-gray-400">
                                                    <span className="text-yellow-500 mt-1">•</span>
                                                    <span>{detail}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Dutch Auction Mechanics */}
                <section className="mb-16">
                    <h2 className="text-3xl font-bold mb-6 text-yellow-400 border-b-2 border-yellow-600 pb-2">
                        {dutchAuctionSection.title} 📊
                    </h2>
                    <p className="text-lg text-gray-300 mb-8">{dutchAuctionSection.description}</p>
                    <div className="grid md:grid-cols-2 gap-6">
                        {dutchAuctionSection.points.map((point, index) => (
                            <div key={index} className="bg-[#2a1f15] rounded-lg p-6 border-2 border-gray-700">
                                <h3 className="text-xl font-semibold text-yellow-400 mb-3">{point.title}</h3>
                                <p className="text-gray-300 mb-3">{point.content}</p>
                                <div className="bg-[#1a120b] rounded p-3 border border-yellow-600/30">
                                    <p className="text-sm text-yellow-300 font-mono">{point.example}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Raiding The Cellar Section */}
                <section className="mb-16">
                    <h2 className="text-3xl font-bold mb-6 text-yellow-400 border-b-2 border-yellow-600 pb-2">
                        Part 2: Raiding The Cellar 🏴‍☠️
                    </h2>

                    {/* CRITICAL SAFETY NOTICE */}
                    <div className="bg-gradient-to-br from-green-900/40 to-green-800/20 rounded-xl p-6 mb-8 border-4 border-green-500 shadow-xl">
                        <h3 className="text-2xl font-bold text-green-300 mb-4 text-center">🛡️ CRITICAL SAFETY INFORMATION</h3>
                        <div className="bg-green-500/20 rounded-lg p-4 border-2 border-green-400 mb-4">
                            <p className="text-lg text-gray-200 text-center mb-3">
                                <strong className="text-green-300">CLP Tokens ≠ Your Actual Liquidity</strong>
                            </p>
                            <p className="text-gray-300 text-center">
                                CLP tokens are ERC20 receipt tokens. Burning them during raids does NOT remove your actual liquidity from Uniswap V3.
                                Your LP position remains safe and continues earning fees.
                            </p>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="bg-[#1a120b] rounded p-4 border border-green-500/50">
                                <p className="text-green-400 font-bold mb-2">✅ What Raids Do:</p>
                                <ul className="text-sm text-gray-300 space-y-1">
                                    <li>• Burn CLP tokens (ERC20 supply)</li>
                                    <li>• Give you the pot contents</li>
                                    <li>• Start new auction epoch</li>
                                </ul>
                            </div>
                            <div className="bg-[#1a120b] rounded p-4 border border-green-500/50">
                                <p className="text-green-400 font-bold mb-2">❌ What Raids DON'T Do:</p>
                                <ul className="text-sm text-gray-300 space-y-1">
                                    <li>• Touch Uniswap V3 position</li>
                                    <li>• Remove your actual liquidity</li>
                                    <li>• Stop fee accumulation</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Cellar Tutorial Steps */}
                    <div className="space-y-8">
                        {[
                            {
                                title: 'Understanding CLP Tokens vs Actual LP',
                                description: 'CLP tokens are receipt tokens representing your share, but they are NOT the actual liquidity locked in Uniswap V3.',
                                details: [
                                    'When you add liquidity, you get CLP tokens minted 1:1 with liquidity units',
                                    'CLP tokens are ERC20 tokens - just like any other token you can hold or transfer',
                                    'The actual liquidity is in a Uniswap V3 NFT position managed by TheCellar contract',
                                    'Think of CLP tokens like movie tickets - burning a ticket doesn\'t destroy the theater seat!',
                                    'Your actual LP (WMON + KEEP) stays locked in Uniswap V3 and continues earning fees'
                                ],
                                visual: '🎫'
                            },
                            {
                                title: 'Understanding Your Pool Share (Percentage)',
                                description: 'Your CLP tokens represent your ownership percentage of the entire pool. The more CLP you have, the bigger your share.',
                                details: [
                                    'Your percentage = (Your CLP / Total CLP Supply) × 100%',
                                    'Example: If you have 100 CLP and total supply is 1000 CLP, you own 10% of the pool',
                                    'Your share determines how much of the pool\'s fees you earn when withdrawing',
                                    'CLP tokens stay in your wallet - you don\'t have to raid or withdraw',
                                    'The "Pool MON" display shows actual tokens in the pool, not CLP tokens',
                                    'Your CLP balance is your receipt showing your ownership share'
                                ],
                                visual: '📊'
                            },
                            {
                                title: 'Step 1: Add Liquidity to Get CLP Tokens',
                                description: 'Provide WMON and KEEP tokens to receive CLP tokens as receipts.',
                                details: [
                                    'Approve WMON and KEEP tokens to TheCellarV3 contract',
                                    'Call addLiquidity() with your desired amounts',
                                    'Liquidity is added to the shared Uniswap V3 NFT position',
                                    'You receive CLP tokens 1:1 with liquidity units added',
                                    'Your actual tokens are now locked in Uniswap V3 earning fees'
                                ],
                                visual: '💧'
                            },
                            {
                                title: 'Step 2: Understand How Fees Accumulate',
                                description: 'As traders swap on the Uniswap V3 pool, fees accumulate in the pot.',
                                details: [
                                    'Each swap charges a 1% fee',
                                    '90% of fees go to the deployer address',
                                    '10% of fees accumulate in the pot (potBalanceMON + potBalanceKEEP)',
                                    'Fees accumulate continuously as trading happens',
                                    'The pot grows over time until someone raids it'
                                ],
                                visual: '💰'
                            },
                            {
                                title: 'Step 3: Check Current Raid Price',
                                description: 'The raid price decreases over time via Dutch auction, starting high and decreasing to a minimum floor.',
                                details: [
                                    'Price starts at initPrice (set when last raid happened)',
                                    'Price decreases linearly: price = initPrice - (initPrice × timePassed / epochPeriod)',
                                    'Price cannot go below minInitPrice (minimum floor)',
                                    'The longer you wait, the cheaper it gets (but someone else might raid first!)',
                                    'Use getAuctionPrice() to check current price'
                                ],
                                visual: '📊'
                            },
                            {
                                title: 'Step 4: Raid the Pot (Burn CLP Tokens)',
                                description: 'Burn your CLP tokens to claim the entire pot. Your actual LP remains untouched.',
                                details: [
                                    'Ensure you have enough CLP tokens (must be >= current auction price)',
                                    'Call raid() with the amount of CLP tokens to burn',
                                    'CLP tokens are burned (ERC20 supply decreases)',
                                    'You receive the entire pot (MON + KEEP)',
                                    '⚠️ CRITICAL: Only CLP tokens are burned - your Uniswap V3 position is NEVER touched',
                                    'The raid() function does NOT call decreaseLiquidity() - your LP stays safe'
                                ],
                                visual: '⚔️'
                            },
                            {
                                title: 'Step 5: Understand What Happens After Raid',
                                description: 'After a raid, the pot resets and a new epoch begins. Your liquidity continues earning fees.',
                                details: [
                                    'Pot resets to zero (new pot starts accumulating)',
                                    'New epoch begins with higher initPrice (multiplied by priceMultiplier)',
                                    'Your Uniswap V3 position continues unchanged',
                                    'Fees continue accumulating normally (10% to new pot, 90% to deployer)',
                                    'You can still withdraw your liquidity anytime via withdraw() function',
                                    'Your LP position is completely unaffected by the raid'
                                ],
                                visual: '🔄'
                            },
                            {
                                title: 'Withdrawing Your Liquidity (Separate from Raids)',
                                description: 'To actually remove your liquidity, use the withdraw() function - this is completely separate from raids.',
                                details: [
                                    'Call withdraw() with the amount of CLP tokens to burn',
                                    'This function DOES call decreaseLiquidity() on Uniswap V3',
                                    'Your actual liquidity is removed from the pool',
                                    'You receive your principal (WMON + KEEP) plus 90% of your earned fees',
                                    '10% of your fees go to the pot',
                                    'This is the ONLY way to remove actual liquidity - raids never do this'
                                ],
                                visual: '🏦'
                            }
                        ].map((step, index) => (
                            <div
                                key={index}
                                className={`bg-[#2a1f15] rounded-lg p-6 border-2 transition-all ${
                                    activeStep === officeSteps.length + index
                                        ? 'border-yellow-500 shadow-lg shadow-yellow-500/20'
                                        : 'border-gray-700 hover:border-yellow-600'
                                }`}
                                onClick={() => setActiveStep(officeSteps.length + index)}
                            >
                                <div className="flex items-start gap-4">
                                    <div className="text-4xl">{step.visual}</div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="text-2xl font-bold text-yellow-400">Step {index + 1}</span>
                                            <h3 className="text-2xl font-semibold">{step.title}</h3>
                                        </div>
                                        <p className="text-lg text-gray-300 mb-4">{step.description}</p>
                                        <ul className="space-y-2">
                                            {step.details.map((detail, i) => (
                                                <li key={i} className={`flex items-start gap-2 ${
                                                    detail.includes('CRITICAL') || detail.includes('⚠️')
                                                        ? 'text-yellow-300 font-semibold'
                                                        : detail.includes('✓') || detail.includes('✅')
                                                        ? 'text-green-300'
                                                        : 'text-gray-400'
                                                }`}>
                                                    <span className={`mt-1 ${
                                                        detail.includes('CRITICAL') || detail.includes('⚠️')
                                                            ? 'text-yellow-500'
                                                            : detail.includes('✓') || detail.includes('✅')
                                                            ? 'text-green-500'
                                                            : 'text-yellow-500'
                                                    }`}>•</span>
                                                    <span>{detail}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Visual Comparison Section */}
                    <div className="mt-12 bg-[#2a1f15] rounded-xl p-8 border-2 border-yellow-600/30">
                        <h3 className="text-2xl font-bold text-yellow-400 mb-6 text-center">Visual Comparison: Raid vs Withdraw</h3>
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="bg-yellow-900/20 rounded-lg p-6 border-2 border-yellow-600/50">
                                <h4 className="text-xl font-bold text-yellow-400 mb-4">Raid Operation ⚔️</h4>
                                <div className="space-y-3 text-gray-300">
                                    <div className="flex items-start gap-2">
                                        <span className="text-yellow-500">1.</span>
                                        <span>Burns CLP tokens (ERC20 supply ↓)</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="text-yellow-500">2.</span>
                                        <span>Transfers pot to raider</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="text-green-500 font-bold">3.</span>
                                        <span className="text-green-300 font-semibold">Does NOT touch Uniswap V3 position</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="text-green-500 font-bold">4.</span>
                                        <span className="text-green-300 font-semibold">LP continues earning fees normally</span>
                                    </div>
                                    <div className="bg-green-900/30 rounded p-3 border border-green-500/50 mt-4">
                                        <p className="text-sm text-green-300">
                                            <strong>Result:</strong> CLP supply decreases, raider gets pot, everyone's LP stays safe
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-blue-900/20 rounded-lg p-6 border-2 border-blue-600/50">
                                <h4 className="text-xl font-bold text-blue-400 mb-4">Withdraw Operation 🏦</h4>
                                <div className="space-y-3 text-gray-300">
                                    <div className="flex items-start gap-2">
                                        <span className="text-blue-500">1.</span>
                                        <span>Burns CLP tokens</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="text-blue-500">2.</span>
                                        <span>Calls decreaseLiquidity() on Uniswap V3</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="text-blue-500">3.</span>
                                        <span>Removes actual liquidity from pool</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="text-blue-500">4.</span>
                                        <span>Returns WMON + KEEP + 90% of fees</span>
                                    </div>
                                    <div className="bg-blue-900/30 rounded p-3 border border-blue-500/50 mt-4">
                                        <p className="text-sm text-blue-300">
                                            <strong>Result:</strong> Actual liquidity removed, you get your tokens back
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Navigation */}
                <div className="flex justify-center gap-4 mt-12">
                    <SmartLink
                        href="/docs"
                        className="px-6 py-3 bg-yellow-600 text-black font-semibold rounded hover:bg-yellow-500 transition-colors inline-block"
                    >
                        Read Full Documentation
                    </SmartLink>
                    <SmartLink
                        href="/info"
                        className="px-6 py-3 bg-gray-700 text-white font-semibold rounded hover:bg-gray-600 transition-colors inline-block"
                    >
                        Quick Info Page
                    </SmartLink>
                </div>
            </div>
        </div>
    );
}
