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
