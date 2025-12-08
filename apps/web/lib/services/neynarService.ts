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
        const apiKey = process.env.NEYNAR_API_KEY;

        // Check if API key is set
        if (!apiKey || apiKey === 'DUMMY_KEY') {
            console.error('❌ NEYNAR_API_KEY is not set or is dummy. Cannot send notifications.');
            return false;
        }

        // Validate inputs
        if (!targetFids || targetFids.length === 0) {
            console.warn('⚠️ No target FIDs provided for notification');
            return false;
        }

        if (!title || !body) {
            console.error('❌ Notification title and body are required');
            return false;
        }

        const notification = {
            title,
            body,
            ...(targetUrl && { target_url: targetUrl }),
        };

        console.log('📤 Attempting to send notification:', {
            targetFids,
            title,
            bodyLength: body.length,
            targetUrl,
        });

        await client.publishFrameNotifications({
            targetFids,
            notification: notification as any, // Cast to any to avoid strict type checking on optional fields
        });

        console.log('✅ Notification sent successfully to FIDs:', targetFids);
        return true;
    } catch (error: any) {
        console.error('❌ Error sending notification via Neynar:');
        console.error('Error type:', error?.constructor?.name);
        console.error('Error message:', error?.message);

        // Log detailed error information if available
        if (error?.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', JSON.stringify(error.response.data, null, 2));
        } else if (error?.data) {
            console.error('Error data:', JSON.stringify(error.data, null, 2));
        }

        // Log stack trace for debugging
        if (error?.stack) {
            console.error('Stack trace:', error.stack);
        }

        return false;
    }
}

/**
 * Post a cast to Farcaster feed using the UUID signer
 *
 * @param text The text content of the cast
 * @returns Promise<boolean> True if successful, false otherwise
 */
export async function postToFeed(text: string, embeds?: string[]): Promise<boolean> {
    try {
        const signerUuid = process.env.NEYNAR_SIGNER_UUID;
        if (!signerUuid) {
            console.warn('⚠️ NEYNAR_SIGNER_UUID not found. Cannot post to feed.');
            return false;
        }

        const client = getNeynarClient();

        await client.publishCast({
            signerUuid: signerUuid,
            text: text,
            embeds: embeds || [],
        });

        console.log('✅ Feed post published successfully');
        return true;
    } catch (error: any) {
        console.error('❌ Error posting to feed:', error);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.message || error);
        }
        return false;
    }
}
