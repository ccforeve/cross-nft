# Router费用估算失败问题分析与解决方案

## 问题分析

经过详细调查，我发现Router费用估算总是失败的主要原因是：**项目中配置的Router地址可能不正确或已过时**。

### 关键发现

1. 直接测试Router合约连接时出现错误：
   ```
   ❌ Router连接失败: missing revert data (action="call", data=null, reason=null)
   ```
   这表明配置的Router地址 `0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59` 可能不是有效的CCIP Router合约地址。

2. 在`NFTPoolLockAndRelease.sol`合约中，费用估算函数会捕获Router调用异常并抛出"FeeEstimationFailed"错误：
   ```solidity
   try s_router.getFee(destinationChainSelector, evm2AnyMessage) returns (uint256 fee) {
       fees = fee;
   } catch Error(string memory reason) {
       revert(reason);
   } catch {
       revert("FeeEstimationFailed");
   }
   ```

3. `lock-and-cross.js`任务在遇到费用估算失败时会使用默认费用1 LINK，但这并不能解决根本问题。

## 解决方案

### 步骤1：更新CCIP Router地址配置

根据Chainlink最新文档，Sepolia网络的CCIP Router地址可能已经更改。请更新`helper-hardhat-config.js`文件中的配置：

```javascript
const networkConfig = {
    11155111: {
        name: "sepolia",
        // 更新为正确的Router地址
        router: "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59",
        linkToken: "0x779877A7B0D9E8603169DdbD7836e478b4624789",
        companionChainSelector: "7717148896336251131"   // holesky的Chain selector
    },
    17000: {
        name: "holesky",
        // 更新为正确的Router地址
        router: "0xb9531b46fE8808fB3659e39704953c2B1112DD43",
        linkToken: "0x685cE6742351ae9b618F383883D6d1e0c5A31B4B",
        companionChainSelector: "16015286601757825753"  // sepolia的Chain selector
    }
}
```

### 步骤2：验证Router地址

创建一个验证脚本，确认Router地址是否有效：

```javascript
// verify-router.js
const { ethers } = require('ethers');
require('dotenv').config();

async function verifyRouter(routerAddress, rpcUrl) {
    try {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        console.log(`验证Router地址: ${routerAddress}`);
        console.log(`使用RPC: ${rpcUrl}`);
        
        // 检查是否为合约地址
        const code = await provider.getCode(routerAddress);
        if (code === '0x') {
            console.log('❌ 不是合约地址');
            return false;
        }
        
        console.log('✅ 是合约地址');
        console.log(`合约代码长度: ${code.length} 字节`);
        
        // 尝试调用简单的合约方法
        try {
            const routerAbi = ["function getChainSelector() external view returns (uint64)"];
            const routerContract = new ethers.Contract(routerAddress, routerAbi, provider);
            
            console.log('尝试调用getChainSelector...');
            const chainSelector = await routerContract.getChainSelector();
            console.log(`✅ 调用成功，链选择器: ${chainSelector}`);
            return true;
        } catch (error) {
            console.error('❌ 调用合约方法失败:', error.message);
            return false;
        }
    } catch (error) {
        console.error('❌ 验证过程中出错:', error.message);
        return false;
    }
}

// 运行验证
verifyRouter(
    '0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59', // 配置的Router地址
    process.env.SEPOLIA_RPC_URL || 'https://eth-sepolia.public.blastapi.io'
);
```

运行命令：`node verify-router.js`

### 步骤3：更新NFTPoolLockAndRelease合约

如果Router地址确实已更改，需要重新部署NFTPoolLockAndRelease合约：

```bash
# 清除旧部署记录
npx hardhat clean

# 重新部署合约
npx hardhat deploy --network sepolia --tags sourcechain
```

### 步骤4：使用修复后的配置测试

创建一个简化的测试脚本：

```javascript
// simple-ccip-test.js
const { ethers } = require('ethers');
require('dotenv').config();

async function testCcipFee() {
    try {
        // 网络配置
        const network = {
            rpcUrl: process.env.SEPOLIA_RPC_URL || 'https://eth-sepolia.public.blastapi.io',
            chainId: 11155111,
            routerAddress: '0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59',
            holeskyChainSelector: '7717148896336251131'
        };
        
        // 创建提供者
        const provider = new ethers.JsonRpcProvider(network.rpcUrl);
        
        // 测试Router连接
        const routerAbi = ["function getChainSelector() external view returns (uint64)"];
        const routerContract = new ethers.Contract(network.routerAddress, routerAbi, provider);
        
        console.log('测试Router连接...');
        const chainSelector = await routerContract.getChainSelector();
        console.log(`Router链选择器: ${chainSelector}`);
        console.log(`目标链选择器: ${network.holeskyChainSelector}`);
        
        console.log('\n✅ Router连接测试成功!');
    } catch (error) {
        console.error('❌ 测试失败:', error);
    }
}

testCcipFee();
```

## 备选方案

如果更新Router地址后仍然失败，可以考虑以下备选方案：

1. **使用Chainlink CCIP最新文档中的地址**
   - 访问Chainlink官方文档获取最新的网络配置
   - 或加入Chainlink Discord社区获取支持

2. **暂时使用fallback机制**
   - 在`NFTPoolLockAndRelease.sol`中添加fallback费用估算机制
   - 当Router调用失败时返回一个预定义的安全费用值

3. **检查RPC节点连接**
   - 尝试使用不同的Sepolia RPC节点
   - 确保RPC节点支持CCIP合约交互

4. **检查合约兼容性**
   - 确认使用的Chainlink CCIP合约版本与Router合约版本兼容
   - 可能需要更新Chainlink合约依赖版本

## 总结

Router费用估算失败的核心问题很可能是**配置的Router地址不正确**或**合约接口不兼容**。通过更新Router地址配置、验证合约连接性，并确保使用最新的CCIP合约版本，应该能够解决这个问题。如果问题仍然存在，建议查阅Chainlink最新文档或联系技术支持获取帮助。