import { ethers } from 'ethers';
import { LOCALHOST_ADDRESSES } from '../contracts/addresses';
import TavernRegularsManagerABI from '../abis/TavernRegularsManager.json';
import CellarHookABI from '../abis/CellarHook.json';
import KeepTokenABI from '../abis/KeepToken.json';

const TAVERN_REGULARS_ADDRESS = LOCALHOST_ADDRESSES.TAVERN_REGULARS_MANAGER;
const CELLAR_HOOK_ADDRESS = LOCALHOST_ADDRESSES.THE_CELLAR;
const KEEP_TOKEN_ADDRESS = LOCALHOST_ADDRESSES.KEEP_TOKEN;

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
    async getContract(signer: any) {
        return new ethers.Contract(TAVERN_REGULARS_ADDRESS, TavernRegularsManagerABI.abi, signer);
    },

    async getKeepToken(signer: any) {
        return new ethers.Contract(KEEP_TOKEN_ADDRESS, KeepTokenABI.abi, signer);
    },

    async createGroup(signer: any, groupName: string) {
        const contract = await this.getContract(signer);
        const tx = await contract.createTavernRegularsGroup(groupName);
        return await tx.wait();
    },

    async joinGroup(signer: any, groupId: number) {
        const contract = await this.getContract(signer);
        const tx = await contract.joinTavernRegularsGroup(groupId);
        return await tx.wait();
    },

    async contribute(signer: any, groupId: number, amountMON: string, amountKEEP: string) {
        const contract = await this.getContract(signer);
        const keepToken = await this.getKeepToken(signer);
        const userAddress = await signer.getAddress();

        // Approve KEEP
        const currentAllowance = await keepToken.allowance(userAddress, TAVERN_REGULARS_ADDRESS);
        if (ethers.parseEther(amountKEEP) > currentAllowance) {
            const approveTx = await keepToken.approve(TAVERN_REGULARS_ADDRESS, ethers.parseEther(amountKEEP));
            await approveTx.wait();
        }

        // Contribute (handling native MON)
        const tx = await contract.contributeToTavernRegularsGroup(
            groupId,
            ethers.parseEther(amountMON),
            ethers.parseEther(amountKEEP),
            { value: ethers.parseEther(amountMON) }
        );
        return await tx.wait();
    },

    async withdraw(signer: any, groupId: number, lpTokenAmount: string) {
        const contract = await this.getContract(signer);
        const tx = await contract.withdrawFromTavernRegularsGroup(groupId, ethers.parseEther(lpTokenAmount));
        return await tx.wait();
    },

    async claimFees(signer: any, groupId: number) {
        const contract = await this.getContract(signer);
        const tx = await contract.claimTavernRegularsFees(groupId);
        return await tx.wait();
    },

    async getUserGroups(signer: any): Promise<TavernRegularsGroup[]> {
        const contract = await this.getContract(signer);
        const userAddress = await signer.getAddress();
        const groupIds = await contract.getUserGroups(userAddress);

        const groups: TavernRegularsGroup[] = [];

        for (const id of groupIds) {
            const groupData = await contract.groups(id);
            const myShare = await contract.getMemberShare(id, userAddress);
            const myPendingFees = await contract.getPendingFees(id, userAddress);
            const members = await contract.getGroupMembers(id);

            groups.push({
                groupId: Number(groupData.groupId),
                creator: groupData.creator,
                members: members,
                totalContribution: ethers.formatEther(groupData.totalContribution),
                lpTokenBalance: ethers.formatEther(groupData.lpTokenBalance),
                groupName: groupData.groupName,
                active: groupData.active,
                myShare: ethers.formatEther(myShare),
                myPendingFees: ethers.formatEther(myPendingFees)
            });
        }

        return groups;
    }
};
