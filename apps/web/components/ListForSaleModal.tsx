'use client';

import React, { useState } from 'react';
import { PixelBox, PixelButton } from './PixelComponents';
import { X, Loader2 } from 'lucide-react';

interface ListForSaleModalProps {
  assetType: 'item' | 'adventurer' | 'tavernkeeper';
  assetId: string;
  assetContract: string;
  assetName?: string;
  onClose: () => void;
  onListSuccess?: (listingId: string) => void;
}

export const ListForSaleModal: React.FC<ListForSaleModalProps> = ({
  assetType,
  assetId,
  assetContract,
  assetName,
  onClose,
  onListSuccess,
}) => {
  const [price, setPrice] = useState('');
  const [includesInventory, setIncludesInventory] = useState(false);
  const [isListing, setIsListing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleList = async () => {
    if (!price || parseFloat(price) <= 0) {
      setError('Please enter a valid price');
      return;
    }

    setIsListing(true);
    setError(null);

    try {
      // Convert price to wei (assuming 18 decimals for ERC-20)
      const priceWei = BigInt(Math.floor(parseFloat(price) * 1e18)).toString();

      // Get seller address from wallet (this would come from wagmi/connect)
      const sellerAddress = ''; // TODO: Get from connected wallet

      const response = await fetch('/api/marketplace/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetType,
          assetId,
          assetContract,
          priceErc20: priceWei,
          includesInventory,
          metadata: {
            name: assetName || `${assetType} #${assetId}`,
          },
          sellerAddress,
        }),
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        onListSuccess?.(data.listingId);
        onClose();
      }
    } catch (err) {
      setError('Failed to list item');
      console.error(err);
    } finally {
      setIsListing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
      <PixelBox className="w-full max-w-md" title="List for Sale" variant="paper">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-amber-950 hover:text-amber-900"
        >
          <X size={24} />
        </button>

        <div className="space-y-4 mt-4">
          <div>
            <label className="block text-sm font-semibold text-amber-950 mb-1">
              Asset
            </label>
            <p className="text-amber-800">
              {assetName || `${assetType} #${assetId}`}
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-amber-950 mb-1">
              Price (TKN)
            </label>
            <input
              type="number"
              step="0.0001"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full bg-amber-50 border-2 border-amber-800 px-3 py-2 text-amber-950"
              placeholder="0.0"
            />
          </div>

          {(assetType === 'adventurer' || assetType === 'tavernkeeper') && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="includesInventory"
                checked={includesInventory}
                onChange={(e) => setIncludesInventory(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="includesInventory" className="text-sm text-amber-950">
                Include inventory
              </label>
            </div>
          )}

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
              disabled={isListing}
            >
              Cancel
            </PixelButton>
            <PixelButton
              onClick={handleList}
              variant="success"
              className="flex-1"
              disabled={isListing || !price}
            >
              {isListing ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={16} />
                  Listing...
                </>
              ) : (
                'List for Sale'
              )}
            </PixelButton>
          </div>
        </div>
      </PixelBox>
    </div>
  );
};

