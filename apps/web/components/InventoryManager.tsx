'use client';

import React, { useState } from 'react';
import { PixelBox, PixelButton } from './PixelComponents';
import type { Item } from '@innkeeper/lib';
import { Package, ArrowRight, ShoppingCart } from 'lucide-react';

interface InventoryManagerProps {
  items: Item[];
  ownerType: 'adventurer' | 'tavernkeeper';
  ownerId: string;
  ownerContract: string;
  ownerTokenId: string;
  onUnequip?: (item: Item) => void;
  onEquip?: (item: Item) => void;
  onSell?: (item: Item) => void;
}

export const InventoryManager: React.FC<InventoryManagerProps> = ({
  items,
  ownerType,
  ownerId,
  ownerContract,
  ownerTokenId,
  onUnequip,
  onEquip,
  onSell,
}) => {
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  const handleUnequip = async (item: Item) => {
    if (!onUnequip) return;

    try {
      // Get TavernKeeper info (this would come from props or context)
      const tavernKeeperContract = process.env.NEXT_PUBLIC_TAVERNKEEPER_CONTRACT_ADDRESS || '';
      const tavernKeeperTokenId = '1'; // TODO: Get from user context

      const response = await fetch('/api/inventory/unequip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: (item.properties as any)?.tokenId,
          amount: (item.properties as any)?.balance || '1',
          adventurerContract: ownerContract,
          adventurerTokenId: ownerTokenId,
          tavernKeeperContract,
          tavernKeeperTokenId,
        }),
      });

      const data = await response.json();

      if (data.error) {
        alert(`Failed to unequip: ${data.error}`);
      } else {
        onUnequip(item);
        alert(`Item unequipped! TX: ${data.txHash}`);
      }
    } catch (error) {
      console.error('Error unequipping item:', error);
      alert('Failed to unequip item');
    }
  };

  if (items.length === 0) {
    return (
      <PixelBox variant="wood" title="Inventory" className="text-center py-8">
        <Package className="mx-auto mb-2 text-[#eaddcf]/50" size={48} />
        <p className="text-[#eaddcf]/70">No items in inventory</p>
      </PixelBox>
    );
  }

  return (
    <PixelBox variant="wood" title={`${ownerType === 'adventurer' ? 'Adventurer' : 'TavernKeeper'} Inventory`}>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="bg-[#4a3b32] border-2 border-[#2a1d17] p-3 rounded hover:border-[#eaddcf] transition-all cursor-pointer"
            onClick={() => setSelectedItem(item)}
          >
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-[#2a1d17] rounded flex items-center justify-center">
                <Package className="text-[#eaddcf]" size={24} />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-[#eaddcf] truncate w-full">{item.name}</p>
                <p className="text-xs text-[#eaddcf]/70 capitalize">{item.type}</p>
              </div>
              <div className="flex gap-1 mt-1">
                {ownerType === 'adventurer' && onUnequip && (
                  <PixelButton
                    size="sm"
                    variant="neutral"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUnequip(item);
                    }}
                    title="Unequip to TavernKeeper"
                  >
                    <ArrowRight size={12} />
                  </PixelButton>
                )}
                {ownerType === 'tavernkeeper' && onEquip && (
                  <PixelButton
                    size="sm"
                    variant="primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEquip(item);
                    }}
                    title="Equip to Adventurer"
                  >
                    <ArrowRight size={12} />
                  </PixelButton>
                )}
                {onSell && (
                  <PixelButton
                    size="sm"
                    variant="neutral"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSell(item);
                    }}
                    title="List for Sale"
                  >
                    <ShoppingCart size={12} />
                  </PixelButton>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Item Detail Modal */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={() => setSelectedItem(null)}
        >
          <PixelBox
            variant="paper"
            className="max-w-md"
            onClick={(e) => e?.stopPropagation()}
            title={selectedItem.name}
          >
            <div className="space-y-2">
              <p className="text-amber-950">
                <strong>Type:</strong> {selectedItem.type}
              </p>
              {selectedItem.properties && (
                <div className="text-sm text-amber-800">
                  <p>Token ID: {(selectedItem.properties as any).tokenId}</p>
                  {(selectedItem.properties as any).balance && (
                    <p>Balance: {(selectedItem.properties as any).balance}</p>
                  )}
                </div>
              )}
              <PixelButton onClick={() => setSelectedItem(null)} variant="neutral" className="w-full">
                Close
              </PixelButton>
            </div>
          </PixelBox>
        </div>
      )}
    </PixelBox>
  );
};

