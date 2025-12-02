# Monad Mainnet Configuration

## Network Details

- **Chain ID:** `143`
- **Network Name:** Monad Mainnet
- **Currency Symbol:** MON
- **Block Explorer:** [MonadVision](https://monadvision.com)

## RPC Endpoints

### Recommended (QuickNode)
```
https://rpc.monad.xyz
```
- Rate Limit: 25 requests per second
- Batch Call Limit: 100

### Alternative Options

**Alchemy:**
```
https://rpc1.monad.xyz
```
- Rate Limit: 15 requests per second
- Batch Call Limit: 100

**Ankr:**
```
https://rpc3.monad.xyz
```
- Rate Limit: 300 requests per 10 seconds
- Batch Call Limit: 10

**Monad Foundation:**
```
https://rpc-mainnet.monadinfra.com
```
- Rate Limit: 20 requests per second
- Batch Call Limit: 1

## Environment Variables

For production deployment, set:

```bash
NEXT_PUBLIC_MONAD_CHAIN_ID=143
NEXT_PUBLIC_MONAD_RPC_URL=https://rpc.monad.xyz
```

## Notes

- For higher rate limits, consider using a dedicated RPC provider (Alchemy, QuickNode, etc.)
- WebSocket endpoints available: `wss://rpc.monad.xyz`
- Historical state lookups supported on Monad Foundation endpoint
- `debug_*` and `trace_*` methods may be disabled on some endpoints
