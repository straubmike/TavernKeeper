import { test, expect } from '@playwright/test';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { localhost } from 'viem/chains';

const PRIVATE_KEY_A = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // Account #0
const PRIVATE_KEY_B = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"; // Account #1

// Helper to inject wallet into a page
async function injectWallet(page: any, privateKey: `0x${string}`) {
    const account = privateKeyToAccount(privateKey);
    const client = createWalletClient({
        account,
        chain: localhost,
        transport: http('http://127.0.0.1:8545')
    });

    await page.addInitScript(({ pk, addr }) => {
        class MockProvider {
            isMetaMask = true;
            chainId = '0x7a69'; // 31337
            selectedAddress = addr;

            constructor() {
                this.selectedAddress = addr;
            }

            async request(args: { method: string, params?: any[] }) {
                // @ts-ignore
                return await window.handleEthereumRequest(args);
            }
            on() { }
            removeListener() { }
        }
        // @ts-ignore
        window.ethereum = new MockProvider();
    }, { pk: privateKey, addr: account.address });

    await page.exposeFunction('handleEthereumRequest', async (args: { method: string, params?: any[] }) => {
        const { method, params } = args;
        switch (method) {
            case 'eth_requestAccounts':
            case 'eth_accounts':
                return [account.address];
            case 'eth_chainId':
                return '0x7a69';
            case 'net_version':
                return '31337';
            case 'eth_sendTransaction':
                return await client.sendTransaction(params![0] as any);
            case 'personal_sign':
                return await client.signMessage({ message: { raw: params![0] } });
            default:
                return await client.request(args as any);
        }
    });
}

test.describe('Multi-User Blockchain Competition', () => {
    test('Alice and Bob compete for The Office', async ({ browser }) => {
        // 1. Setup Alice
        const contextA = await browser.newContext();
        const pageA = await contextA.newPage();
        await injectWallet(pageA, PRIVATE_KEY_A);

        // 2. Setup Bob
        const contextB = await browser.newContext();
        const pageB = await contextB.newPage();
        await injectWallet(pageB, PRIVATE_KEY_B);

        // Handle alerts
        pageA.on('dialog', async dialog => {
            console.log(`[Alice] Dialog: ${dialog.message()}`);
            await dialog.accept();
        });
        pageB.on('dialog', async dialog => {
            console.log(`[Bob] Dialog: ${dialog.message()}`);
            await dialog.accept();
        });

        // --- ALICE PREPARES (ZAP LP) ---
        await test.step('Alice connects and Zaps LP', async () => {
            await pageA.goto('/');

            // Connect
            const connectBtn = pageA.getByRole('button', { name: 'Connect Wallet' }).first();
            await expect(connectBtn).toBeVisible();
            await connectBtn.click();

            // Go to Cellar View
            await pageA.getByRole('button', { name: 'RAID CELLAR' }).click();

            // Mint LP (Zap)
            // Default amount is 1 MON.
            const mintLpBtn = pageA.getByRole('button', { name: 'MINT LP (1:10)' });
            await expect(mintLpBtn).toBeVisible();
            await mintLpBtn.click();

            // Verify LP Balance increased (Cellar Price shows LP balance? No, it shows price)
            // But we can check if "Cellar Price" is visible, meaning state loaded.
            await expect(pageA.getByText('Cellar Price')).toBeVisible();

            // Go back to Office
            await pageA.getByRole('button', { name: '← BACK TO OFFICE' }).click();
        });

        // --- ALICE TAKES OFFICE ---
        await test.step('Alice takes office', async () => {
            const takeOfficeBtn = pageA.getByRole('button', { name: 'Take The Office' });
            await expect(takeOfficeBtn).toBeVisible({ timeout: 10000 });
            await takeOfficeBtn.click();

            // Verify Alice is King (...2266)
            await expect(pageA.getByText('...2266')).toBeVisible({ timeout: 20000 });
        });

        // --- BOB TAKES OFFICE ---
        await test.step('Bob connects and takes office', async () => {
            await pageB.goto('/');

            // Connect
            const connectBtn = pageB.getByRole('button', { name: 'Connect Wallet' }).first();
            await expect(connectBtn).toBeVisible();
            await connectBtn.click();

            // Verify Alice is King
            await expect(pageB.getByText('...2266')).toBeVisible();

            // Bob Takes Office
            const takeOfficeBtn = pageB.getByRole('button', { name: 'Take The Office' });
            await takeOfficeBtn.click();

            // Verify Bob is King (...79C8)
            await expect(pageB.getByText('...79C8')).toBeVisible({ timeout: 20000 });
        });

        // --- ALICE RAIDS ---
        await test.step('Alice Raids the Cellar', async () => {
            // Check Pot increased (Bob paid Alice, Alice paid Fee)
            // Pot should be > 0.

            // Go to Cellar
            await pageA.getByRole('button', { name: 'RAID CELLAR' }).click();

            // Check Pot Size > 0
            // We expect some MON in pot (from fees)
            // The UI shows "Pot Size" -> Value
            // Let's just check that "POT EMPTY" button is NOT disabled/visible as disabled text
            // The button text changes to "RAID CELLAR 🔥" if pot > 0
            const raidBtn = pageA.getByRole('button', { name: 'RAID CELLAR 🔥' });
            await expect(raidBtn).toBeVisible({ timeout: 10000 });
            await expect(raidBtn).toBeEnabled();

            // Raid!
            await raidBtn.click();

            // Verify Pot Empty (Button changes to "POT EMPTY" or disabled)
            // Wait for update
            await expect(pageA.getByText('POT EMPTY')).toBeVisible({ timeout: 20000 });
        });
    });
});
