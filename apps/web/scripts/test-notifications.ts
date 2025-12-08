/**
 * Interactive Notification Test Script
 *
 * Tests Farcaster miniapp notifications using the Neynar API.
 * Allows you to send test notifications to specific FIDs.
 *
 * Usage: pnpm tsx apps/web/scripts/test-notifications.ts
 *    or: cd apps/web && pnpm tsx scripts/test-notifications.ts
 *    or: cd apps/web && pnpm test:notifications
 */

import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as readline from 'readline';

// Load environment variables from root .env file
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

function question(prompt: string): Promise<string> {
    return new Promise((resolve) => {
        rl.question(prompt, resolve);
    });
}

async function lookupUserByUsername(apiKey: string, username: string): Promise<{ fid: number; username?: string } | null> {
    try {
        const cleanUsername = username.replace(/^@/, '');

        // Use direct API call
        const response = await fetch(
            `https://api.neynar.com/v2/farcaster/user/by_username?username=${encodeURIComponent(cleanUsername)}`,
            {
                headers: {
                    'api_key': apiKey,
                    'Content-Type': 'application/json',
                },
            }
        );

        if (response.ok) {
            const data = await response.json();
            if (data?.result?.user) {
                return {
                    fid: data.result.user.fid,
                    username: data.result.user.username,
                };
            }
        }

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
                    return {
                        fid: retryData.result.user.fid,
                        username: retryData.result.user.username,
                    };
                }
            }
        }

        return null;
    } catch (error: any) {
        console.error('Lookup error:', error.message);
        return null;
    }
}

