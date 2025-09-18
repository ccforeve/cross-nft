// 此脚本用于测试NFT跨链功能
const { ethers } = require('ethers');
require('dotenv').config();

// 网络配置 - 基于helper-hardhat-config.js修正
const NETWORKS = {
  sepolia: {
    rpcUrl: process.env.SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/YOUR_PROJECT_ID',
    chainId: 11155111,
    linkTokenAddress: '0x779877A7B0D9E8603169DdbD7836e478b4624789',
    routerAddress: '0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59',
    companionChainSelector: '7717148896336251131', // Holesky的链选择器
    nftPoolLockAndRelease: '0xD08d82e1b4b1a6E8a74109b72c69bBb4CF95F6eA',
    myToken: '0x2A34330dC56A4f2f3e9Aa50715Fac4DB6794f2FC',
    chainSelector: '16015286601757825753' // Sepolia自己的链选择器
  },
  holesky: {
    rpcUrl: process.env.HOLESKY_RPC_URL || 'https://holesky.infura.io/v3/YOUR_PROJECT_ID',
    chainId: 17000,
    linkTokenAddress: '0x685cE6742351ae9b618F383883D6d1e0c5A31B4B', // 修正为helper-hardhat-config中的地址
    routerAddress: '0xb9531b46fE8808fB3659e39704953c2B1112DD43', // 修正为完整地址
    companionChainSelector: '16015286601757825753', // Sepolia的链选择器
    nftPoolMintAndBurn: '0x8f2477B985dbDFc2F2CC492074F788E6D0808Ed9',
    chainSelector: '7717148896336251131' // Holesky自己的链选择器
  }
};

// NFTPoolLockAndRelease合约的ABI（简化版）
const NFT_POOL_ABI = [
  "function nft() view returns (address)",
  "function lockNFT(uint256 tokenId) external returns (bool)",
  "function lockAndSendNFT(uint256 tokenId, address newOwner, uint64 chainSelector, address receiver) external returns (bytes32)",
  "function estimateFee(uint64 destinationChainSelector, address receiver, bytes memory text) public view returns (uint256)",
  "function depositLink(uint256 amount) external"
];

// MyToken合约的ABI（简化版）
const MY_TOKEN_ABI = [
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function approve(address to, uint256 tokenId) external",
  "function setApprovalForAll(address operator, bool approved) external",
  "function getApproved(uint256 tokenId) view returns (address)",
  "function isApprovedForAll(address owner, address operator) view returns (bool)"
];

// LinkToken合约的ABI（简化版）
const LINK_TOKEN_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) external returns (bool)"
];

