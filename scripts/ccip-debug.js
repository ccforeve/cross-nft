// 详细的CCIP调试脚本，用于诊断跨链功能问题
const { ethers } = require('ethers');
require('dotenv').config();

// 网络配置
const NETWORKS = {
  sepolia: {
    rpcUrl: process.env.SEPOLIA_RPC_URL || 'https://eth-sepolia.public.blastapi.io',
    chainId: 11155111,
    linkTokenAddress: '0x779877A7B0D9E8603169DdbD7836e478b4624789',
    routerAddress: '0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59',
    companionChainSelector: '7717148896336251131', // Holesky的链选择器
    nftPoolLockAndRelease: '0xD08d82e1b4b1a6E8a74109b72c69bBb4CF95F6eA',
    myToken: '0x2A34330dC56A4f2f3e9Aa50715Fac4DB6794f2FC'
  }
};

// 完整的合约ABI
const NFT_POOL_ABI = [
  "function nft() view returns (address)",
  "function lockNFT(uint256 tokenId) external returns (bool)",
  "function lockAndSendNFT(uint256 tokenId, address newOwner, uint64 chainSelector, address receiver) external returns (bytes32)",
  "function estimateFee(uint64 destinationChainSelector, address receiver, bytes memory text) public view returns (uint256)",
  "function getRouterAddress() public view returns (address)",
  "function getLinkTokenAddress() public view returns (address)",
  "function depositLink(uint256 amount) external"
];

const MY_TOKEN_ABI = [
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function name() view returns (string)",
  "function symbol() view returns (string)"
];

const LINK_TOKEN_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function name() view returns (string)",
  "function symbol() view returns (string)"
];

const ROUTER_ABI = [
  "function getFee(uint64 destinationChainSelector, bytes memory message) external view returns (uint256)",
  "function getChainSelector() external view returns (uint64)",
  "function supportsInterface(bytes4 interfaceId) external view returns (bool)"
];

// 打印分隔线
function printSeparator() {
  console.log('\n' + '='.repeat(80) + '\n');
}

