// 检查Chainlink CCIP链选择器配置的脚本
// 注意：请使用 hardhat run check-chain-selector.js --network sepolia 命令运行
const { ethers } = require('hardhat');

// 网络配置
const networkConfig = {
  11155111: { // Sepolia
    name: 'Sepolia',
    router: '0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59',
    linkToken: '0x779877A7B0D9E8603169DdbD7836e478b4624789',
    companionChainSelector: 7717148896336251131 // Holesky
  },
  17000: { // Holesky
    name: 'Holesky',
    router: '0x11Cb7E8186833983e429D408b3B9B3944E06D4f9',
    linkToken: '0x42c58710004848894D22C48F7F8E01595D2B0F01',
    companionChainSelector: 16015286601757825753 // Sepolia
  }
};

async function main() {
  try {
    // 获取Hardhat运行时环境
    const hre = require('hardhat');
    const [deployer] = await hre.ethers.getSigners();
    const chainId = await hre.network.config.chainId;
    
    // 检查是否使用了正确的Hardhat命令格式
    if (!chainId || (chainId !== 11155111 && chainId !== 17000)) {
      console.log('⚠️  请使用以下命令在指定网络上运行此脚本：');
      console.log('   npx hardhat run check-chain-selector.js --network sepolia');
      console.log('   或');
      console.log('   npx hardhat run check-chain-selector.js --network holesky');
      return;
    }
    
    console.log(`Current network: ${networkConfig[chainId]?.name || 'Unknown'} (chainId: ${chainId})`);
    console.log(`Deployer address: ${deployer.address}`);
    
    // 获取当前网络配置
    const currentConfig = networkConfig[chainId];
    if (!currentConfig) {
      console.error(`No configuration found for chainId: ${chainId}`);
      return;
    }
    
    console.log(`\nCurrent network configuration:`);
    console.log(`- Router: ${currentConfig.router}`);
    console.log(`- LINK token: ${currentConfig.linkToken}`);
    console.log(`- Companion chain selector (configured): ${currentConfig.companionChainSelector}`);
    
    // 获取路由器合约实例
    const routerAbi = [
      "function getSupportedTokens(uint64 destinationChainSelector) external view returns (address[] memory)",
      "function getDestinationAddress(uint64 destinationChainSelector, address sourceToken) external view returns (address)"
    ];
    
    const router = new ethers.Contract(currentConfig.router, routerAbi, ethers.provider);
    console.log(`\nRouter contract initialized at: ${router.target}`);
    
    // 测试路由器连接
    try {
      console.log(`\nTesting router connection by checking supported tokens...`);
      const supportedTokens = await router.getSupportedTokens(currentConfig.companionChainSelector);
      console.log(`✅ Successfully queried router for supported tokens`);
      console.log(`Number of supported tokens on companion chain: ${supportedTokens.length}`);
      
      // 这个查询成功意味着chain selector是有效的
      console.log(`\n✅ Chain selector validation: The configured companion chain selector (${currentConfig.companionChainSelector}) is valid for this network.`);
      
      // 根据网络类型给出建议
      if (chainId === 11155111) { // Sepolia
        console.log(`\nConfiguration for Sepolia -> Holesky is valid.`);
        console.log(`If you're experiencing CCIP message failures, check:`);
        console.log(`1. LINK token balance in your contract`);
        console.log(`2. Gas limit settings (current: 300,000 for Sepolia)`);
        console.log(`3. Target chain receiver address validity`);
      } else if (chainId === 17000) { // Holesky
        console.log(`\nConfiguration for Holesky -> Sepolia is valid.`);
        console.log(`If you're experiencing CCIP message failures, check:`);
        console.log(`1. LINK token balance in your contract`);
        console.log(`2. Gas limit settings (current: 400,000 for Holesky)`);
        console.log(`3. Target chain receiver address validity`);
      }
      
    } catch (error) {
      console.error(`❌ Failed to query router with configured chain selector:`);
      console.error(`Error: ${error.message}`);
      console.log(`\nPossible issues:`);
      console.log(`1. The chain selector value (${currentConfig.companionChainSelector}) might be incorrect`);
      console.log(`2. The router address (${currentConfig.router}) might be incorrect`);
      console.log(`3. Network connectivity issues`);
      
      // 尝试使用通用方法验证路由器是否存在
      try {
        const code = await ethers.provider.getCode(currentConfig.router);
        if (code === '0x') {
          console.error(`❌ Router address ${currentConfig.router} does not exist on this network.`);
        } else {
          console.log(`✅ Router address ${currentConfig.router} exists on this network.`);
        }
      } catch (e) {
        console.error(`❌ Could not verify router address existence.`);
      }
    }
    
    console.log(`\nTest completed.`);
  } catch (error) {
    console.error(`❌ Unexpected error: ${error.message}`);
    process.exit(1);
  }
}

main().then(() => process.exit(0)).catch(error => {
  console.error(error);
  process.exit(1);
});