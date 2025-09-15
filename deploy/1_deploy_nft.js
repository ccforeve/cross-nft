module.exports = async({getNamedAccounts, deployments}) => {
    const firstAccount = (await getNamedAccounts()).firstAccount
    console.log(`get first account: ${firstAccount}`)
    const {deploy, log} = deployments
    log("nft contract deploy...")
    await deploy("MyToken", {
        from: firstAccount,
        args: ["MyToken", "MTK"],
        log: true
    })
    log("nft contract deploy successfully")
}

module.exports.tags = ["sourcechain", "all"]