// 使用Hardhat运行时环境
const hre = require('hardhat');
const { ethers } = hre;

async function main() {
    // 解析命令行参数
    const args = process.argv.slice(2);
    let networkName = 'hardhat';
    
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--network' && i + 1 < args.length) {
            networkName = args[i + 1];
            break;
        }
    }
    
    console.log('Target network:', networkName);
    
    // 检查是否在Hardhat环境中运行
    if (hre.network.name !== networkName && networkName !== 'hardhat') {
        console.error(`Please run with --network ${networkName} flag in Hardhat`);
        console.error('Example: npx hardhat run check-link-balance.js --network', networkName);
        return;
    }
    
    // 导入网络配置
    const { networkConfig } = require('./helper-hardhat-config');
    const config = networkConfig[hre.network.config.chainId];
    
    if (!config) {
        console.error('No configuration found for network:', hre.network.name, '(chainId:', hre.network.config.chainId, ')');
        return;
    }
    
    console.log('Network configuration found:', config);
    
    // 获取signer
    const [signer] = await ethers.getSigners();
    
    console.log('Using account:', signer.address);
    
    console.log('LINK Token address:', config.linkToken);
    console.log('Router address:', config.router);
    
    // 获取LINK Token合约实例
    const linkToken = await ethers.getContractAt('LinkToken', config.linkToken);
    
    // 检查账户的LINK余额
    const accountBalance = await linkToken.balanceOf(signer.address);
    console.log('Account LINK balance:', ethers.formatEther(accountBalance), 'LINK');
    
    // 检查NFTPoolLockAndRelease合约地址和余额
    try {
        const nftPoolDeployment = await ethers.getContract('NFTPoolLockAndRelease');
        const contractBalance = await linkToken.balanceOf(nftPoolDeployment.target);
        console.log('NFTPoolLockAndRelease address:', nftPoolDeployment.target);
        console.log('Contract LINK balance:', ethers.formatEther(contractBalance), 'LINK');
    } catch (error) {
        console.error('Failed to get NFTPoolLockAndRelease contract:', error.message);
    }
    
    // 检查授权情况
    try {
        const nftPoolDeployment = await ethers.getContract('NFTPoolLockAndRelease');
        const allowance = await linkToken.allowance(nftPoolDeployment.target, config.router);
        console.log('Contract allowance for router:', ethers.formatEther(allowance), 'LINK');
    } catch (error) {
        console.error('Failed to check allowance:', error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });