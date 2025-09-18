// 简化版链选择器配置测试脚本
// 直接使用Node.js运行，无需Hardhat命令行
const ethers = require('ethers');
require('dotenv').config();

// 网络配置 - 使用BigInt处理大数值
const networkConfig = {
  11155111: { // Sepolia
    name: 'Sepolia',
    rpcUrl: process.env.SEPOLIA_RPC_URL || 'https://rpc.sepolia.org',
    router: '0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59',
    linkToken: '0x779877A7B0D9E8603169DdbD7836e478b4624789',
    companionChainSelector: BigInt('7717148896336251131') // Holesky的正确Chain selector
  },
  17000: { // Holesky
    name: 'Holesky',
    rpcUrl: process.env.HOLESKY_RPC_URL || 'https://rpc.holesky.ethpandaops.io',
    router: '0xb9531b46fE8808fB3659e39704953c2B1112DD43',
    linkToken: '0x685cE6742351ae9b618F383883D6d1e0c5A31B4B',
    companionChainSelector: BigInt('16015286601757825753') // Sepolia的正确Chain selector
  }
};

async function main() {
  try {
    console.log('开始测试链选择器配置...');
    
    // 选择Sepolia网络
    const chainId = 11155111;
    const config = networkConfig[chainId];
    
    console.log(`选择网络: ${config.name} (chainId: ${chainId})`);
    
    // 创建provider
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    console.log(`连接到RPC: ${config.rpcUrl}`);
    
    // 检查连接状态
    const blockNumber = await provider.getBlockNumber();
    console.log(`成功连接，当前区块号: ${blockNumber}`);
    
    console.log(`\n配置详情:`);
    console.log(`- 路由器地址: ${config.router}`);
    console.log(`- LINK代币地址: ${config.linkToken}`);
    console.log(`- 目标链选择器: ${config.companionChainSelector}`);
    
    // 获取路由器合约实例
    const routerAbi = [
      "function getSupportedTokens(uint64 destinationChainSelector) external view returns (address[] memory)"
    ];
    
    const router = new ethers.Contract(config.router, routerAbi, provider);
    console.log(`\n路由器合约初始化成功`);
    
    // 测试路由器是否存在
    try {
      const code = await provider.getCode(config.router);
      if (code === '0x') {
        console.error(`❌ 错误: 路由器地址 ${config.router} 在${config.name}网络上不存在`);
      } else {
        console.log(`✅ 路由器地址 ${config.router} 在${config.name}网络上存在`);
        
        // 尝试查询支持的代币（验证链选择器）
        try {
          console.log(`\n正在测试链选择器 ${config.companionChainSelector}...`);
          const supportedTokens = await router.getSupportedTokens(config.companionChainSelector);
          console.log(`✅ 链选择器验证成功!`);
          console.log(`目标链(${config.companionChainSelector})支持的代币数量: ${supportedTokens.length}`);
          console.log(`\n🎉 配置验证完成! 当前Sepolia网络到Holesky网络的链选择器配置是有效的。`);
          
          // 给出使用建议
          console.log(`\n使用建议:`);
          console.log(`1. 确保您的合约中有足够的LINK代币支付跨链费用`);
          console.log(`2. 检查目标链接收器地址是否正确`);
          console.log(`3. 如遇问题，可尝试调整gas limit设置`);
        } catch (error) {
          console.error(`❌ 链选择器验证失败:`);
          console.error(`错误信息: ${error.message}`);
          console.log(`\n可能原因:`);
          console.log(`1. 链选择器值可能不正确`);
          console.log(`2. 网络连接问题`);
          console.log(`3. 路由器合约可能不支持此操作`);
        }
      }
    } catch (error) {
      console.error(`❌ 无法验证路由器地址:`);
      console.error(`错误信息: ${error.message}`);
    }
  } catch (error) {
    console.error(`❌ 测试过程中发生错误:`);
    console.error(`错误信息: ${error.message}`);
    process.exit(1);
  }
}

main().then(() => process.exit(0)).catch(error => {
  console.error(error);
  process.exit(1);
});