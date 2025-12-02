import { ethers } from 'ethers';
import { LOCALHOST_ADDRESSES } from '../contracts/addresses';
import TownPosseManagerABI from '../abis/TownPosseManager.json';
import KeepTokenABI from '../abis/KeepToken.json';

const TOWN_POSSE_ADDRESS = LOCALHOST_ADDRESSES.TOWN_POSSE_MANAGER;
const KEEP_TOKEN_ADDRESS = LOCALHOST_ADDRESSES.KEEP_TOKEN;

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
    async getContract(signer: any) {
        return new ethers.Contract(TOWN_POSSE_ADDRESS, TownPosseManagerABI.abi, signer);
    },

    async getKeepToken(signer: any) {
        return new ethers.Contract(KEEP_TOKEN_ADDRESS, KeepTokenABI.abi, signer);
    },

    async createPosse(
        signer: any,
        name: string,
        maxMembers: number,
        openMembership: boolean,
        minContribution: string
    ) {
        const contract = await this.getContract(signer);
        const tx = await contract.createTownPosse(
            name,
            maxMembers,
            openMembership,
            ethers.parseEther(minContribution)
        );
        return await tx.wait();
    },

    async joinPosse(signer: any, posseId: number) {
        const contract = await this.getContract(signer);
        const tx = await contract.requestJoinTownPosse(posseId);
        return await tx.wait();
    },

    async approveMember(signer: any, posseId: number, member: string) {
        const contract = await this.getContract(signer);
        const tx = await contract.approveTownPosseMember(posseId, member);
        return await tx.wait();
    },

    async contribute(signer: any, posseId: number, amountMON: string, amountKEEP: string) {
        const contract = await this.getContract(signer);
        const keepToken = await this.getKeepToken(signer);
        const userAddress = await signer.getAddress();

        // Approve KEEP
        const currentAllowance = await keepToken.allowance(userAddress, TOWN_POSSE_ADDRESS);
        if (ethers.parseEther(amountKEEP) > currentAllowance) {
            const approveTx = await keepToken.approve(TOWN_POSSE_ADDRESS, ethers.parseEther(amountKEEP));
            await approveTx.wait();
        }

        // Contribute (handling native MON)
        const tx = await contract.contributeToTownPosse(
            posseId,
            ethers.parseEther(amountMON),
            ethers.parseEther(amountKEEP),
            { value: ethers.parseEther(amountMON) }
        );
        return await tx.wait();
    },

    async withdraw(signer: any, posseId: number, lpTokenAmount: string) {
        const contract = await this.getContract(signer);
        const tx = await contract.withdrawFromTownPosse(posseId, ethers.parseEther(lpTokenAmount));
        return await tx.wait();
    },

    async claimFees(signer: any, posseId: number) {
        const contract = await this.getContract(signer);
        const tx = await contract.claimTownPosseFees(posseId);
        return await tx.wait();
    },

    // Governance
    async createProposal(signer: any, posseId: number, description: string, data: string = "0x") {
        const contract = await this.getContract(signer);
        const tx = await contract.createTownPosseProposal(posseId, description, data);
        return await tx.wait();
    },

    async vote(signer: any, posseId: number, proposalId: number, support: boolean) {
        const contract = await this.getContract(signer);
        const tx = await contract.voteOnTownPosseProposal(posseId, proposalId, support);
        return await tx.wait();
    },

    async executeProposal(signer: any, posseId: number, proposalId: number) {
        const contract = await this.getContract(signer);
        const tx = await contract.executeTownPosseProposal(posseId, proposalId);
        return await tx.wait();
    },

    async getUserPosses(signer: any): Promise<TownPosseGroup[]> {
        const contract = await this.getContract(signer);
        const userAddress = await signer.getAddress();
        const posseIds = await contract.getUserPosses(userAddress);

        const posses: TownPosseGroup[] = [];

        for (const id of posseIds) {
            const posseData = await contract.posses(id);
            const myTier = await contract.getMemberTier(id, userAddress);
            const myShare = await contract.getMemberShare(id, userAddress);
            const myPendingFees = await contract.getPendingFees(id, userAddress);
            const members = await contract.getPosseMembers(id);

            posses.push({
                posseId: Number(posseData.posseId),
                creator: posseData.creator,
                members: members,
                maxMembers: Number(posseData.maxMembers),
                minContribution: ethers.formatEther(posseData.minContribution),
                totalContribution: ethers.formatEther(posseData.totalContribution),
                lpTokenBalance: ethers.formatEther(posseData.lpTokenBalance),
                openMembership: posseData.openMembership,
                posseName: posseData.posseName,
                active: posseData.active,
                myTier: Number(myTier),
                myShare: ethers.formatEther(myShare),
                myPendingFees: ethers.formatEther(myPendingFees)
            });
        }

        return posses;
    }
};
