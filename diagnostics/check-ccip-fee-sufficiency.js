// 直接使用Node.js运行，用于检查源链账户是否有足够的LINK代币支付CCIP手续费
const ethers = require('ethers');
require('dotenv').config();
const { networkConfig } = require('./helper-hardhat-config');

// 网络配置 - 添加RPC URL以便直接连接
const networkConfigWithRpc = {
  11155111: { // Sepolia
    name: 'Sepolia',
    rpcUrl: process.env.SEPOLIA_RPC_URL || 'https://rpc.sepolia.org',
    linkToken: '0x779877A7B0D9E8603169DdbD7836e478b4624789',
    router: '0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59',
    companionChainSelector: BigInt('7717148896336251131') // Holesky
  },
  17000: { // Holesky
    name: 'Holesky',
    rpcUrl: process.env.HOLESKY_RPC_URL || 'https://rpc.holesky.ethpandaops.io',
    linkToken: '0x685cE6742351ae9b618F383883D6d1e0c5A31B4B',
    router: '0xb9531b46fE8808fB363A59',
    companionChainSelector: BigInt('16015286601757825753') // Sepolia
  }
};

// LINK Token ABI（简化版）
const linkTokenAbi = [
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)"
];

// Router ABI（简化版，用于估算手续费）
const routerAbi = [
  "function getFee(uint64 destinationChainSelector, address receiver, bytes calldata data, address feeToken) external view returns (uint256)",
  "function getSupportedTokens(uint64 destinationChainSelector) external view returns (address[] memory)"
];

// CCIP消息发送数据结构（简化版）
function createCCIPMessageData(tokenId, receiver) {
  // 构造与NFTPoolLockAndRelease.sol中相似的消息数据
  // 这里使用简单的编码来模拟实际的消息数据大小
  const requstData = {
    tokenId: tokenId,
    newOwner: receiver
  };
  
  // 使用ethers的AbiCoder来编码数据
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  return abiCoder.encode(['uint256', 'address'], [requstData.tokenId, requstData.newOwner]);
}

