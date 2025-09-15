const { network } = require("hardhat")
const { developmentChains, networkConfig } = require("../helper-hardhat-config")

module.exports = async({getNamedAccounts, deployments}) => {
    const firstAccount = (await getNamedAccounts()).firstAccount
    console.log(`get first account: ${firstAccount}`)
    const {deploy, log} = deployments
    log("NFTPoolMintAndBurn contract deploying...")
    let destinationChainRouter, linkTokenAddr;
    if (developmentChains.includes(network.name)) {
        const ccipLocalSimulatorDeployment = await deployments.get("CCIPLocalSimulator");
        const ccipSimulator = await ethers.getContractAt("CCIPLocalSimulator", ccipLocalSimulatorDeployment.address);
        const ccipConfig = await ccipSimulator.configuration();
        destinationChainRouter = ccipConfig.destinationRouter_;
        linkTokenAddr = ccipConfig.linkToken_;
    } else {
        console.log(`chainId:${network.config.chainId}`);
        destinationChainRouter = networkConfig[network.config.chainId].router;
        console.log(`sourceChainRouter: ${destinationChainRouter}`)
        linkTokenAddr = networkConfig[network.config.chainId].linkToken;
        console.log(`linkTokenAddr: ${linkTokenAddr}`)
    }
    const wnftDeployment = await deployments.get("WrappedMyToken");
    await deploy("NFTPoolMintAndBurn", {
        from: firstAccount,
        args: [destinationChainRouter, linkTokenAddr, wnftDeployment.address],
        log: true
    })
    log("NFTPoolMintAndBurn contract deploy successfully")
}

module.exports.tags = ["destchain", "all"]