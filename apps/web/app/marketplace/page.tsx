'use client';

import React, { useState } from 'react';
import { PixelBox, PixelButton } from '../../../components/PixelComponents';
import { MarketplaceListings } from '../../../components/MarketplaceListings';
import { ListForSaleModal } from '../../../components/ListForSaleModal';
import { BuyItemModal } from '../../../components/BuyItemModal';
import type { MarketplaceListing } from '../../../lib/services/marketplace';
import { ShoppingCart } from 'lucide-react';

export default function MarketplacePage() {
  const [showListModal, setShowListModal] = useState(false);
  const [selectedListing, setSelectedListing] = useState<MarketplaceListing | null>(null);

  const handleBuy = (listing: MarketplaceListing) => {
    setSelectedListing(listing);
  };

  const handleBuySuccess = (txHash: string) => {
    console.log('Purchase successful:', txHash);
    // Refresh listings or show success message
    setSelectedListing(null);
  };

  return (
    <main className="min-h-screen bg-slate-900 p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-pixel text-amber-500 drop-shadow-md mb-2">
              Marketplace
            </h1>
            <p className="text-slate-400">Buy and sell items, adventurers, and TavernKeepers</p>
          </div>
          <PixelButton
            onClick={() => setShowListModal(true)}
            variant="primary"
            className="flex items-center gap-2"
          >
            <ShoppingCart size={20} />
            List Item
          </PixelButton>
        </div>

        {/* Listings */}
        <MarketplaceListings onBuy={handleBuy} />

        {/* List Item Modal */}
        {showListModal && (
          <ListForSaleModal
            assetType="item" // TODO: Allow selection of asset type
            assetId=""
            assetContract=""
            onClose={() => setShowListModal(false)}
            onListSuccess={(listingId) => {
              console.log('Listed successfully:', listingId);
              setShowListModal(false);
            }}
          />
        )}

        {/* Buy Item Modal */}
        {selectedListing && (
          <BuyItemModal
            listing={selectedListing}
            onClose={() => setSelectedListing(null)}
            onBuySuccess={handleBuySuccess}
          />
        )}
      </div>
    </main>
  );
}

