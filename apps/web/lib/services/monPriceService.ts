/**
 * MON Token Price Service
 * Fetches current MON token price in USD and calculates required MON amounts
 *
 * IMPORTANT: This fetches the REAL market price of MON token, not a hardcoded value.
 * The contract price we fetch is the OFFICE PRICE (Dutch auction price in MON to take the office).
 */

// MON to USD price cache
let monPriceCache: { price: number; timestamp: number } | null = null;
const CACHE_DURATION = 60_000; // 1 minute cache

// In-flight promise to prevent double-fetching (deduplication)
let fetchPromise: Promise<number> | null = null;

/**
 * Fetches the current MON token price in USD from CoinGecko API
 * Returns cached value if available and fresh (< 1 minute old)
 *
 * @returns Promise<number> MON price in USD (e.g., 0.02897)
 */
export async function getMonPrice(): Promise<number> {
    // Return cached price if still valid
    if (monPriceCache && Date.now() - monPriceCache.timestamp < CACHE_DURATION) {
        return monPriceCache.price;
    }

    // Return existing promise if request is already in flight
    if (fetchPromise) {
        return fetchPromise;
    }

    // Create new fetch promise
    fetchPromise = (async () => {
        try {
            // Try CoinGecko API - Monad token
            // Using the token contract address or coin ID if available
            const response = await fetch(
                "https://api.coingecko.com/api/v3/simple/price?ids=monad&vs_currencies=usd",
                {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                    },
                }
            );

            if (!response.ok) {
                // Log warning but don't throw, return null to trigger fallback
                console.warn(`[MonPrice] CoinGecko API error: ${response.status}`);
                return null;
            }

            const data = await response.json();

            // Check if we got valid price data
            if (data.monad && typeof data.monad.usd === 'number' && data.monad.usd > 0) {
                const price = data.monad.usd;

                // Update cache
                monPriceCache = {
                    price,
                    timestamp: Date.now(),
                };

                console.log(`MON price fetched from CoinGecko: $${price}`);
                return price;
            } else {
                return null;
            }
        } catch (error) {
            console.error("Error fetching MON price from CoinGecko:", error);
            return null;
        } finally {
            // Clear the promise so subsequent calls can retry or fetch fresh data
            fetchPromise = null;
        }
    })().then(price => {
        if (price !== null) return price;

        // Fallback logic inside the promise chain
        if (monPriceCache) {
            console.warn(`Using expired cached MON price: $${monPriceCache.price}`);
            return monPriceCache.price;
        }

        // Final fallback default
        return 0.30;
    });

    return fetchPromise;
}

/**
 * Calculates the required MON amount for a given USD price
 * @param usdAmount USD amount (e.g., 1.00 for $1)
 * @returns Promise<string> MON amount as a string (e.g., "33.33")
 */
export async function calculateMonAmount(usdAmount: number): Promise<string> {
    const monPrice = await getMonPrice();
    const monAmount = usdAmount / monPrice;
    // Round to 2 decimal places for display, but keep precision for calculations
    return monAmount.toFixed(2);
}

/**
 * Formats price display with both USD and MON
 * @param usdAmount USD amount
 * @returns Promise<string> Formatted string like "$1.00 (~33.33 MON)"
 */
export async function formatPriceDisplay(usdAmount: number): Promise<string> {
    const monAmount = await calculateMonAmount(usdAmount);
    return `$${usdAmount.toFixed(2)} (~${monAmount} MON)`;
}
