// 此脚本用于为NFTPoolLockAndRelease合约授权路由器使用LINK代币
const { ethers } = require('ethers');
require('dotenv').config();

// 网络配置
const NETWORKS = {
  sepolia: {
    rpcUrl: process.env.SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/YOUR_PROJECT_ID',
    chainId: 11155111,
    linkTokenAddress: '0x779877A7B0D9E8603169DdbD7836e478b4624789',
    routerAddress: '0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59'
  },
  holesky: {
    rpcUrl: process.env.HOLESKY_RPC_URL || 'https://holesky.infura.io/v3/YOUR_PROJECT_ID',
    chainId: 17000,
    linkTokenAddress: '0xf2DAd89f2788a8CD54625C60b55cD3d2D0ACa7Cb',
    routerAddress: '0xb9531b46fE8808fB363A59'
  }
};

// 合约地址
const CONTRACT_ADDRESSES = {
  sepolia: {
    nftPoolLockAndRelease: '0xD08d82e1b4b1a6E8a74109b72c69bBb4CF95F6eA'
  },
  holesky: {
    // 如果需要在Holesky网络上也执行授权，可以添加Holesky的合约地址
  }
};

// LINK Token的ABI（简化版，只包含需要的方法）
const LINK_TOKEN_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)"
];

// 主函数
async function main() {
  try {
    // 选择网络（这里使用Sepolia，因为之前检查显示Sepolia网络的合约需要授权）
    const network = NETWORKS.sepolia;
    const contractAddress = CONTRACT_ADDRESSES.sepolia.nftPoolLockAndRelease;
    
    // 创建提供者和签名者
    const provider = new ethers.JsonRpcProvider(network.rpcUrl);
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('请在.env文件中设置PRIVATE_KEY');
    }
    const signer = new ethers.Wallet(privateKey, provider);
    
    console.log(`连接到 ${network.rpcUrl}`);
    console.log(`使用账户: ${signer.address}`);
    
    // 创建LINK Token合约实例
    const linkToken = new ethers.Contract(
      network.linkTokenAddress,
      LINK_TOKEN_ABI,
      signer
    );
    
    // 检查合约的LINK余额
    const contractLinkBalance = await linkToken.balanceOf(contractAddress);
    console.log(`NFTPoolLockAndRelease合约的LINK余额: ${ethers.formatEther(contractLinkBalance)} LINK`);
    
    // 检查当前授权额度
    const currentAllowance = await linkToken.allowance(contractAddress, network.routerAddress);
    console.log(`当前对路由器的授权额度: ${ethers.formatEther(currentAllowance)} LINK`);
    
    // 构建交易参数：使用多重签名方式授权
    const iface = new ethers.Interface(LINK_TOKEN_ABI);
    const approveData = iface.encodeFunctionData('approve', [
      network.routerAddress,
      ethers.MaxUint256 // 授权最大额度
    ]);
    
    // 构建交易
    const tx = {
      to: network.linkTokenAddress,
      from: signer.address,
      data: approveData,
      gasLimit: 100000, // 设置足够的gas limit
      chainId: network.chainId
    };
    
    // 估算gas价格
    const gasPrice = await provider.getFeeData();
    tx.gasPrice = gasPrice.gasPrice;
    
    console.log('正在发送授权交易...');
    const transaction = await signer.sendTransaction(tx);
    console.log(`交易已发送，哈希值: ${transaction.hash}`);
    
    // 等待交易确认
    console.log('等待交易确认...');
    const receipt = await transaction.wait(1); // 等待1个确认
    console.log(`交易已确认，区块号: ${receipt.blockNumber}`);
    
    // 验证授权是否成功
    const newAllowance = await linkToken.allowance(contractAddress, network.routerAddress);
    console.log(`授权后额度: ${ethers.formatEther(newAllowance)} LINK`);
    
    if (newAllowance === ethers.MaxUint256) {
      console.log('✅ 授权成功！合约现在可以使用LINK支付CCIP手续费');
    } else {
      console.log('⚠️ 授权未达到预期值，请检查交易状态');
    }
    
    // 提示用户
    console.log('\n提示：');
    console.log('1. 此授权是一次性操作，除非调用revoke或修改授权额度，否则一直有效');
    console.log('2. 请确保合约有足够的LINK余额支付CCIP手续费');
    console.log('3. 如需在Holesky网络上执行类似操作，请修改脚本中的网络配置');
    
  } catch (error) {
    console.error('❌ 发生错误:', error.message);
    if (error.code === 'INSUFFICIENT_FUNDS') {
      console.log('请确保您的账户有足够的ETH支付gas费用');
    } else if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
      console.log('请尝试调整gasLimit参数');
    }
  }
}

// 执行主函数
main();