async function main() {
    console.log('🔔 Farcaster Notification & Feed Post Test Script\n');
    console.log('This script can:\n');
    console.log('  1. Send miniapp notifications to Farcaster users');
    console.log('  2. Post to your Farcaster feed (using NEYNAR_SIGNER_UUID)\n');

    // Check for API key
    const apiKey = process.env.NEYNAR_API_KEY;
    if (!apiKey) {
        console.error('❌ Error: NEYNAR_API_KEY not found in environment variables.');
        console.log('Please set NEYNAR_API_KEY in your .env file.');
        process.exit(1);
    }

    const signerUuid = process.env.NEYNAR_SIGNER_UUID;
    if (!signerUuid) {
        console.warn('⚠️  NEYNAR_SIGNER_UUID not found. Feed posting will not be available.');
        console.log('   Set NEYNAR_SIGNER_UUID in your .env file to enable feed posting.\n');
    } else {
        console.log(`✅ Found NEYNAR_SIGNER_UUID: ${signerUuid.substring(0, 8)}...`);
    }

    console.log(`✅ Using NEYNAR_API_KEY: ${apiKey.substring(0, 8)}...\n`);

    const client = new NeynarAPIClient({ apiKey });

    try {
        // Get target - can be FID or username
        const input = await question('Enter target FID or username (e.g., 12345 or @ionoi): ');
        if (!input.trim()) {
            console.error('❌ Input is required.');
            process.exit(1);
        }

        let targetFid: number;
        let targetUsername: string | undefined;

        // Check if it's a number (FID)
        const fidNumber = parseInt(input.trim(), 10);
        if (!isNaN(fidNumber)) {
            // It's a FID
            targetFid = fidNumber;
            console.log(`✅ Using FID: ${targetFid}\n`);
        } else {
            // Try to look it up as username
            console.log(`\n🔍 Looking up username: ${input.trim()}...`);
            const user = await lookupUserByUsername(apiKey, input.trim());
            if (!user || !user.fid) {
                console.error(`❌ Could not find user: ${input.trim()}`);
                console.log('\n💡 Tip: Try using your FID number instead. You can find it in your Farcaster profile.');
                console.log('   When someone logs in through Farcaster, we get their FID automatically.');
                process.exit(1);
            }
            targetFid = user.fid;
            targetUsername = user.username;
            console.log(`✅ Found user: @${targetUsername} (FID: ${targetFid})\n`);
        }

        // Ask what to do
        console.log('\n--- What would you like to do? ---');
        const actionInput = await question('Send (n)otification, (p)ost to feed, or (b)oth? [n/p/b]: ');
        const action = actionInput.trim().toLowerCase();

        if (!['n', 'p', 'b', 'notification', 'post', 'both'].includes(action)) {
            console.log('Invalid choice. Cancelled.');
            process.exit(0);
        }

        let sendNotification = action === 'n' || action === 'notification' || action === 'b' || action === 'both';
        let postToFeed = action === 'p' || action === 'post' || action === 'b' || action === 'both';

        if (postToFeed && !signerUuid) {
            console.error('\n❌ Cannot post to feed: NEYNAR_SIGNER_UUID not found.');
            if (sendNotification) {
                console.log('Will only send notification.\n');
                postToFeed = false;
            } else {
                process.exit(1);
            }
        }

        // Get message details
        console.log('\n--- Message Details ---');
        const previousUsernameInput = await question('Previous manager username (for @mention) [press Enter to skip]: ');
        const newUsernameInput = await question('New manager username (who took the office) [press Enter to skip]: ');

        let notificationBody: string;
        let feedPostBody: string;

        if (previousUsernameInput.trim() && newUsernameInput.trim()) {
            const prevClean = previousUsernameInput.trim().replace(/^@/, '');
            const newClean = newUsernameInput.trim().replace(/^@/, '');

            // Notification format (personal message with @mentions)
            notificationBody = `Hey @${prevClean}, @${newClean} stole your spot in the office! You received 0.001 MON as the previous manager.`;

            // Feed post format (public announcement)
            feedPostBody = `@${newClean} just took the Office from @${prevClean}. Take the office at tavernkeeper.xyz/miniapp`;
        } else {
            const customNotificationBody = await question('Notification message (or press Enter for default): ');
            if (customNotificationBody.trim()) {
                notificationBody = customNotificationBody.trim();
            } else {
                const targetName = targetUsername ? `@${targetUsername}` : 'someone';
                notificationBody = `Hey ${targetName}, someone just claimed the office from you! You received 0.001 MON as the previous manager.`;
            }

            const customFeedBody = await question('Feed post message (or press Enter for default): ');
            if (customFeedBody.trim()) {
                feedPostBody = customFeedBody.trim();
            } else {
                const newUser = newUsernameInput.trim() ? newUsernameInput.trim().replace(/^@/, '') : 'Someone';
                const prevUser = previousUsernameInput.trim() ? previousUsernameInput.trim().replace(/^@/, '') : 'the previous manager';
                feedPostBody = `@${newUser} just took the Office from @${prevUser}. Take the office at tavernkeeper.xyz/miniapp`;
            }
        }

        const urlInput = await question('Target URL [https://tavernkeeper.xyz/]: ');
        const targetUrl = urlInput.trim() || 'https://tavernkeeper.xyz/';

        console.log('\n--- Summary ---');
        if (sendNotification) {
            console.log('📱 Notification:');
            if (targetUsername) {
                console.log(`   Target: @${targetUsername} (FID: ${targetFid})`);
            } else {
                console.log(`   Target FID: ${targetFid}`);
            }
            console.log(`   Title: Office Taken`);
            console.log(`   Body: ${notificationBody}`);
        }
        if (postToFeed) {
            console.log('📝 Feed Post:');
            console.log(`   Will post as: ${signerUuid?.substring(0, 8)}...`);
            console.log(`   Message: ${feedPostBody}`);
        }
        console.log(`   URL: ${targetUrl}\n`);

        const confirm = await question('Continue? (yes/no): ');
        if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
            console.log('Cancelled.');
            process.exit(0);
        }

        let notificationSuccess = false;
        let feedPostSuccess = false;

        // Send notification
        if (sendNotification) {
            try {
                console.log('\n📱 Sending notification...');
                await client.publishFrameNotifications({
                    targetFids: [targetFid],
                    notification: {
                        title: 'Office Taken',
                        body: notificationBody,
                        target_url: targetUrl,
                    },
                });
                notificationSuccess = true;
                console.log('✅ Notification sent successfully!');
                if (targetUsername) {
                    console.log(`   Check the Farcaster miniapp for @${targetUsername} to see the notification.`);
                } else {
                    console.log(`   Check the Farcaster miniapp for FID ${targetFid} to see the notification.`);
                }
            } catch (error: any) {
                console.error('\n❌ Error sending notification:');
                if (error.response) {
                    console.error('Status:', error.response.status);
                    console.error('Data:', JSON.stringify(error.response.data, null, 2));
                } else {
                    console.error(error.message || error);
                }
            }
        }

        // Post to feed
        if (postToFeed && signerUuid) {
            try {
                console.log('\n📝 Posting to feed...');
                // Use the correct publishCast format - it expects an object with signerUuid and text
                await client.publishCast({
                    signerUuid: signerUuid,
                    text: feedPostBody,
                });
                feedPostSuccess = true;
                console.log('✅ Feed post published successfully!');
                console.log(`   Check your Farcaster feed to see the post.`);
            } catch (error: any) {
                console.error('\n❌ Error posting to feed:');
                if (error.response) {
                    console.error('Status:', error.response.status);
                    console.error('Data:', JSON.stringify(error.response.data, null, 2));
                } else {
                    console.error(error.message || error);
                }
            }
        }

        // Summary
        console.log('\n--- Summary ---');
        if (sendNotification) {
            console.log(`Notification: ${notificationSuccess ? '✅ Success' : '❌ Failed'}`);
        }
        if (postToFeed) {
            console.log(`Feed Post: ${feedPostSuccess ? '✅ Success' : '❌ Failed'}`);
        }

        if ((sendNotification && !notificationSuccess) || (postToFeed && !feedPostSuccess)) {
            process.exit(1);
        }

    } catch (error: any) {
        console.error('\n❌ Unexpected error:');
        console.error(error.message || error);
        process.exit(1);
    } finally {
        rl.close();
    }
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});

