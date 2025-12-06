# Architecture Refactoring Plan

## Current Problem

**DUPLICATED CODE:**
- `TheOffice.tsx` (279 lines) - Uses Privy
- `TheOfficeMiniapp.tsx` (385 lines) - Uses Wagmi/Farcaster
- Both have identical business logic, just different wallet providers
- Both render `TheOfficeView` (good - view is shared)

**PARALLEL ROUTES:**
- `(miniapp)/miniapp/page.tsx` - Separate miniapp page
- `(web)/party/page.tsx` - Separate web page
- `(web)/town-posse/page.tsx` - Separate web page
- All should work in both contexts

## Solution: Unified Architecture

### 1. Unified Wallet Hook
- ✅ `useSafeAccount` already exists and works in both contexts
- Need: Unified wallet client hook for transactions

### 2. Unified Office Component
- Merge `TheOffice.tsx` and `TheOfficeMiniapp.tsx` into ONE component
- Use `useSafeAccount` for wallet connection
- Use unified wallet client hook for transactions
- Works in both miniapp and web contexts

### 3. Unified Pages
- All pages should work in both contexts
- Use route groups only for layout differences (providers)
- Components should be context-agnostic

### 4. Provider Strategy
- Layout level: Choose provider based on context
- Component level: Use context-agnostic hooks
- No component should know if it's in miniapp or web

## Implementation Steps

1. Create unified wallet client hook
2. Merge TheOffice components
3. Update all pages to use unified components
4. Test in both contexts
5. Remove duplicate code