// 主调试函数
async function main() {
  try {
    const network = NETWORKS.sepolia;
    const tokenId = BigInt(1);
    
    // 创建提供者和签名者
    const provider = new ethers.JsonRpcProvider(network.rpcUrl);
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('请在.env文件中设置PRIVATE_KEY');
    }
    const signer = new ethers.Wallet(privateKey, provider);
    const signerAddress = await signer.getAddress();
    
    console.log('📋 CCIP跨链功能调试工具');
    console.log(`连接到网络: ${network.rpcUrl}`);
    console.log(`使用账户: ${signerAddress}`);
    console.log(`测试NFT ID: ${tokenId}`);
    
    // 1. 验证合约地址配置
    printSeparator();
    console.log('1. 验证合约地址配置');
    
    // 创建合约实例
    const nftPoolContract = new ethers.Contract(network.nftPoolLockAndRelease, NFT_POOL_ABI, signer);
    const myTokenContract = new ethers.Contract(network.myToken, MY_TOKEN_ABI, signer);
    const linkTokenContract = new ethers.Contract(network.linkTokenAddress, LINK_TOKEN_ABI, signer);
    const routerContract = new ethers.Contract(network.routerAddress, ROUTER_ABI, signer);
    
    // 验证Router合约
    try {
      const routerChainSelector = await routerContract.getChainSelector();
      console.log(`✅ Router合约验证成功`);
      console.log(`  Router地址: ${network.routerAddress}`);
      console.log(`  Router链选择器: ${routerChainSelector}`);
      console.log(`  配置的目标链选择器: ${network.companionChainSelector}`);
    } catch (error) {
      console.error('❌ Router合约验证失败:', error.message);
      console.log('  检查Router地址是否正确，以及网络连接是否稳定');
    }
    
    // 验证LinkToken合约
    try {
      const linkName = await linkTokenContract.name();
      const linkSymbol = await linkTokenContract.symbol();
      console.log(`✅ LinkToken合约验证成功`);
      console.log(`  LinkToken地址: ${network.linkTokenAddress}`);
      console.log(`  LinkToken名称: ${linkName}`);
      console.log(`  LinkToken符号: ${linkSymbol}`);
    } catch (error) {
      console.error('❌ LinkToken合约验证失败:', error.message);
    }
    
    // 验证NFT合约
    try {
      const nftName = await myTokenContract.name();
      const nftSymbol = await myTokenContract.symbol();
      console.log(`✅ NFT合约验证成功`);
      console.log(`  NFT地址: ${network.myToken}`);
      console.log(`  NFT名称: ${nftName}`);
      console.log(`  NFT符号: ${nftSymbol}`);
    } catch (error) {
      console.error('❌ NFT合约验证失败:', error.message);
    }
    
    // 2. 检查NFT状态
    printSeparator();
    console.log('2. 检查NFT状态');
    
    try {
      const owner = await myTokenContract.ownerOf(tokenId);
      console.log(`NFT ${tokenId}的所有者: ${owner}`);
      console.log(`是否在合约中: ${owner.toLowerCase() === network.nftPoolLockAndRelease.toLowerCase()}`);
      console.log(`是否在用户账户: ${owner.toLowerCase() === signerAddress.toLowerCase()}`);
    } catch (error) {
      console.error('❌ 获取NFT所有权失败:', error.message);
      console.log('  可能的原因: tokenId不存在或合约地址错误');
    }
    
    // 3. 检查LINK余额和授权
    printSeparator();
    console.log('3. 检查LINK余额和授权');
    
    // 检查用户LINK余额
    try {
      const userLinkBalance = await linkTokenContract.balanceOf(signerAddress);
      console.log(`用户LINK余额: ${ethers.formatEther(userLinkBalance)} LINK`);
    } catch (error) {
      console.error('❌ 获取用户LINK余额失败:', error.message);
    }
    
    // 检查合约LINK余额
    try {
      const contractLinkBalance = await linkTokenContract.balanceOf(network.nftPoolLockAndRelease);
      console.log(`合约LINK余额: ${ethers.formatEther(contractLinkBalance)} LINK`);
    } catch (error) {
      console.error('❌ 获取合约LINK余额失败:', error.message);
    }
    
    // 检查合约对Router的授权
    try {
      const allowance = await linkTokenContract.allowance(network.nftPoolLockAndRelease, network.routerAddress);
      console.log(`合约对Router的LINK授权: ${ethers.formatEther(allowance)} LINK`);
    } catch (error) {
      console.error('❌ 获取授权信息失败:', error.message);
    }
    
    // 4. 直接测试费用估算
    printSeparator();
    console.log('4. 直接测试费用估算');
    
    const holeskyReceiver = '0x8f2477B985dbDFc2F2CC492074F788E6D0808Ed9';
    const payload = ethers.AbiCoder.defaultAbiCoder().encode(['uint256', 'address'], [tokenId, signerAddress]);
    
    try {
      console.log('尝试使用nftPoolContract.estimateFee...');
      const estimatedFee = await nftPoolContract.estimateFee(
        network.companionChainSelector, 
        holeskyReceiver, 
        payload
      );
      console.log(`✅ 费用估算成功: ${ethers.formatEther(estimatedFee)} LINK`);
    } catch (error) {
      console.error('❌ nftPoolContract.estimateFee失败:', error.message);
      
      // 尝试直接通过Router合约估算费用
      try {
        console.log('\n尝试直接使用Router合约估算费用...');
        // 构建CCIP消息格式
        const evm2AnyMessage = {
          receiver: ethers.solidityPacked(['address'], [holeskyReceiver]),
          data: payload,
          tokenAmounts: [],
          extraArgs: ethers.solidityPacked(
            ['uint256', 'bool'], 
            [300000, true] // gasLimit, allowOutOfOrderExecution
          ),
          feeToken: network.linkTokenAddress
        };
        
        // 将消息编码为Router.getFee所需的格式
        const encodedMessage = ethers.AbiCoder.defaultAbiCoder().encode(
          ['tuple(address,bytes,uint256[][],bytes,address)'],
          [[evm2AnyMessage.receiver, evm2AnyMessage.data, evm2AnyMessage.tokenAmounts, evm2AnyMessage.extraArgs, evm2AnyMessage.feeToken]]
        );
        
        const directEstimatedFee = await routerContract.getFee(network.companionChainSelector, encodedMessage);
        console.log(`✅ 直接通过Router估算费用成功: ${ethers.formatEther(directEstimatedFee)} LINK`);
      } catch (directError) {
        console.error('❌ 直接通过Router估算费用失败:', directError.message);
        console.log('  可能的原因: 链选择器错误、Router地址错误、网络连接问题');
        console.log('  当前配置的Holesky链选择器:', network.companionChainSelector);
      }
    }
    
    // 5. 诊断建议
    printSeparator();
    console.log('5. 诊断建议');
    
    console.log('🔍 常见问题排查:');
    console.log('1. 确保Router地址和链选择器配置正确');
    console.log('2. 确认合约有足够的LINK余额支付手续费');
    console.log('3. 检查目标链接收器地址是否正确');
    console.log('4. 验证跨链消息格式是否符合CCIP要求');
    console.log('5. 检查网络连接和RPC节点稳定性');
    
    console.log('\n💡 解决建议:');
    console.log('• 如果费用估算失败，可能是链选择器配置错误或Router合约不可用');
    console.log('• 尝试更新helper-hardhat-config.js中的配置信息');
    console.log('• 检查目标链接收器合约是否正确实现了CCIPReceiver接口');
    console.log('• 考虑使用最新的Chainlink CCIP文档验证配置参数');
    
    // 6. 提供修复命令示例
    printSeparator();
    console.log('6. 修复命令示例');
    
    console.log('📝 为合约存款LINK:');
    console.log(`npx hardhat deposit-link --amount 1 --network sepolia`);
    
    console.log('\n📝 仅锁定NFT不发送消息:');
    console.log(`npx hardhat lock-and-cross --tokenid ${tokenId} --lockonly --network sepolia`);
    
    console.log('\n📝 验证锁仓状态:');
    console.log(`npx hardhat check-nft --tokenid ${tokenId} --network sepolia`);
    
  } catch (error) {
    console.error('❌ 调试过程中发生错误:', error.message);
    console.log('\n请检查.env文件配置和网络连接状态。');
  }
}

// 执行主函数
main();