const { task } = require("hardhat/config")

task("mint-nft").setAction(async(taskArgs, hre) => {
    const firstAccount = (await getNamedAccounts()).firstAccount;
    const nft = await ethers.getContract("MyToken", firstAccount);
    console.log(nft.target);

    const mintTx = await nft.safeMint(firstAccount);
    mintTx.wait(6);
})

module.exports = {}