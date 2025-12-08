import { createPublicClient, formatEther, http, parseEther, type WalletClient } from 'viem';
import KeepTokenABI from '../abis/KeepToken.json';
import TavernRegularsManagerABI from '../abis/TavernRegularsManager.json';
import { monad } from '../chains';
import { LOCALHOST_ADDRESSES } from '../contracts/addresses';

// Use standard contract addresses or fallbacks
const TAVERN_REGULARS_ADDRESS = LOCALHOST_ADDRESSES.TAVERN_REGULARS_MANAGER as `0x${string}`;
const KEEP_TOKEN_ADDRESS = LOCALHOST_ADDRESSES.KEEP_TOKEN as `0x${string}`;

export interface TavernRegularsGroup {
    groupId: number;
    creator: string;
    members: string[];
    totalContribution: string;
    lpTokenBalance: string;
    groupName: string;
    active: boolean;
    myShare: string;
    myPendingFees: string;
}

export const tavernRegularsService = {
    getPublicClient() {
        const rpcUrl = process.env.NEXT_PUBLIC_MONAD_RPC_URL || monad.rpcUrls.default.http[0];

        return createPublicClient({
            chain: monad,
            transport: http(rpcUrl),
        });
    },

    async createGroup(client: WalletClient, groupName: string) {
        if (!client.account) throw new Error("Wallet not connected");

        return await client.writeContract({
            address: TAVERN_REGULARS_ADDRESS,
            abi: TavernRegularsManagerABI.abi,
            functionName: 'createTavernRegularsGroup',
            chain: monad,
            account: client.account,
            args: [groupName]
        });
    },

    async joinGroup(client: WalletClient, groupId: number) {
        if (!client.account) throw new Error("Wallet not connected");

        return await client.writeContract({
            address: TAVERN_REGULARS_ADDRESS,
            abi: TavernRegularsManagerABI.abi,
            functionName: 'joinTavernRegularsGroup',
            chain: monad,
            account: client.account,
            args: [BigInt(groupId)]
        });
    },

    async contribute(client: WalletClient, groupId: number, amountMON: string, amountKEEP: string) {
        if (!client.account) throw new Error("Wallet not connected");
        const userAddress = client.account.address;
        const publicClient = this.getPublicClient();

        // Check allowance
        const allowance = await publicClient.readContract({
            address: KEEP_TOKEN_ADDRESS,
            abi: KeepTokenABI.abi,
            functionName: 'allowance',
            args: [userAddress, TAVERN_REGULARS_ADDRESS]
        }) as bigint;

        const keepAmountWei = parseEther(amountKEEP);

        if (keepAmountWei > allowance) {
            console.log("Approving KEEP...");
            const approveHash = await client.writeContract({
                address: KEEP_TOKEN_ADDRESS,
                abi: KeepTokenABI.abi,
                functionName: 'approve',
                chain: monad,
                account: client.account,
                args: [TAVERN_REGULARS_ADDRESS, keepAmountWei]
            });
            await publicClient.waitForTransactionReceipt({ hash: approveHash });
            console.log("KEEP Approved");
        }

        // Contribute
        return await client.writeContract({
            address: TAVERN_REGULARS_ADDRESS,
            abi: TavernRegularsManagerABI.abi,
            functionName: 'contributeToTavernRegularsGroup',
            chain: monad,
            account: client.account,
            args: [BigInt(groupId), parseEther(amountMON), keepAmountWei],
            value: parseEther(amountMON)
        });
    },

    async withdraw(client: WalletClient, groupId: number, lpTokenAmount: string) {
        if (!client.account) throw new Error("Wallet not connected");

        return await client.writeContract({
            address: TAVERN_REGULARS_ADDRESS,
            abi: TavernRegularsManagerABI.abi,
            functionName: 'withdrawFromTavernRegularsGroup',
            chain: monad,
            account: client.account,
            args: [BigInt(groupId), parseEther(lpTokenAmount)]
        });
    },

    async claimFees(client: WalletClient, groupId: number) {
        if (!client.account) throw new Error("Wallet not connected");

        return await client.writeContract({
            address: TAVERN_REGULARS_ADDRESS,
            abi: TavernRegularsManagerABI.abi,
            functionName: 'claimTavernRegularsFees',
            chain: monad,
            account: client.account,
            args: [BigInt(groupId)]
        });
    },

    async getUserGroups(userAddress: string): Promise<TavernRegularsGroup[]> {
        const publicClient = this.getPublicClient();

        try {
            const groupIds = await publicClient.readContract({
                address: TAVERN_REGULARS_ADDRESS,
                abi: TavernRegularsManagerABI.abi,
                functionName: 'getUserGroups',
                args: [userAddress as `0x${string}`]
            }) as bigint[];

            const groups: TavernRegularsGroup[] = [];

            for (const id of groupIds) {
                // Parallelize fetching for each group could be better, but sequential for now to emulate original logic
                const [groupData, myShare, myPendingFees, members] = await Promise.all([
                    publicClient.readContract({
                        address: TAVERN_REGULARS_ADDRESS,
                        abi: TavernRegularsManagerABI.abi,
                        functionName: 'groups',
                        args: [id]
                    }) as Promise<any>,
                    publicClient.readContract({
                        address: TAVERN_REGULARS_ADDRESS,
                        abi: TavernRegularsManagerABI.abi,
                        functionName: 'getMemberShare',
                        args: [id, userAddress as `0x${string}`]
                    }) as Promise<bigint>,
                    publicClient.readContract({
                        address: TAVERN_REGULARS_ADDRESS,
                        abi: TavernRegularsManagerABI.abi,
                        functionName: 'getPendingFees',
                        args: [id, userAddress as `0x${string}`]
                    }) as Promise<bigint>,
                    publicClient.readContract({
                        address: TAVERN_REGULARS_ADDRESS,
                        abi: TavernRegularsManagerABI.abi,
                        functionName: 'getGroupMembers',
                        args: [id]
                    }) as Promise<string[]>
                ]);

                // groupData depends on struct return, usually an array or object in viem depending on ABI
                // Assuming standard tuple return for struct in array form if not mapped.
                // However, readContract with struct usually returns object if named in ABI or array.
                // Let's assume array-like access or object matching the struct based on JSON ABI.
                // Safest to log or cast. Based on ethers code: groupData.groupId etc.

                groups.push({
                    groupId: Number(groupData.groupId || groupData[0]),
                    creator: groupData.creator || groupData[1],
                    members: members,
                    totalContribution: formatEther(groupData.totalContribution || groupData[2]),
                    lpTokenBalance: formatEther(groupData.lpTokenBalance || groupData[3]),
                    groupName: groupData.groupName || groupData[4],
                    active: groupData.active || groupData[5],
                    myShare: formatEther(myShare),
                    myPendingFees: formatEther(myPendingFees)
                });
            }

            return groups;
        } catch (error) {
            console.error("Error fetching user groups:", error);
            return [];
        }
    }
};
