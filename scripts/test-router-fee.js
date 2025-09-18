const { ethers } = require('ethers');
require('dotenv').config();

// 网络配置
const SEPOLIA_CONFIG = {
  rpcUrl: process.env.SEPOLIA_RPC_URL || 'https://eth-sepolia.public.blastapi.io',
  chainId: 11155111,
  routerAddress: '0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59',
  linkTokenAddress: '0x779877A7B0D9E8603169DdbD7836e478b4624789',
  holeskyChainSelector: '7717148896336251131', // Holesky的链选择器
};

// CCIP Router ABI
const ROUTER_ABI = [
  "function getFee(uint64 destinationChainSelector, bytes memory message) external view returns (uint256)",
  "function getChainSelector() external view returns (uint64)",
  "function supportsInterface(bytes4 interfaceId) external view returns (bool)"
];

// Link Token ABI
const LINK_TOKEN_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function balanceOf(address account) external view returns (uint256)"
];

// 打印分隔线
function printSeparator() {
  console.log('\n' + '='.repeat(80) + '\n');
}

// 主函数
async function main() {
  try {
    console.log('🔍 直接测试Router费用估算功能');
    console.log(`连接到网络: ${SEPOLIA_CONFIG.rpcUrl}`);
    
    // 创建提供者
    const provider = new ethers.JsonRpcProvider(SEPOLIA_CONFIG.rpcUrl);
    
    // 1. 验证Router合约连接
    printSeparator();
    console.log('1. 验证Router合约连接');
    
    const routerContract = new ethers.Contract(
      SEPOLIA_CONFIG.routerAddress, 
      ROUTER_ABI, 
      provider
    );
    
    try {
      // 获取Router链选择器以验证连接
      const routerChainSelector = await routerContract.getChainSelector();
      console.log(`✅ Router连接成功`);
      console.log(`  Router地址: ${SEPOLIA_CONFIG.routerAddress}`);
      console.log(`  Router链选择器: ${routerChainSelector}`);
      console.log(`  目标链选择器(Holesky): ${SEPOLIA_CONFIG.holeskyChainSelector}`);
    } catch (error) {
      console.error('❌ Router连接失败:', error.message);
      console.log('  可能的原因: Router地址错误或网络连接问题');
      return;
    }
    
    // 2. 验证LinkToken合约
    printSeparator();
    console.log('2. 验证LinkToken合约');
    
    const linkTokenContract = new ethers.Contract(
      SEPOLIA_CONFIG.linkTokenAddress, 
      LINK_TOKEN_ABI, 
      provider
    );
    
    try {
      const linkName = await linkTokenContract.name();
      const linkSymbol = await linkTokenContract.symbol();
      console.log(`✅ LinkToken验证成功`);
      console.log(`  LinkToken地址: ${SEPOLIA_CONFIG.linkTokenAddress}`);
      console.log(`  LinkToken名称: ${linkName}`);
      console.log(`  LinkToken符号: ${linkSymbol}`);
    } catch (error) {
      console.error('❌ LinkToken验证失败:', error.message);
    }
    
    // 3. 测试费用估算
    printSeparator();
    console.log('3. 测试费用估算');
    
    // 测试接收器地址（Holesky上的NFTPoolMintAndBurn合约）
    const holeskyReceiver = '0x8f2477B985dbDFc2F2CC492074F788E6D0808Ed9';
    
    // 构建CCIP消息格式 - 这是直接传递给Router.getFee的格式
    const evm2AnyMessage = {
      receiver: ethers.solidityPacked(['address'], [holeskyReceiver]),
      data: ethers.AbiCoder.defaultAbiCoder().encode(['uint256', 'address'], [1, '0xfF266A6A5d969393C878FB54217807571EA4193C']),
      tokenAmounts: [],
      extraArgs: ethers.solidityPacked(
        ['uint256', 'bool'], 
        [300000, true] // gasLimit, allowOutOfOrderExecution
      ),
      feeToken: SEPOLIA_CONFIG.linkTokenAddress
    };
    
    // 将消息编码为Router.getFee所需的格式
    const encodedMessage = ethers.AbiCoder.defaultAbiCoder().encode(
      ['tuple(address,bytes,uint256[][],bytes,address)'],
      [[evm2AnyMessage.receiver, evm2AnyMessage.data, evm2AnyMessage.tokenAmounts, evm2AnyMessage.extraArgs, evm2AnyMessage.feeToken]]
    );
    
    console.log('构建的消息详情:');
    console.log(`  接收器地址: ${holeskyReceiver}`);
    console.log(`  消息数据长度: ${evm2AnyMessage.data.length} bytes`);
    console.log(`  编码后消息长度: ${encodedMessage.length} bytes`);
    console.log(`  Gas限制: 300000`);
    
    try {
      console.log('\n尝试调用Router.getFee...');
      const fee = await routerContract.getFee(SEPOLIA_CONFIG.holeskyChainSelector, encodedMessage);
      console.log(`✅ 费用估算成功: ${ethers.formatEther(fee)} LINK`);
    } catch (error) {
      console.error('❌ 费用估算失败:', error);
      console.log('\n详细错误信息:');
      console.log(`  error.name: ${error.name}`);
      console.log(`  error.code: ${error.code}`);
      console.log(`  error.message: ${error.message}`);
      
      if (error.data) {
        console.log(`  error.data:`, error.data);
      }
      
      console.log('\n可能的原因:');
      console.log('1. 链选择器错误（Holesky的链选择器应为7717148896336251131）');
      console.log('2. Router合约地址错误或不支持当前网络');
      console.log('3. CCIP消息格式不正确');
      console.log('4. RPC节点连接问题或网络不稳定');
      console.log('5. Router合约版本不兼容或未部署完成');
    }
    
  } catch (error) {
    console.error('❌ 测试过程中发生整体错误:', error);
  }
}

// 执行主函数
main();