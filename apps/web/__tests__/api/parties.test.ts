import { GET, POST } from '@/app/api/parties/route';
import * as partyServiceModule from '@/lib/services/partyService';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/services/partyService');

describe('POST /api/parties', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a party successfully', async () => {
    const mockParty = {
      id: 'party-123',
      owner_id: 'user-123',
      dungeon_id: 'dungeon-456',
      created_at: new Date().toISOString(),
    };

    (partyServiceModule.createParty as any) = vi.fn().mockResolvedValue(mockParty);

    const request = new NextRequest('http://localhost/api/parties', {
      method: 'POST',
      body: JSON.stringify({
        ownerId: 'user-123',
        dungeonId: 'dungeon-456',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(mockParty);
    expect(partyServiceModule.createParty).toHaveBeenCalledWith('user-123', 'dungeon-456', undefined);
  });

  it('should return 400 if ownerId is missing', async () => {
    const request = new NextRequest('http://localhost/api/parties', {
      method: 'POST',
      body: JSON.stringify({
        dungeonId: 'dungeon-456',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Owner ID is required');
  });

  it('should return 500 if party creation fails', async () => {
    (partyServiceModule.createParty as any) = vi.fn().mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/parties', {
      method: 'POST',
      body: JSON.stringify({
        ownerId: 'user-123',
        dungeonId: 'dungeon-456',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('Failed to create party');
  });

  it('should handle errors gracefully', async () => {
    (partyServiceModule.createParty as any) = vi.fn().mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('http://localhost/api/parties', {
      method: 'POST',
      body: JSON.stringify({
        ownerId: 'user-123',
        dungeonId: 'dungeon-456',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('Internal server error');
  });
});

describe('GET /api/parties', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch user parties successfully', async () => {
    const mockParties = [
      {
        id: 'party-1',
        owner_id: 'user-123',
        dungeon_id: 'dungeon-456',
      },
      {
        id: 'party-2',
        owner_id: 'user-123',
        dungeon_id: 'dungeon-789',
      },
    ];

    (partyServiceModule.getUserParties as any) = vi.fn().mockResolvedValue(mockParties);

    const request = new NextRequest('http://localhost/api/parties?userId=user-123');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(mockParties);
    expect(partyServiceModule.getUserParties).toHaveBeenCalledWith('user-123');
  });

  it('should return 400 if userId is missing', async () => {
    const request = new NextRequest('http://localhost/api/parties');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('User ID is required');
  });

  it('should handle errors gracefully', async () => {
    (partyServiceModule.getUserParties as any) = vi.fn().mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('http://localhost/api/parties?userId=user-123');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('Internal server error');
  });
});
