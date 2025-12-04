'use client';

import React, { useState } from 'react';
import { PixelBox, PixelButton } from './PixelComponents';
import type { MarketplaceListing } from '../lib/services/marketplace';
import { X, Loader2, CheckCircle } from 'lucide-react';

interface BuyItemModalProps {
  listing: MarketplaceListing;
  onClose: () => void;
  onBuySuccess?: (txHash: string) => void;
}

export const BuyItemModal: React.FC<BuyItemModalProps> = ({
  listing,
  onClose,
  onBuySuccess,
}) => {
  const [isBuying, setIsBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const formatPrice = (priceWei: string) => {
    const price = BigInt(priceWei);
    const eth = Number(price) / 1e18;
    return `${eth.toFixed(4)} TKN`;
  };

  const handleBuy = async () => {
    setIsBuying(true);
    setError(null);

    try {
      // Get buyer address from wallet (this would come from wagmi/connect)
      const buyerAddress = ''; // TODO: Get from connected wallet

      const response = await fetch('/api/marketplace/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: listing.id,
          buyerAddress,
        }),
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        setTxHash(data.txHash);
        setSuccess(true);
        onBuySuccess?.(data.txHash);
      }
    } catch (err) {
      setError('Failed to purchase item');
      console.error(err);
    } finally {
      setIsBuying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
      <PixelBox className="w-full max-w-md" title="Purchase Item" variant="paper">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-amber-950 hover:text-amber-900"
        >
          <X size={24} />
        </button>

        {success ? (
          <div className="space-y-4 mt-4 text-center">
            <CheckCircle className="mx-auto text-green-600" size={48} />
            <h3 className="text-lg font-bold text-amber-950">Purchase Successful!</h3>
            {txHash && (
              <p className="text-sm text-amber-800 break-all">
                TX: {txHash}
              </p>
            )}
            <PixelButton onClick={onClose} variant="success" className="w-full">
              Close
            </PixelButton>
          </div>
        ) : (
          <div className="space-y-4 mt-4">
            <div>
              <h3 className="font-bold text-amber-950 text-lg">
                {listing.metadata?.name ? String(listing.metadata.name) : `${listing.assetType} #${listing.assetId}`}
              </h3>
              <p className="text-sm text-amber-700 capitalize">{listing.assetType}</p>
              {listing.includesInventory && (
                <p className="text-xs text-amber-600 mt-1">Includes inventory</p>
              )}
            </div>

            <div className="border-t-2 border-amber-800 pt-3">
              <div className="flex justify-between items-center">
                <span className="text-amber-950 font-semibold">Price:</span>
                <span className="text-lg font-bold text-amber-950">
                  {formatPrice(listing.priceErc20)}
                </span>
              </div>
            </div>

            {error && (
              <div className="bg-red-100 border-2 border-red-600 p-3 rounded text-red-800 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <PixelButton
                onClick={onClose}
                variant="neutral"
                className="flex-1"
                disabled={isBuying}
              >
                Cancel
              </PixelButton>
              <PixelButton
                onClick={handleBuy}
                variant="success"
                className="flex-1"
                disabled={isBuying}
              >
                {isBuying ? (
                  <>
                    <Loader2 className="animate-spin mr-2" size={16} />
                    Purchasing...
                  </>
                ) : (
                  'Confirm Purchase'
                )}
              </PixelButton>
            </div>
          </div>
        )}
      </PixelBox>
    </div>
  );
};