async function main() {
  try {
    console.log('开始检查源链账户LINK余额是否足够支付CCIP手续费...\n');
    
    // 选择源链（默认为Sepolia）
    const sourceChainId = 11155111; // Sepolia
    const sourceConfig = networkConfigWithRpc[sourceChainId];
    const targetChainSelector = sourceConfig.companionChainSelector;
    
    console.log(`源链: ${sourceConfig.name} (chainId: ${sourceChainId})`);
    console.log(`目标链选择器: ${targetChainSelector}\n`);
    
    // 创建源链的provider
    const provider = new ethers.JsonRpcProvider(sourceConfig.rpcUrl);
    console.log(`连接到源链RPC: ${sourceConfig.rpcUrl}`);
    
    // 检查连接状态
    const blockNumber = await provider.getBlockNumber();
    console.log(`成功连接到源链，当前区块号: ${blockNumber}\n`);
    
    // 获取用户私钥（用于创建签名者）
    // 注意：在实际使用中，请确保私钥的安全存储
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      console.error('❌ 请在.env文件中设置PRIVATE_KEY环境变量');
      return;
    }
    
    // 创建签名者
    const signer = new ethers.Wallet(privateKey, provider);
    console.log(`使用账户: ${signer.address}\n`);
    
    // 1. 获取LINK Token合约实例并检查账户余额
    console.log('1. 检查账户LINK余额...');
    const linkToken = new ethers.Contract(sourceConfig.linkToken, linkTokenAbi, provider);
    const accountBalance = await linkToken.balanceOf(signer.address);
    const formattedAccountBalance = ethers.formatEther(accountBalance);
    console.log(`账户LINK余额: ${formattedAccountBalance} LINK\n`);
    
    // 2. 获取路由器合约实例并估算CCIP交易手续费
    console.log('2. 估算CCIP交易手续费...');
    const router = new ethers.Contract(sourceConfig.router, routerAbi, provider);
    
    // 构造模拟的CCIP消息数据
    // 注意：这里使用任意的tokenId和receiver地址来估算手续费
    const tokenId = 1n; // 示例NFT ID
    const mockReceiver = '0x8f2477B985dbDFc2F2CC492074F788E6D0808Ed9'; // 示例接收器地址
    const messageData = createCCIPMessageData(tokenId, mockReceiver);
    
    // 估算手续费
    let estimatedFee;
    try {
      estimatedFee = await router.getFee(
        targetChainSelector,
        mockReceiver,
        messageData,
        sourceConfig.linkToken
      );
      
      const formattedEstimatedFee = ethers.formatEther(estimatedFee);
      console.log(`估算的CCIP交易手续费: ${formattedEstimatedFee} LINK`);
      
      // 建议预留额外的手续费（增加20%）
      const recommendedFee = estimatedFee * 120n / 100n;
      const formattedRecommendedFee = ethers.formatEther(recommendedFee);
      console.log(`建议预留的手续费（+20%）: ${formattedRecommendedFee} LINK\n`);
      
      // 3. 比较余额和手续费
      console.log('3. 余额与手续费比较...');
      if (accountBalance >= recommendedFee) {
        console.log('✅ 账户余额充足，可以支付CCIP交易手续费');
        const remainingBalance = ethers.formatEther(accountBalance - recommendedFee);
        console.log(`预计交易后剩余: ${remainingBalance} LINK`);
      } else if (accountBalance >= estimatedFee) {
        console.log('⚠️ 账户余额刚好足够支付基础手续费，但建议预留更多余额以应对网络波动');
        const neededAmount = ethers.formatEther(recommendedFee - accountBalance);
        console.log(`建议额外添加: ${neededAmount} LINK`);
      } else {
        console.log('❌ 账户余额不足，无法支付CCIP交易手续费');
        const neededAmount = ethers.formatEther(estimatedFee - accountBalance);
        console.log(`至少还需要: ${neededAmount} LINK`);
      }
    } catch (error) {
      console.error('❌ 估算手续费时出错:', error.message);
      console.log('\n备用方案: 检查常见的CCIP手续费范围');
      
      // 提供常见网络的手续费参考范围
      let typicalFeeRange = '0.001-0.005 LINK';
      if (sourceChainId === 11155111) {
        typicalFeeRange = '0.001-0.003 LINK'; // Sepolia
      } else if (sourceChainId === 17000) {
        typicalFeeRange = '0.002-0.005 LINK'; // Holesky
      }
      
      console.log(`当前网络的典型CCIP手续费范围: ${typicalFeeRange}`);
      
      // 粗略比较余额和典型手续费范围
      const typicalFeeInWei = ethers.parseEther('0.01'); // 取一个稍高的典型值作为参考
      if (accountBalance >= typicalFeeInWei) {
        console.log('✅ 账户余额看起来足够支付典型的CCIP交易手续费');
      } else {
        console.log('❌ 账户余额可能不足，建议至少添加0.01 LINK');
      }
    }
    
    // 4. 检查合约余额（如果有NFTPoolLockAndRelease合约）
    console.log('\n4. 检查合约余额（如果适用）...');
    try {
      const fs = require('fs');
      const path = require('path');
      
      // 尝试从部署文件中读取合约地址
      const chainName = sourceConfig.name.toLowerCase();
      const deploymentPath = path.join(__dirname, `deployments/${chainName}/NFTPoolLockAndRelease.json`);
      
      if (fs.existsSync(deploymentPath)) {
        const deploymentData = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
        const contractAddress = deploymentData.address;
        
        const contractBalance = await linkToken.balanceOf(contractAddress);
        const formattedContractBalance = ethers.formatEther(contractBalance);
        console.log(`NFTPoolLockAndRelease合约地址: ${contractAddress}`);
        console.log(`合约LINK余额: ${formattedContractBalance} LINK`);
        
        // 检查合约对路由器的授权
        const allowance = await linkToken.allowance(contractAddress, sourceConfig.router);
        const formattedAllowance = ethers.formatEther(allowance);
        console.log(`合约对路由器的授权: ${formattedAllowance} LINK`);
      } else {
        console.log('未找到NFTPoolLockAndRelease合约部署文件，跳过合约余额检查');
      }
    } catch (error) {
      console.error('检查合约余额时出错:', error.message);
    }
    
    // 5. 提供获取更多LINK的建议
    console.log('\n=== 获取更多LINK代币 ===');
    if (sourceChainId === 11155111) {
      console.log('Sepolia LINK水龙头: https://faucets.chain.link/sepolia');
    } else if (sourceChainId === 17000) {
      console.log('Holesky LINK水龙头: https://faucets.chain.link/holesky');
    }
    console.log('\n建议: 始终保持足够的LINK余额以确保CCIP跨链操作顺利完成');
    
  } catch (error) {
    console.error('❌ 检查过程中出现错误:', error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });