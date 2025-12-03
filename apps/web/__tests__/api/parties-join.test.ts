import { POST } from '@/app/api/parties/[id]/join/route';
import * as registryModule from '@/lib/contracts/registry';
import * as heroOwnershipModule from '@/lib/services/heroOwnership';
import * as partyServiceModule from '@/lib/services/partyService';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/services/partyService');
vi.mock('@/lib/services/heroOwnership');
vi.mock('@/lib/contracts/registry');

describe('POST /api/parties/[id]/join', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should join party successfully', async () => {
    (heroOwnershipModule.verifyOwnership as any) = vi.fn().mockResolvedValue(true);
    (partyServiceModule.joinParty as any) = vi.fn().mockResolvedValue({ success: true });
    (registryModule.getContractAddress as any) = vi.fn().mockReturnValue('0xcontract123');

    const request = new NextRequest('http://localhost/api/parties/party-123/join', {
      method: 'POST',
      body: JSON.stringify({
        userId: 'user-123',
        heroTokenId: '456',
        heroContract: '0xcontract123',
        userWallet: '0xwallet123',
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'party-123' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(heroOwnershipModule.verifyOwnership).toHaveBeenCalledWith('456', '0xcontract123', '0xwallet123');
    expect(partyServiceModule.joinParty).toHaveBeenCalledWith('party-123', 'user-123', '456', '0xcontract123');
  });

  it('should return 400 if required fields are missing', async () => {
    const request = new NextRequest('http://localhost/api/parties/party-123/join', {
      method: 'POST',
      body: JSON.stringify({
        userId: 'user-123',
        // Missing other required fields
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'party-123' }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Missing required fields');
  });

  it('should return 403 if user does not own hero', async () => {
    (heroOwnershipModule.verifyOwnership as any) = vi.fn().mockResolvedValue(false);
    (registryModule.getContractAddress as any) = vi.fn().mockReturnValue('0xcontract123');

    const request = new NextRequest('http://localhost/api/parties/party-123/join', {
      method: 'POST',
      body: JSON.stringify({
        userId: 'user-123',
        heroTokenId: '456',
        heroContract: '0xcontract123',
        userWallet: '0xwallet123',
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'party-123' }) });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain('does not own this hero');
    expect(partyServiceModule.joinParty).not.toHaveBeenCalled();
  });

  it('should return 400 if party is full or not found', async () => {
    (heroOwnershipModule.verifyOwnership as any) = vi.fn().mockResolvedValue(true);
    (partyServiceModule.joinParty as any) = vi.fn().mockResolvedValue({ success: false });
    (registryModule.getContractAddress as any) = vi.fn().mockReturnValue('0xcontract123');

    const request = new NextRequest('http://localhost/api/parties/party-123/join', {
      method: 'POST',
      body: JSON.stringify({
        userId: 'user-123',
        heroTokenId: '456',
        heroContract: '0xcontract123',
        userWallet: '0xwallet123',
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'party-123' }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Failed to join party');
  });

  it('should handle errors gracefully', async () => {
    (heroOwnershipModule.verifyOwnership as any) = vi.fn().mockRejectedValue(new Error('Network error'));
    (registryModule.getContractAddress as any) = vi.fn().mockReturnValue('0xcontract123');

    const request = new NextRequest('http://localhost/api/parties/party-123/join', {
      method: 'POST',
      body: JSON.stringify({
        userId: 'user-123',
        heroTokenId: '456',
        heroContract: '0xcontract123',
        userWallet: '0xwallet123',
      }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: 'party-123' }) });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('Internal server error');
  });
});
