const hre = require('hardhat');
const { ethers } = hre;

async function main() {
    // 直接使用命令行指定的网络
    console.log('Target network:', hre.network.name);
    
    // 获取signer
    const [signer] = await ethers.getSigners();
    
    console.log('Using account:', signer.address);
    
    // 检查账户的原生代币（MATIC）余额
    const accountBalance = await hre.ethers.provider.getBalance(signer.address);
    console.log('Account MATIC balance:', ethers.formatEther(accountBalance), 'MATIC');
    
    // 检查账户是否有足够的资金用于部署合约
    const minRequiredBalance = ethers.parseEther('0.1'); // 假设至少需要0.1 MATIC
    if (accountBalance < minRequiredBalance) {
        console.warn('Warning: Account balance is insufficient for contract deployment.');
        console.warn('Please fund your account with at least 0.1 MATIC on Polygon Amoy network.');
        console.warn('You can try using a faucet to get test MATIC for Amoy network.');
    }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });