import fs from 'fs';
import path from 'path';

export function updateFrontendAddresses(addresses: {
    ERC6551_REGISTRY?: string;
    ERC6551_IMPLEMENTATION?: string;
    KEEP_TOKEN?: string;
    KEEP_TOKEN_IMPL?: string;
    INVENTORY?: string;
    INVENTORY_IMPL?: string;
    ADVENTURER?: string;
    ADVENTURER_IMPL?: string;
    TAVERNKEEPER?: string;
    TAVERNKEEPER_IMPL?: string;
    THE_CELLAR?: string;
    THE_CELLAR_IMPL?: string;
    DUNGEON_GATEKEEPER?: string;
    DUNGEON_GATEKEEPER_IMPL?: string;
    CELLAR_ZAP?: string;
    CELLAR_ZAP_IMPL?: string;
    POOL_MANAGER?: string;
    TAVERN_REGULARS_MANAGER?: string;
    TOWN_POSSE_MANAGER?: string;
    CELLAR_TOKEN?: string;
}) {
    const addressesPath = path.join(__dirname, '../../../apps/web/lib/contracts/addresses.ts');

    if (!fs.existsSync(addressesPath)) {
        console.error(`Could not find addresses file at ${addressesPath}`);
        return;
    }

    let content = fs.readFileSync(addressesPath, 'utf8');
    const lines = content.split('\n');
    let inLocalhostSection = false;
    let inImplementationSection = false;
    let updatedCount = 0;

    // Map of keys to update in LOCALHOST_ADDRESSES
    const localhostUpdates: Record<string, string> = {
        'ERC6551_REGISTRY': addresses.ERC6551_REGISTRY || '',
        'ERC6551_IMPLEMENTATION': addresses.ERC6551_IMPLEMENTATION || '',
        'KEEP_TOKEN': addresses.KEEP_TOKEN || '',
        'INVENTORY': addresses.INVENTORY || '',
        'ADVENTURER': addresses.ADVENTURER || '',
        'TAVERNKEEPER': addresses.TAVERNKEEPER || '',
        'THE_CELLAR': addresses.THE_CELLAR || '',
        'DUNGEON_GATEKEEPER': addresses.DUNGEON_GATEKEEPER || '',
        'CELLAR_ZAP': addresses.CELLAR_ZAP || '',
        'POOL_MANAGER': addresses.POOL_MANAGER || '',
        'TAVERN_REGULARS_MANAGER': addresses.TAVERN_REGULARS_MANAGER || '',
        'TOWN_POSSE_MANAGER': addresses.TOWN_POSSE_MANAGER || '',
        'CELLAR_TOKEN': addresses.CELLAR_TOKEN || '',
    };

    // Map of keys to update in IMPLEMENTATION_ADDRESSES
    const implementationUpdates: Record<string, string> = {
        'KEEP_TOKEN': addresses.KEEP_TOKEN_IMPL || '',
        'INVENTORY': addresses.INVENTORY_IMPL || '',
        'ADVENTURER': addresses.ADVENTURER_IMPL || '',
        'TAVERNKEEPER': addresses.TAVERNKEEPER_IMPL || '',
        'THE_CELLAR': addresses.THE_CELLAR_IMPL || '',
        'CELLAR_ZAP': addresses.CELLAR_ZAP_IMPL || '',
        'DUNGEON_GATEKEEPER': addresses.DUNGEON_GATEKEEPER_IMPL || '',
    };

    // Process each line
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Track which section we're in
        if (line.includes('export const LOCALHOST_ADDRESSES')) {
            inLocalhostSection = true;
            inImplementationSection = false;
        } else if (line.includes('export const IMPLEMENTATION_ADDRESSES')) {
            inLocalhostSection = false;
            inImplementationSection = true;
        } else if (line.includes('const MONAD_ADDRESSES') || line.includes('export const CONTRACT_ADDRESSES')) {
            inLocalhostSection = false;
            inImplementationSection = false;
        }

        // Update addresses in LOCALHOST_ADDRESSES section
        if (inLocalhostSection) {
            for (const [key, newAddr] of Object.entries(localhostUpdates)) {
                if (newAddr && line.includes(`${key}:`)) {
                    // Match: KEY: '0x...' (anything) as Address
                    const addressMatch = line.match(/'0x[a-fA-F0-9]{40}'/);
                    if (addressMatch) {
                        const oldLine = lines[i];
                        lines[i] = line.replace(/'0x[a-fA-F0-9]{40}'/, `'${newAddr}'`);
                        if (lines[i] !== oldLine) {
                            console.log(`✓ Updated LOCALHOST_ADDRESSES.${key} to ${newAddr}`);
                            updatedCount++;
                        }
                        break; // Only update once per line
                    }
                }
            }

            // Special case: Update FEE_RECIPIENT if THE_CELLAR is updated
            if (addresses.THE_CELLAR && line.includes('FEE_RECIPIENT:') && line.includes('||')) {
                const addressMatch = line.match(/'0x[a-fA-F0-9]{40}'/);
                if (addressMatch && addressMatch[0] !== `'${addresses.THE_CELLAR}'`) {
                    // Update the fallback address in the FEE_RECIPIENT line
                    const newLine = line.replace(/'0x[a-fA-F0-9]{40}'/, `'${addresses.THE_CELLAR}'`);
                    if (newLine !== line) {
                        lines[i] = newLine;
                        console.log(`✓ Updated LOCALHOST_ADDRESSES.FEE_RECIPIENT fallback to ${addresses.THE_CELLAR}`);
                        updatedCount++;
                    }
                }
            }
        }

        // Update addresses in IMPLEMENTATION_ADDRESSES section
        if (inImplementationSection) {
            for (const [key, newAddr] of Object.entries(implementationUpdates)) {
                if (newAddr && line.includes(`${key}:`)) {
                    const addressMatch = line.match(/'0x[a-fA-F0-9]{40}'/);
                    if (addressMatch) {
                        const oldLine = lines[i];
                        lines[i] = line.replace(/'0x[a-fA-F0-9]{40}'/, `'${newAddr}'`);
                        if (lines[i] !== oldLine) {
                            console.log(`✓ Updated IMPLEMENTATION_ADDRESSES.${key} to ${newAddr}`);
                            updatedCount++;
                        }
                        break;
                    }
                }
            }
        }
    }

    // Write the file
    const newContent = lines.join('\n');
    if (newContent !== content) {
        fs.writeFileSync(addressesPath, newContent);
        console.log(`\n✅ Updated ${updatedCount} addresses in ${addressesPath}`);

        // Verify critical updates
        console.log('\n--- Verification ---');
        const verify = (key: string, expected: string, section: string) => {
            if (newContent.includes(`${key}: '${expected}'`)) {
                // Make sure it's in the right section
                const keyIndex = newContent.indexOf(`${key}: '${expected}'`);
                const sectionIndex = newContent.indexOf(section);
                if (keyIndex > sectionIndex && keyIndex < newContent.indexOf('export const CONTRACT_ADDRESSES', sectionIndex)) {
                    console.log(`  ✓ ${section}.${key} verified`);
                    return true;
                }
            }
            console.error(`  ✗ ${section}.${key} verification FAILED`);
            return false;
        };

        let allGood = true;
        if (addresses.KEEP_TOKEN) allGood = verify('KEEP_TOKEN', addresses.KEEP_TOKEN, 'LOCALHOST_ADDRESSES') && allGood;
        if (addresses.TAVERNKEEPER) allGood = verify('TAVERNKEEPER', addresses.TAVERNKEEPER, 'LOCALHOST_ADDRESSES') && allGood;
        if (addresses.KEEP_TOKEN_IMPL) allGood = verify('KEEP_TOKEN', addresses.KEEP_TOKEN_IMPL, 'IMPLEMENTATION_ADDRESSES') && allGood;
        if (addresses.TAVERNKEEPER_IMPL) allGood = verify('TAVERNKEEPER', addresses.TAVERNKEEPER_IMPL, 'IMPLEMENTATION_ADDRESSES') && allGood;

        if (!allGood) {
            console.error('\n⚠️  WARNING: Some verifications failed. Please check the addresses file manually.');
        }
    } else {
        console.log(`\n⚠️  No changes detected - addresses may already be up to date`);
    }
}
