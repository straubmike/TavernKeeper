# Alchemy API Setup

To avoid hitting rate limits on the free RPC endpoints, we've configured the project to use Alchemy API when an API key is provided.

## Setup Instructions

1. **Get an Alchemy API Key:**
   - Go to [Alchemy.com](https://www.alchemy.com/)
   - Create an account or sign in
   - Create a new app for Monad Mainnet (or Testnet)
   - Copy your API key

2. **Add to Environment Variables:**

   Add one of these to your `.env` file:

   ```env
   # Option 1: Use NEXT_PUBLIC_ prefix (for frontend)
   NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_api_key_here

   # Option 2: Use ALCHEMY_API_KEY (for backend/scripts)
   ALCHEMY_API_KEY=your_alchemy_api_key_here

   # Or set both if you need it in both places
   ```

3. **Verify Configuration:**

   The system will automatically use Alchemy if an API key is detected. The RPC URL will be:
   - **Mainnet:** `https://monad-mainnet.g.alchemy.com/v2/YOUR_API_KEY`
   - **Testnet:** `https://monad-testnet.g.alchemy.com/v2/YOUR_API_KEY`

## Fallback Behavior

If no Alchemy API key is provided, the system will fall back to:
- **Mainnet:** `https://rpc.monad.xyz` (free, rate-limited)
- **Testnet:** `https://testnet-rpc.monad.xyz` (free, rate-limited)

## Override with Custom RPC

You can still override with a custom RPC URL by setting:
```env
NEXT_PUBLIC_MONAD_RPC_URL=https://your-custom-rpc-url.com
```

This takes precedence over Alchemy configuration.

## Notes

- Alchemy provides much higher rate limits than the free RPC endpoints
- The API key is safe to expose in frontend code (it's in `NEXT_PUBLIC_*` variables)
- Alchemy keys are scoped to specific networks and apps, so make sure you're using the correct key for Mainnet vs Testnet

