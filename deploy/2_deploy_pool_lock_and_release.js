const { network } = require("hardhat")
const { developmentChains, networkConfig } = require("../helper-hardhat-config")

module.exports = async({getNamedAccounts, deployments}) => {
    const firstAccount = (await getNamedAccounts()).firstAccount
    console.log(`get first account: ${firstAccount}`)
    const {deploy, log} = deployments
    log("NFTPoolLockAndRelease contract deploying...")
    let sourceChainRouter, linkTokenAddr;
    if (developmentChains.includes(network.name)) {
        const ccipLocalSimulatorDeployment = await deployments.get("CCIPLocalSimulator");
        const ccipSimulator = await ethers.getContractAt("CCIPLocalSimulator", ccipLocalSimulatorDeployment.address);
        const ccipConfig = await ccipSimulator.configuration();
        sourceChainRouter = ccipConfig.sourceRouter_;
        linkTokenAddr = ccipConfig.linkToken_;
    } else {
        console.log("network for sepolia")
        sourceChainRouter = networkConfig[network.config.chainId].router;
        linkTokenAddr = networkConfig[network.config.chainId].linkToken;
    }
    
    const nftDeployment = await deployments.get("MyToken");
    await deploy("NFTPoolLockAndRelease", {
        contract: "NFTPoolLockAndRelease",
        from: firstAccount,
        args: [sourceChainRouter, linkTokenAddr, nftDeployment.address],
        log: true
    })
    log("NFTPoolLockAndRelease contract deploy successfully")
}

module.exports.tags = ["sourcechain", "all"]