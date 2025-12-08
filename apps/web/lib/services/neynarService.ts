/**
 * Neynar API Service
 *
 * Provides functions to interact with Neynar API for Farcaster user lookups
 * and sending notifications to mini app users.
 */

import { NeynarAPIClient } from '@neynar/nodejs-sdk';

let neynarClient: NeynarAPIClient | null = null;

/**
 * Get or create Neynar API client instance
 */
export function getNeynarClient(): NeynarAPIClient {
    if (!neynarClient) {
        const apiKey = process.env.NEYNAR_API_KEY;
        if (!apiKey) {
            console.warn('NEYNAR_API_KEY environment variable is not set. Using dummy key for build/dev.');
            neynarClient = new NeynarAPIClient({ apiKey: "DUMMY_KEY" });
        } else {
            neynarClient = new NeynarAPIClient({ apiKey });
        }
    }
    return neynarClient;
}

/**
 * Get Farcaster user information by wallet address
 * Returns FID, username, and displayName if found
 */
export async function getUserByAddress(address: string): Promise<{
    fid: number;
    username?: string;
    displayName?: string;
} | null> {
    try {
        const client = getNeynarClient();
        const normalizedAddress = address.toLowerCase();

        // Use fetchBulkUsersByEthOrSolAddress instead of fetchBulkUsersByEthereumAddress
        const response = await client.fetchBulkUsersByEthOrSolAddress({ addresses: [normalizedAddress] });

        // Find the address key (case-insensitive)
        const addressKey = Object.keys(response).find(
            key => key.toLowerCase() === normalizedAddress
        );

        if (!addressKey || !response[addressKey] || response[addressKey].length === 0) {
            return null;
        }

        const user = response[addressKey][0];
        return {
            fid: user.fid,
            username: user.username || undefined,
            displayName: user.display_name || undefined,
        };
    } catch (error) {
        console.error('Error fetching user from Neynar:', error);
        return null;
    }
}

/**
 * Get Farcaster user information by username
 * Returns FID, username, and displayName if found
 */
export async function getUserByUsername(username: string): Promise<{
    fid: number;
    username?: string;
    displayName?: string;
} | null> {
    try {
        const apiKey = process.env.NEYNAR_API_KEY;
        if (!apiKey) {
            console.error('NEYNAR_API_KEY not set');
            return null;
        }

        // Remove @ if present
        const cleanUsername = username.replace(/^@/, '');

        // Use direct API call (more reliable than SDK methods)
        const response = await fetch(
            `https://api.neynar.com/v2/farcaster/user/by_username?username=${encodeURIComponent(cleanUsername)}`,
            {
                headers: {
                    'api_key': apiKey,
                    'Content-Type': 'application/json',
                },
            }
        );

        if (!response.ok) {
            // Try without .eth suffix if it was present
            if (cleanUsername.endsWith('.eth')) {
                const usernameWithoutEth = cleanUsername.replace(/\.eth$/, '');
                const retryResponse = await fetch(
                    `https://api.neynar.com/v2/farcaster/user/by_username?username=${encodeURIComponent(usernameWithoutEth)}`,
                    {
                        headers: {
                            'api_key': apiKey,
                            'Content-Type': 'application/json',
                        },
                    }
                );
                if (retryResponse.ok) {
                    const retryData = await retryResponse.json();
                    if (retryData?.result?.user) {
                        const user = retryData.result.user;
                        return {
                            fid: user.fid,
                            username: user.username || undefined,
                            displayName: user.display_name || undefined,
                        };
                    }
                }
            }
            return null;
        }

        const data = await response.json();
        if (data?.result?.user) {
            const user = data.result.user;
            return {
                fid: user.fid,
                username: user.username || undefined,
                displayName: user.display_name || undefined,
            };
        }

        return null;
    } catch (error: any) {
        console.error('Error fetching user by username from Neynar:', error);
        return null;
    }
}

/**
 * Send notification to Farcaster mini app users
 *
 * @param targetFids Array of FIDs to send notification to (empty array = all users with notifications enabled)
 * @param title Notification title
 * @param body Notification body text
 * @param targetUrl Optional URL to open when notification is clicked
 */
export async function sendNotification(
    targetFids: number[],
    title: string,
    body: string,
    targetUrl?: string
): Promise<boolean> {
    try {
        const client = getNeynarClient();

        const notification = {
            title,
            body,
            ...(targetUrl && { target_url: targetUrl }),
        };

        await client.publishFrameNotifications({
            targetFids,
            notification: notification as any, // Cast to any to avoid strict type checking on optional fields
        });

        return true;
    } catch (error) {
        console.error('Error sending notification via Neynar:', error);
        return false;
    }
}
