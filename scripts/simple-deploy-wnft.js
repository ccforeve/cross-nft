async function main() {
    console.log("开始部署WrappedMyToken合约...");
    
    // 使用hre.ethers在Hardhat环境中
    const hre = require("hardhat");
    const ethers = hre.ethers;
    
    // 获取部署账户
    const [deployer] = await ethers.getSigners();
    console.log(`部署账户: ${deployer.address}`);
    
    // 检查余额
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`账户余额: ${ethers.utils.formatEther(balance)} MATIC`);
    
    // 部署合约
    const WrappedMyToken = await ethers.getContractFactory("WrappedMyToken");
    console.log("正在部署合约...");
    
    // 设置较低的gas limit和gas price以节省成本
    const wnft = await WrappedMyToken.deploy("WrappedMyToken", "WMTK", {
        gasLimit: 2000000,
        gasPrice: ethers.utils.parseUnits("100", "gwei")
    });
    
    await wnft.deployed();
    
    console.log(`WrappedMyToken合约部署成功！`);
    console.log(`合约地址: ${wnft.address}`);
    console.log(`交易哈希: ${wnft.deployTransaction.hash}`);
    
    // 创建amoy部署目录并保存合约地址信息
    const fs = require("fs");
    const path = require("path");
    const deploymentsDir = path.join(__dirname, "..", "deployments", "amoy");
    
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }
    
    const contractInfo = {
        address: wnft.address,
        abi: require("../artifacts/contracts/WrappedMyToken.sol/WrappedMyToken.json").abi
    };
    
    fs.writeFileSync(
        path.join(deploymentsDir, "WrappedMyToken.json"),
        JSON.stringify(contractInfo, null, 2)
    );
    
    fs.writeFileSync(
        path.join(deploymentsDir, ".chainId"),
        "80002"
    );
    
    console.log("合约信息已保存到deployments/amoy目录");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });