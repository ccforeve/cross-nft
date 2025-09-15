module.exports = async({getNamedAccounts, deployments}) => {
    const firstAccount = (await getNamedAccounts()).firstAccount
    console.log(`get first account: ${firstAccount}`)
    const {deploy, log} = deployments
    log("wnft contract deploy...")
    await deploy("WrappedMyToken", {
        from: firstAccount,
        args: ["WrappedMyToken", "WMTK"],
        log: true
    })
    log("wnft contract deploy successfully")
}

module.exports.tags = ["destchain", "all"]