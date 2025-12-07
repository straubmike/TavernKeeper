import { createPublicClient, formatEther, http, parseEther, parseAbi, type WalletClient } from 'viem';
import { monad } from '../chains';
import { LOCALHOST_ADDRESSES } from '../contracts/addresses';
import TownPosseManagerABI from '../abis/TownPosseManager.json';
import KeepTokenABI from '../abis/KeepToken.json';

const TOWN_POSSE_ADDRESS = LOCALHOST_ADDRESSES.TOWN_POSSE_MANAGER as `0x${string}`;
const KEEP_TOKEN_ADDRESS = LOCALHOST_ADDRESSES.KEEP_TOKEN as `0x${string}`;

export interface TownPosseGroup {
    posseId: number;
    creator: string;
    members: string[];
    maxMembers: number;
    minContribution: string;
    totalContribution: string;
    lpTokenBalance: string;
    openMembership: boolean;
    posseName: string;
    active: boolean;
    myTier: number; // 1=Bronze, 2=Silver, 3=Gold
    myShare: string;
    myPendingFees: string;
}

export interface Proposal {
    proposalId: number;
    proposer: string;
    description: string;
    votesFor: number;
    votesAgainst: number;
    deadline: number;
    executed: boolean;
}

export const townPosseService = {
    getPublicClient() {
        const rpcUrl = process.env.NEXT_PUBLIC_MONAD_RPC_URL ||
            (monad.id === 143 ? 'https://rpc.monad.xyz' : 'https://testnet-rpc.monad.xyz');

        return createPublicClient({
            chain: monad,
            transport: http(rpcUrl),
        });
    },

    async createPosse(
        client: WalletClient,
        name: string,
        maxMembers: number,
        openMembership: boolean,
        minContribution: string
    ) {
        if (!client.account) throw new Error("Wallet not connected");

        return await client.writeContract({
            address: TOWN_POSSE_ADDRESS,
            abi: TownPosseManagerABI.abi,
            functionName: 'createTownPosse',
            chain: monad,
            account: client.account,
            args: [
                name,
                BigInt(maxMembers),
                openMembership,
                parseEther(minContribution)
            ]
        });
    },

    async joinPosse(client: WalletClient, posseId: number) {
        if (!client.account) throw new Error("Wallet not connected");

        return await client.writeContract({
            address: TOWN_POSSE_ADDRESS,
            abi: TownPosseManagerABI.abi,
            functionName: 'requestJoinTownPosse',
            chain: monad,
            account: client.account,
            args: [BigInt(posseId)]
        });
    },

    async approveMember(client: WalletClient, posseId: number, member: string) {
        if (!client.account) throw new Error("Wallet not connected");

        return await client.writeContract({
            address: TOWN_POSSE_ADDRESS,
            abi: TownPosseManagerABI.abi,
            functionName: 'approveTownPosseMember',
            chain: monad,
            account: client.account,
            args: [BigInt(posseId), member as `0x${string}`]
        });
    },

    async contribute(client: WalletClient, posseId: number, amountMON: string, amountKEEP: string) {
        if (!client.account) throw new Error("Wallet not connected");
        const userAddress = client.account.address;
        const publicClient = this.getPublicClient();

        // Approve KEEP
        const allowance = await publicClient.readContract({
            address: KEEP_TOKEN_ADDRESS,
            abi: KeepTokenABI.abi,
            functionName: 'allowance',
            args: [userAddress, TOWN_POSSE_ADDRESS]
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
                args: [TOWN_POSSE_ADDRESS, keepAmountWei]
            });
            await publicClient.waitForTransactionReceipt({ hash: approveHash });
        }

        // Contribute (handling native MON)
        return await client.writeContract({
            address: TOWN_POSSE_ADDRESS,
            abi: TownPosseManagerABI.abi,
            functionName: 'contributeToTownPosse',
            chain: monad,
            account: client.account,
            args: [BigInt(posseId), parseEther(amountMON), keepAmountWei],
            value: parseEther(amountMON)
        });
    },

    async withdraw(client: WalletClient, posseId: number, lpTokenAmount: string) {
        if (!client.account) throw new Error("Wallet not connected");

        return await client.writeContract({
            address: TOWN_POSSE_ADDRESS,
            abi: TownPosseManagerABI.abi,
            functionName: 'withdrawFromTownPosse',
            chain: monad,
            account: client.account,
            args: [BigInt(posseId), parseEther(lpTokenAmount)]
        });
    },

    async claimFees(client: WalletClient, posseId: number) {
        if (!client.account) throw new Error("Wallet not connected");

        return await client.writeContract({
            address: TOWN_POSSE_ADDRESS,
            abi: TownPosseManagerABI.abi,
            functionName: 'claimTownPosseFees',
            chain: monad,
            account: client.account,
            args: [BigInt(posseId)]
        });
    },

    // Governance
    async createProposal(client: WalletClient, posseId: number, description: string, data: string = "0x") {
        if (!client.account) throw new Error("Wallet not connected");

        return await client.writeContract({
            address: TOWN_POSSE_ADDRESS,
            abi: TownPosseManagerABI.abi,
            functionName: 'createTownPosseProposal',
            chain: monad,
            account: client.account,
            args: [BigInt(posseId), description, data as `0x${string}`]
        });
    },

    async vote(client: WalletClient, posseId: number, proposalId: number, support: boolean) {
        if (!client.account) throw new Error("Wallet not connected");

        return await client.writeContract({
            address: TOWN_POSSE_ADDRESS,
            abi: TownPosseManagerABI.abi,
            functionName: 'voteOnTownPosseProposal',
            chain: monad,
            account: client.account,
            args: [BigInt(posseId), BigInt(proposalId), support]
        });
    },

    async executeProposal(client: WalletClient, posseId: number, proposalId: number) {
        if (!client.account) throw new Error("Wallet not connected");

        return await client.writeContract({
            address: TOWN_POSSE_ADDRESS,
            abi: TownPosseManagerABI.abi,
            functionName: 'executeTownPosseProposal',
            chain: monad,
            account: client.account,
            args: [BigInt(posseId), BigInt(proposalId)]
        });
    },

    async getUserPosses(userAddress: string): Promise<TownPosseGroup[]> {
        const publicClient = this.getPublicClient();

        try {
            const posseIds = await publicClient.readContract({
                address: TOWN_POSSE_ADDRESS,
                abi: TownPosseManagerABI.abi,
                functionName: 'getUserPosses',
                args: [userAddress as `0x${string}`]
            }) as bigint[];

            const posses: TownPosseGroup[] = [];

            for (const id of posseIds) {
                const [posseData, myTier, myShare, myPendingFees, members] = await Promise.all([
                    publicClient.readContract({
                        address: TOWN_POSSE_ADDRESS,
                        abi: TownPosseManagerABI.abi,
                        functionName: 'posses',
                        args: [id]
                    }) as Promise<any>,
                    publicClient.readContract({
                        address: TOWN_POSSE_ADDRESS,
                        abi: TownPosseManagerABI.abi,
                        functionName: 'getMemberTier',
                        args: [id, userAddress as `0x${string}`]
                    }) as Promise<number>,
                    publicClient.readContract({
                        address: TOWN_POSSE_ADDRESS,
                        abi: TownPosseManagerABI.abi,
                        functionName: 'getMemberShare',
                        args: [id, userAddress as `0x${string}`]
                    }) as Promise<bigint>,
                    publicClient.readContract({
                        address: TOWN_POSSE_ADDRESS,
                        abi: TownPosseManagerABI.abi,
                        functionName: 'getPendingFees',
                        args: [id, userAddress as `0x${string}`]
                    }) as Promise<bigint>,
                    publicClient.readContract({
                        address: TOWN_POSSE_ADDRESS,
                        abi: TownPosseManagerABI.abi,
                        functionName: 'getPosseMembers',
                        args: [id]
                    }) as Promise<string[]>
                ]);

                // Assuming posseData follows the structure or array return
                posses.push({
                    posseId: Number(posseData.posseId || posseData[0]),
                    creator: posseData.creator || posseData[1],
                    members: members,
                    maxMembers: Number(posseData.maxMembers || posseData[2]),
                    minContribution: formatEther(posseData.minContribution || posseData[3]),
                    totalContribution: formatEther(posseData.totalContribution || posseData[4]),
                    lpTokenBalance: formatEther(posseData.lpTokenBalance || posseData[5]),
                    openMembership: posseData.openMembership || posseData[6],
                    posseName: posseData.posseName || posseData[7],
                    active: posseData.active || posseData[8],
                    myTier: Number(myTier),
                    myShare: formatEther(myShare),
                    myPendingFees: formatEther(myPendingFees)
                });
            }

            return posses;
        } catch (error) {
            console.error("Error fetching user posses:", error);
            return [];
        }
    }
};
