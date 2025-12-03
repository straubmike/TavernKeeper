import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { CellarHook, KeepToken, PoolManager } from "../typechain-types";

describe("CellarHook LP Minting Ratio Validation", function () {
    let deployer: SignerWithAddress;
    let user1: SignerWithAddress;
    let poolManager: PoolManager;
    let keepToken: KeepToken;
    let cellarHook: CellarHook;

    const INIT_PRICE = ethers.parseEther("100");
    const EPOCH_PERIOD = 3600;
    const PRICE_MULTIPLIER = ethers.parseEther("1.1");
    const MIN_INIT_PRICE = ethers.parseEther("1");

    before(async function () {
        [deployer, user1] = await ethers.getSigners();

        // Deploy PoolManager
        const PoolManagerFactory = await ethers.getContractFactory("PoolManager");
        poolManager = await PoolManagerFactory.deploy(deployer.address);
        await poolManager.waitForDeployment();

        // Deploy KeepToken
        const KeepTokenFactory = await ethers.getContractFactory("KeepToken");
        keepToken = await upgrades.deployProxy(
            KeepTokenFactory,
            [deployer.address, deployer.address],
            { kind: 'uups' }
        ) as unknown as KeepToken;
        await keepToken.waitForDeployment();

        // Deploy CellarHook
        const CellarHookFactory = await ethers.getContractFactory("CellarHook");
        const MON = ethers.ZeroAddress;
        const KEEP = await keepToken.getAddress();

        cellarHook = await upgrades.deployProxy(
            CellarHookFactory,
            [
                await poolManager.getAddress(),
                MON,
                KEEP,
                INIT_PRICE,
                EPOCH_PERIOD,
                PRICE_MULTIPLIER,
                MIN_INIT_PRICE,
                deployer.address
            ],
            { kind: 'uups', initializer: 'initialize' }
        ) as unknown as CellarHook;
        await cellarHook.waitForDeployment();
    });

    describe("addLiquidity Ratio Validation", function () {
        it("Should accept valid 1:3 MON:KEEP ratio", async function () {
            const amountMON = ethers.parseEther("1");
            const amountKEEP = ethers.parseEther("3"); // 3x MON

            // Mint KEEP tokens to user
            await keepToken.mint(user1.address, amountKEEP);
            await keepToken.connect(user1).approve(await cellarHook.getAddress(), amountKEEP);

            // Create dummy PoolKey
            const dummyKey = {
                currency0: { id: 0n, isNative: true },
                currency1: { id: 0n, isNative: false },
                fee: 3000,
                tickSpacing: 60,
                hooks: "0x0000000000000000000000000000000000000000"
            };

            // Should succeed with correct ratio
            await expect(
                cellarHook.connect(user1).addLiquidity(
                    dummyKey,
                    amountMON,
                    amountKEEP,
                    0,
                    0,
                    { value: amountMON }
                )
            ).to.not.be.reverted;

            // Verify LP tokens were minted (1 LP per 1 MON)
            const lpBalance = await cellarHook.balanceOf(user1.address);
            expect(lpBalance).to.equal(amountMON);
        });

        it("Should reject invalid ratio (1:1 instead of 1:3)", async function () {
            const amountMON = ethers.parseEther("1");
            const amountKEEP = ethers.parseEther("1"); // Wrong ratio - should be 3

            // Mint KEEP tokens to user
            await keepToken.mint(user1.address, amountKEEP);
            await keepToken.connect(user1).approve(await cellarHook.getAddress(), amountKEEP);

            // Create dummy PoolKey
            const dummyKey = {
                currency0: { id: 0n, isNative: true },
                currency1: { id: 0n, isNative: false },
                fee: 3000,
                tickSpacing: 60,
                hooks: "0x0000000000000000000000000000000000000000"
            };

            // Should revert with ratio error
            await expect(
                cellarHook.connect(user1).addLiquidity(
                    dummyKey,
                    amountMON,
                    amountKEEP,
                    0,
                    0,
                    { value: amountMON }
                )
            ).to.be.revertedWith("CellarHook: Invalid MON:KEEP ratio (must be 1:3)");
        });

        it("Should reject invalid ratio (1:2 instead of 1:3)", async function () {
            const amountMON = ethers.parseEther("1");
            const amountKEEP = ethers.parseEther("2"); // Wrong ratio - should be 3

            // Mint KEEP tokens to user
            await keepToken.mint(user1.address, amountKEEP);
            await keepToken.connect(user1).approve(await cellarHook.getAddress(), amountKEEP);

            // Create dummy PoolKey
            const dummyKey = {
                currency0: { id: 0n, isNative: true },
                currency1: { id: 0n, isNative: false },
                fee: 3000,
                tickSpacing: 60,
                hooks: "0x0000000000000000000000000000000000000000"
            };

            // Should revert with ratio error
            await expect(
                cellarHook.connect(user1).addLiquidity(
                    dummyKey,
                    amountMON,
                    amountKEEP,
                    0,
                    0,
                    { value: amountMON }
                )
            ).to.be.revertedWith("CellarHook: Invalid MON:KEEP ratio (must be 1:3)");
        });

        it("Should reject invalid ratio (1:4 instead of 1:3)", async function () {
            const amountMON = ethers.parseEther("1");
            const amountKEEP = ethers.parseEther("4"); // Wrong ratio - should be 3

            // Mint KEEP tokens to user
            await keepToken.mint(user1.address, amountKEEP);
            await keepToken.connect(user1).approve(await cellarHook.getAddress(), amountKEEP);

            // Create dummy PoolKey
            const dummyKey = {
                currency0: { id: 0n, isNative: true },
                currency1: { id: 0n, isNative: false },
                fee: 3000,
                tickSpacing: 60,
                hooks: "0x0000000000000000000000000000000000000000"
            };

            // Should revert with ratio error
            await expect(
                cellarHook.connect(user1).addLiquidity(
                    dummyKey,
                    amountMON,
                    amountKEEP,
                    0,
                    0,
                    { value: amountMON }
                )
            ).to.be.revertedWith("CellarHook: Invalid MON:KEEP ratio (must be 1:3)");
        });

        it("Should mint correct amount of LP tokens (1 LP per 1 MON)", async function () {
            const amountMON = ethers.parseEther("5");
            const amountKEEP = ethers.parseEther("15"); // 3x MON

            // Mint KEEP tokens to user
            await keepToken.mint(user1.address, amountKEEP);
            await keepToken.connect(user1).approve(await cellarHook.getAddress(), amountKEEP);

            // Create dummy PoolKey
            const dummyKey = {
                currency0: { id: 0n, isNative: true },
                currency1: { id: 0n, isNative: false },
                fee: 3000,
                tickSpacing: 60,
                hooks: "0x0000000000000000000000000000000000000000"
            };

            const lpBalanceBefore = await cellarHook.balanceOf(user1.address);

            await cellarHook.connect(user1).addLiquidity(
                dummyKey,
                amountMON,
                amountKEEP,
                0,
                0,
                { value: amountMON }
            );

            const lpBalanceAfter = await cellarHook.balanceOf(user1.address);
            const lpMinted = lpBalanceAfter - lpBalanceBefore;

            // Should mint 1 LP per 1 MON
            expect(lpMinted).to.equal(amountMON);
        });

        it("Should handle multiple valid additions", async function () {
            const amountMON1 = ethers.parseEther("2");
            const amountKEEP1 = ethers.parseEther("6"); // 3x MON

            const amountMON2 = ethers.parseEther("3");
            const amountKEEP2 = ethers.parseEther("9"); // 3x MON

            // Mint KEEP tokens to user
            await keepToken.mint(user1.address, amountKEEP1 + amountKEEP2);
            await keepToken.connect(user1).approve(await cellarHook.getAddress(), amountKEEP1 + amountKEEP2);

            // Create dummy PoolKey
            const dummyKey = {
                currency0: { id: 0n, isNative: true },
                currency1: { id: 0n, isNative: false },
                fee: 3000,
                tickSpacing: 60,
                hooks: "0x0000000000000000000000000000000000000000"
            };

            // First addition
            await cellarHook.connect(user1).addLiquidity(
                dummyKey,
                amountMON1,
                amountKEEP1,
                0,
                0,
                { value: amountMON1 }
            );

            const lpBalanceAfter1 = await cellarHook.balanceOf(user1.address);
            expect(lpBalanceAfter1).to.equal(amountMON1);

            // Second addition
            await cellarHook.connect(user1).addLiquidity(
                dummyKey,
                amountMON2,
                amountKEEP2,
                0,
                0,
                { value: amountMON2 }
            );

            const lpBalanceAfter2 = await cellarHook.balanceOf(user1.address);
            expect(lpBalanceAfter2).to.equal(amountMON1 + amountMON2);
        });
    });
});
