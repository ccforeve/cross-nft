// 最简部署脚本
async function main() {
    // 使用全局可用的hre对象
    const WrappedMyToken = await ethers.getContractFactory("WrappedMyToken");
    console.log("正在部署WrappedMyToken合约...");
    
    // 部署合约，不指定gas参数，让hardhat自动估算
    const wnft = await WrappedMyToken.deploy("WrappedMyToken", "WMTK");
    
    await wnft.deployed();
    
    console.log(`WrappedMyToken合约部署成功！`);
    console.log(`合约地址: ${wnft.address}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });