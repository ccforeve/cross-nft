const { getNamedAccounts, deployments, ethers } = require("hardhat")
const { assert, expect } = require("chai");


let firstAccount, 
    ccip, 
    nft, 
    nftPoolLockAndRelease, 
    wnft, 
    nftPoolMintAndBurn,
    chainSelector;
before(async function() {
    firstAccount = (await getNamedAccounts()).firstAccount
    await deployments.fixture(["all"]);
    ccip = await ethers.getContract("CCIPLocalSimulator", firstAccount);
    nft = await ethers.getContract("MyToken", firstAccount);
    nftPoolLockAndRelease = await ethers.getContract("NFTPoolLockAndRelease", firstAccount);
    wnft = await ethers.getContract("WrappedMyToken", firstAccount);
    nftPoolMintAndBurn = await ethers.getContract("NFTPoolMintAndBurn", firstAccount);
    const config = await ccip.configuration();
    chainSelector = config.chainSelector_;
})

describe("source chain => dest chain tests", async function() {
    it("test if user can mint a nft from nft contract successfully", async function() {
        await nft.safeMint(firstAccount);
        const owner = await nft.ownerOf(0);
        expect(owner).to.equal(firstAccount);
    })
    
    it("test if user can lock the nft in the pool and send ccip message on source chain", async function() {
        // 要把MyToken合约里的nft放到池子里的时候需要先授权池子的地址
        await nft.approve(nftPoolLockAndRelease.target, 0);
        // 支付ccip费用，这里用ccip的水龙头给池子一些费用以便后续支付费用
        await ccip.requestLinkFromFaucet(nftPoolLockAndRelease, ethers.parseEther("10"))
        await nftPoolLockAndRelease.lockAndSendNFT(0, firstAccount, chainSelector, nftPoolMintAndBurn.target);
        const owner = await nft.ownerOf(0);
        expect(owner).to.equal(nftPoolLockAndRelease.target);
    })

    it("test if user can get a warppered nft in dest chain", async function() {
        const owner = await wnft.ownerOf(0);
        expect(owner).to.equal(firstAccount);
    })
})

describe("dest chain => source chain test", async function() {
    it("test if user can burn the wnft and send ccip message on dest chain", async function() {
        // 要把WarppedMyToken合约里的wnft放到池子里的时候需要先授权池子的地址
        await wnft.approve(nftPoolMintAndBurn.target, 0);
        // 支付ccip费用，这里用ccip的水龙头给池子一些费用以便后续支付费用
        await ccip.requestLinkFromFaucet(nftPoolMintAndBurn, ethers.parseEther("10"))
        await nftPoolMintAndBurn.burnAndSendNFT(0, firstAccount, chainSelector, nftPoolLockAndRelease.target);
        // 烧毁token之后token的数量就为0了
        const totalSupply = await wnft.totalSupply();
        expect(totalSupply).to.equal(0);
    })

    it("test if user have the nft unlocked on source chain", async function() {
        const owner = await nft.ownerOf(0);
        expect(owner).to.equal(firstAccount);
    })
})