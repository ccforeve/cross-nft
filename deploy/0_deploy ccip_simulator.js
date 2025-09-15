const { network } = require("hardhat")
const { developmentChains } = require("../helper-hardhat-config")

module.exports = async({getNamedAccounts, deployments}) => {
    if (developmentChains.includes(network.name)) {
        const firstAccount = (await getNamedAccounts()).firstAccount
        console.log(`get first account: ${firstAccount}`)
        const {deploy, log} = deployments
        log("ccip simulator contract deploy...")
        await deploy("CCIPLocalSimulator", {
            from: firstAccount,
            args: [],
            log: true
        })
        log("ccip simulator contract deploy successfully")
    }
}

module.exports.tags = ["test", "all"]