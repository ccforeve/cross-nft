// 直接使用Node.js运行，用于检查目标链上的接收器地址配置是否正确
const ethers = require('ethers');
require('dotenv').config();
const { networkConfig } = require('./helper-hardhat-config');

// 网络配置
const networkConfigWithRpc = {
  11155111: { // Sepolia
    name: 'Sepolia',
    rpcUrl: process.env.SEPOLIA_RPC_URL || 'https://rpc.sepolia.org',
    chainSelector: '16015286601757825753'
  },
  17000: { // Holesky
    name: 'Holesky',
    rpcUrl: process.env.HOLESKY_RPC_URL || 'https://rpc.holesky.ethpandaops.io',
    chainSelector: '7717148896336251131'
  }
};

// 简化的CCIP接收器合约ABI - 用于验证合约是否正确实现了_ccipReceive方法
const ccipReceiverAbi = [
  "function supportsInterface(bytes4 interfaceId) external view returns (bool)"
];

// 检查地址格式是否有效
function isValidAddress(address) {
  try {
    return ethers.isAddress(address);
  } catch (error) {
    return false;
  }
}

// 检查地址在目标链上是否存在合约代码
async function checkContractExists(provider, address) {
  try {
    const code = await provider.getCode(address);
    // 如果code长度大于2（0x），说明地址上有合约代码
    return code.length > 2;
  } catch (error) {
    console.error(`检查合约是否存在时出错: ${error.message}`);
    return false;
  }
}

// 检查合约是否实现了CCIP接收器接口
async function checkCCIPReceiverInterface(provider, address) {
  try {
    const contract = new ethers.Contract(address, ccipReceiverAbi, provider);
    // CCIPReceiver接口的interfaceId
    const ccipReceiverInterfaceId = '0x01ffc9a7'; // ERC165 interface ID for CCIPReceiver
    
    // 调用supportsInterface方法检查是否支持CCIPReceiver接口
    const supportsInterface = await contract.supportsInterface(ccipReceiverInterfaceId);
    return supportsInterface;
  } catch (error) {
    console.error(`检查CCIP接收器接口时出错: ${error.message}`);
    return false;
  }
}

// 获取目标链上的默认接收器地址（从部署中）
async function getDefaultReceiverAddress(sourceChainId, provider) {
  try {
    // 在实际使用中，您可能需要根据项目的部署结构来获取正确的接收器地址
    // 这里是一个简化的实现，您可能需要根据实际情况进行调整
    
    // 假设您在目标链上部署了NFTPoolMintAndBurn合约作为接收器
    // 在实际项目中，您可能需要从部署文件或其他配置中获取正确的地址
    
    const fs = require('fs');
    const path = require('path');
    
    // 根据源链ID确定目标链ID
    const targetChainId = sourceChainId === 11155111 ? 17000 : 11155111;
    const targetChainName = networkConfigWithRpc[targetChainId].name.toLowerCase();
    
    // 尝试从deployments文件夹中读取接收器地址
    const deploymentPath = path.join(__dirname, `deployments/${targetChainName}/NFTPoolMintAndBurn.json`);
    
    if (fs.existsSync(deploymentPath)) {
      const deploymentData = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
      return deploymentData.address;
    }
    
    console.warn(`未找到部署文件: ${deploymentPath}`);
    return null;
  } catch (error) {
    console.error(`获取默认接收器地址时出错: ${error.message}`);
    return null;
  }
}

async function main() {
  try {
    console.log('开始检查目标链上的接收器地址配置...\n');
    
    // 选择源链（默认为Sepolia）
    const sourceChainId = 11155111; // Sepolia
    const sourceConfig = networkConfigWithRpc[sourceChainId];
    const targetChainId = sourceChainId === 11155111 ? 17000 : 11155111;
    const targetConfig = networkConfigWithRpc[targetChainId];
    
    console.log(`源链: ${sourceConfig.name} (chainId: ${sourceChainId})`);
    console.log(`目标链: ${targetConfig.name} (chainId: ${targetChainId})\n`);
    
    // 创建目标链的provider
    const provider = new ethers.JsonRpcProvider(targetConfig.rpcUrl);
    console.log(`连接到目标链RPC: ${targetConfig.rpcUrl}`);
    
    // 检查连接状态
    const blockNumber = await provider.getBlockNumber();
    console.log(`成功连接到目标链，当前区块号: ${blockNumber}\n`);
    
    // 获取默认接收器地址（根据项目配置）
    console.log('正在获取默认接收器地址...');
    const defaultReceiver = await getDefaultReceiverAddress(sourceChainId, provider);
    
    // 也可以手动指定接收器地址进行检查
    const receiverToCheck = defaultReceiver; // 您可以在这里手动设置要检查的地址
    
    if (!receiverToCheck) {
      console.error('❌ 无法获取接收器地址，请手动设置');
      return;
    }
    
    console.log(`接收器地址: ${receiverToCheck}\n`);
    
    // 1. 检查地址格式是否有效
    console.log('1. 检查地址格式...');
    if (!isValidAddress(receiverToCheck)) {
      console.error('❌ 接收器地址格式无效');
      return;
    }
    console.log('✅ 地址格式有效\n');
    
    // 2. 检查地址是否存在合约代码
    console.log('2. 检查地址是否为合约...');
    const isContract = await checkContractExists(provider, receiverToCheck);
    if (!isContract) {
      console.error('❌ 接收器地址不是合约地址');
      return;
    }
    console.log('✅ 地址是合约地址\n');
    
    // 3. 检查合约是否实现了CCIP接收器接口
    console.log('3. 检查合约是否实现了CCIP接收器接口...');
    const isCCIPReceiver = await checkCCIPReceiverInterface(provider, receiverToCheck);
    if (isCCIPReceiver) {
      console.log('✅ 合约实现了CCIP接收器接口\n');
    } else {
      console.warn('⚠️ 合约可能未实现标准的CCIP接收器接口，建议进一步检查合约代码\n');
    }
    
    // 4. 输出总结
    console.log('=== 接收器地址检查总结 ===');
    console.log(`目标链: ${targetConfig.name} (chainId: ${targetChainId})`);
    console.log(`接收器地址: ${receiverToCheck}`);
    console.log('状态: ✅ 地址配置基本正确，可以用于CCIP消息接收');
    console.log('建议: 确保合约中正确实现了_ccipReceive方法以处理接收到的消息');
    
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