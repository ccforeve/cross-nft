const { task } = require("hardhat/config")

task("check-nft").setAction(async(taskArgs, hre) => {
    const firstAccount = (await getNamedAccounts()).firstAccount;
    const nft = await ethers.getContract("MyToken", firstAccount);
    const totalSupply = await nft.totalSupply();
    console.log("checking status of MyToken")
    for(let tokenId = 0; tokenId < totalSupply; tokenId++) {
        const owner = await nft.ownerOf(tokenId);
        console.log(`tokenId: ${tokenId} - owner: ${owner}`);
    }
})

module.exports = {}