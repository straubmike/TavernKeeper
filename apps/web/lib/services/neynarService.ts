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
        const apiKey = process.env.NEYNAR_API_KEY;
        if (!apiKey || apiKey === 'DUMMY_KEY') {
            console.warn('NEYNAR_API_KEY not set, cannot fetch user by address');
            return null;
        }

        const normalizedAddress = address.toLowerCase();

        // Use direct API call (more reliable than SDK methods)
        // Try the bulk users endpoint first
        const response = await fetch(
            `https://api.neynar.com/v2/farcaster/user/bulk_by_address?addresses=${encodeURIComponent(normalizedAddress)}`,
            {
                headers: {
                    'api_key': apiKey,
                    'Content-Type': 'application/json',
                },
            }
        );

        if (!response.ok) {
            // If bulk endpoint fails, try alternative endpoint
            console.warn(`Bulk endpoint returned ${response.status}, trying alternative method`);

            // Try using SDK method as fallback (using correct method from docs)
            try {
                const client = getNeynarClient();
                const sdkResponse = await client.fetchBulkUsersByEthOrSolAddress({ addresses: [normalizedAddress] });

                // SDK response format: { result: { user: {...} } } or { result: { users: [...] } }
                if (sdkResponse?.result?.user) {
                    const user = sdkResponse.result.user;
                    return {
                        fid: user.fid,
                        username: user.username || undefined,
                        displayName: user.display_name || undefined,
                    };
                }

                // Alternative format: direct address key mapping
                const addressKey = Object.keys(sdkResponse).find(
                    key => key.toLowerCase() === normalizedAddress
                );

                if (addressKey && sdkResponse[addressKey] && Array.isArray(sdkResponse[addressKey]) && sdkResponse[addressKey].length > 0) {
                    const user = sdkResponse[addressKey][0];
                    return {
                        fid: user.fid,
                        username: user.username || undefined,
                        displayName: user.display_name || undefined,
                    };
                }
            } catch (sdkError) {
                console.warn('SDK fallback also failed:', sdkError);
            }

            return null;
        }

        const data = await response.json();

        // Handle different response formats
        if (data?.result?.users && Array.isArray(data.result.users) && data.result.users.length > 0) {
            const user = data.result.users[0];
            return {
                fid: user.fid,
                username: user.username || undefined,
                displayName: user.display_name || undefined,
            };
        }

        // Alternative format: direct address key
        if (data[normalizedAddress] && Array.isArray(data[normalizedAddress]) && data[normalizedAddress].length > 0) {
            const user = data[normalizedAddress][0];
            return {
                fid: user.fid,
                username: user.username || undefined,
                displayName: user.display_name || undefined,
            };
        }

        return null;
    } catch (error: any) {
        console.error('Error fetching user from Neynar:', error?.message || error);
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
        // Note: Empty targetFids array is valid - it means broadcast to all users with notifications enabled
        if (!Array.isArray(targetFids)) {
            console.error('❌ targetFids must be an array');
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

        const isBroadcast = targetFids.length === 0;
        console.log(`📤 Attempting to ${isBroadcast ? 'broadcast' : 'send'} notification:`, {
            targetFids: isBroadcast ? 'ALL USERS (broadcast)' : targetFids,
            title,
            bodyLength: body.length,
            targetUrl,
        });

        await client.publishFrameNotifications({
            targetFids, // Empty array = broadcast to all users with notifications enabled
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
 * @param embedUrls Array of URLs to embed (will be converted to embed objects)
 * @returns Promise<boolean> True if successful, false otherwise
 */
export async function postToFeed(text: string, embedUrls?: string[]): Promise<boolean> {
    try {
        const signerUuid = process.env.NEYNAR_SIGNER_UUID;
        if (!signerUuid) {
            console.error('❌ NEYNAR_SIGNER_UUID not found. Cannot post to feed.');
            console.error('   Set NEYNAR_SIGNER_UUID in your .env file to enable feed posting.');
            return false;
        }

        const client = getNeynarClient();
        const apiKey = process.env.NEYNAR_API_KEY;

        if (!apiKey || apiKey === 'DUMMY_KEY') {
            console.error('❌ NEYNAR_API_KEY is not set or is dummy. Cannot post to feed.');
            return false;
        }

        // Convert URL strings to embed objects
        const embeds = embedUrls?.map(url => ({ url })) || [];

        console.log('📝 Posting to feed:', {
            textLength: text.length,
            embedCount: embeds.length,
            signerUuid: signerUuid.substring(0, 8) + '...',
        });

        const response = await client.publishCast({
            signerUuid: signerUuid,
            text: text,
            embeds: embeds,
        });

        console.log('✅ Feed post published successfully');
        console.log('   Cast hash:', response?.hash || 'N/A');
        return true;
    } catch (error: any) {
        console.error('❌ Error posting to feed:');
        console.error('Error type:', error?.constructor?.name);
        console.error('Error message:', error?.message);

        if (error?.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', JSON.stringify(error.response.data, null, 2));
        } else if (error?.data) {
            console.error('Error data:', JSON.stringify(error.data, null, 2));
        }

        if (error?.stack) {
            console.error('Stack trace:', error.stack);
        }

        return false;
    }
}