// 主函数
async function main() {
  try {
    // 设置源网络和目标网络
    const sourceNetwork = NETWORKS.sepolia;
    const destNetwork = NETWORKS.holesky;
    
    // 设置要跨链的NFT ID（请修改为您拥有的NFT ID）
    const tokenId = BigInt(1);
    
    // 创建提供者和签名者
    const provider = new ethers.JsonRpcProvider(sourceNetwork.rpcUrl);
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('请在.env文件中设置PRIVATE_KEY');
    }
    const signer = new ethers.Wallet(privateKey, provider);
    
    console.log(`连接到 ${sourceNetwork.rpcUrl}`);
    console.log(`使用账户: ${signer.address}`);
    
    // 创建合约实例
    const nftPoolContract = new ethers.Contract(
      sourceNetwork.nftPoolLockAndRelease,
      NFT_POOL_ABI,
      signer
    );
    
    const myTokenContract = new ethers.Contract(
      sourceNetwork.myToken,
      MY_TOKEN_ABI,
      signer
    );
    
    const linkTokenContract = new ethers.Contract(
      sourceNetwork.linkTokenAddress,
      LINK_TOKEN_ABI,
      signer
    );
    
    // 1. 检查NFT所有权
    console.log('\n1. 检查NFT所有权...');
    const owner = await myTokenContract.ownerOf(tokenId);
    console.log(`NFT ${tokenId}的所有者: ${owner}`);
    
    // 检查NFT是否在用户账户或合约账户中
    const isUserOwner = owner.toLowerCase() === signer.address.toLowerCase();
    const isContractOwner = owner.toLowerCase() === sourceNetwork.nftPoolLockAndRelease.toLowerCase();
    
    if (!isUserOwner && !isContractOwner) {
      console.log('❌ 您不是此NFT的所有者，且NFT不在跨链合约中');
      console.log('提示: 请确保您拥有此NFT或NFT已锁定在跨链合约中');
      return;
    }
    
    if (isContractOwner) {
      console.log('✅ NFT已锁定在跨链合约中，将直接执行跨链操作');
    }
    
    // 2. 授权NFT给合约（只有当NFT不在合约中时才需要）
    if (isUserOwner) {
      console.log('\n2. 授权NFT给合约...');
      try {
        const approveTx = await myTokenContract.approve(sourceNetwork.nftPoolLockAndRelease, tokenId);
        await approveTx.wait(1);
        console.log('✅ NFT授权成功');
        
        // 验证授权
        const approvedAddress = await myTokenContract.getApproved(tokenId);
        console.log(`授权地址: ${approvedAddress}`);
        if (approvedAddress.toLowerCase() !== sourceNetwork.nftPoolLockAndRelease.toLowerCase()) {
          console.log('❌ 授权验证失败');
          return;
        }
      } catch (error) {
        console.error('❌ NFT授权失败:', error.message);
        return;
      }
    } else {
      console.log('\n2. 授权NFT给合约...');
      console.log('✅ NFT已在合约中，跳过授权步骤');
    }
    
    // 3. 检查合约的LINK余额
    console.log('\n3. 检查合约的LINK余额...');
    const contractLinkBalance = await linkTokenContract.balanceOf(sourceNetwork.nftPoolLockAndRelease);
    console.log(`合约LINK余额: ${ethers.formatEther(contractLinkBalance)} LINK`);
    
    // 4. 预估CCIP费用
    console.log('\n4. 预估CCIP费用...');
    const payload = ethers.AbiCoder.defaultAbiCoder().encode(
      ['uint256', 'address'], 
      [tokenId, signer.address]
    );
    
    try {
      const estimatedFee = await nftPoolContract.estimateFee(
        destNetwork.companionChainSelector, 
        destNetwork.nftPoolMintAndBurn, 
        payload
      );
      console.log(`预估费用: ${ethers.formatEther(estimatedFee)} LINK`);
      
      // 如果余额不足，提示用户存款
      if (contractLinkBalance < estimatedFee) {
        const amountNeeded = estimatedFee - contractLinkBalance;
        console.log(`⚠️ 合约LINK余额不足，需要额外: ${ethers.formatEther(amountNeeded)} LINK`);
        console.log('提示: 您可以使用以下命令存款LINK到合约:');
        console.log(`npx hardhat deposit-link --amount ${ethers.formatEther(amountNeeded)} --network sepolia`);
        return;
      }
    } catch (error) {
      console.error('❌ 费用预估失败:', error.message);
      console.log('将使用默认费用进行操作...');
    }
    
    // 5. 执行NFT跨链操作
    console.log('\n5. 执行NFT跨链操作...');
    try {
      const tx = await nftPoolContract.lockAndSendNFT(
        tokenId,
        signer.address, // 新所有者地址（在目标链上）
        destNetwork.companionChainSelector, // 目标链选择器
        destNetwork.nftPoolMintAndBurn, // 目标链接收器地址
        {
          gasLimit: 2000000, // 增加gas limit确保交易成功
          gasPrice: ethers.parseUnits('50', 'gwei')
        }
      );
      
      console.log('交易已发送，等待确认...');
      console.log(`交易哈希: ${tx.hash}`);
      
      const receipt = await tx.wait(1);
      console.log('✅ NFT跨链操作成功!');
      console.log(`区块号: ${receipt.blockNumber}`);
      
      // 检查事件
      console.log('\n交易事件:');
      receipt.logs.forEach((log, index) => {
        try {
          const parsedLog = nftPoolContract.interface.parseLog(log);
          console.log(`事件 ${index + 1}: ${parsedLog.name}`);
          // 特别关注MessageSent事件
          if (parsedLog.name === 'MessageSent') {
            console.log(`  消息ID: ${parsedLog.args.messageId}`);
            console.log(`  目标链: ${parsedLog.args.destinationChainSelector}`);
            console.log(`  接收器: ${parsedLog.args.receiver}`);
            console.log(`  费用: ${ethers.formatEther(parsedLog.args.fees)} LINK`);
          }
        } catch (e) {
          // 忽略无法解析的日志
        }
      });
      
      // 验证NFT所有权已转移
      const newOwner = await myTokenContract.ownerOf(tokenId);
      console.log('\n6. 验证NFT所有权转移...');
      console.log(`NFT新所有者: ${newOwner}`);
      console.log(`是否已转移到合约: ${newOwner.toLowerCase() === sourceNetwork.nftPoolLockAndRelease.toLowerCase()}`);
      
      console.log('\n🎉 测试完成！NFT跨链操作已成功执行。');
      console.log('提示: 跨链交易可能需要几分钟时间才能到达目标链，请耐心等待。');
      console.log(`您可以在目标链(Holesky)上检查WrappedMyToken合约，查看您的跨链NFT。`);
      
    } catch (error) {
      console.error('❌ NFT跨链操作失败:', error.message);
      
      // 详细错误信息
      if (error.data) {
        try {
          const decodedError = nftPoolContract.interface.parseError(error.data);
          console.log('错误详情:', decodedError.name, decodedError.args);
        } catch (e) {
          console.log('原始错误数据:', error.data);
        }
      }
      
      // 如果有交易哈希，显示出来
      if (error.transaction?.hash) {
        console.log(`交易哈希: ${error.transaction.hash}`);
      }
    }
    
  } catch (error) {
    console.error('❌ 发生错误:', error.message);
  }
}

// 执行主函数
main();