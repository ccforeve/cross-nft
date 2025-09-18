const { ethers } = require('ethers');
require('dotenv').config();

async function verifyRouter(routerAddress, rpcUrl) {
    try {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        console.log(`🔍 验证Router地址: ${routerAddress}`);
        console.log(`🌐 使用RPC: ${rpcUrl}`);
        
        // 检查是否为合约地址
        console.log('\n1. 检查是否为合约地址...');
        const code = await provider.getCode(routerAddress);
        if (code === '0x') {
            console.log('❌ 不是合约地址 - 这是Router估算费用失败的主要原因');
            return false;
        }
        
        console.log('✅ 是合约地址');
        console.log(`   合约代码长度: ${code.length} 字节`);
        
        // 检查网络连接状态
        console.log('\n2. 检查网络连接状态...');
        const blockNumber = await provider.getBlockNumber();
        console.log(`✅ 当前区块高度: ${blockNumber}`);
        
        // 尝试调用简单的合约方法
        console.log('\n3. 尝试调用getChainSelector方法...');
        try {
            const routerAbi = ["function getChainSelector() external view returns (uint64)"];
            const routerContract = new ethers.Contract(routerAddress, routerAbi, provider);
            
            const startTime = Date.now();
            const chainSelector = await routerContract.getChainSelector();
            const duration = Date.now() - startTime;
            
            console.log(`✅ 调用成功! 耗时: ${duration}ms`);
            console.log(`   链选择器: ${chainSelector}`);
            
            // 验证链选择器格式
            if (typeof chainSelector === 'bigint' && chainSelector > 0) {
                console.log('✅ 链选择器格式正确');
            } else {
                console.log('⚠️  链选择器格式可能不正确');
            }
            
            return true;
        } catch (error) {
            console.error('❌ 调用合约方法失败:');
            console.error(`   ${error.message}`);
            
            // 提供详细的错误分析
            if (error.code === 'CALL_EXCEPTION') {
                console.log('\n💡 错误分析:');
                console.log('   - 可能的原因1: Router地址错误或合约不支持此方法');
                console.log('   - 可能的原因2: 合约ABI不匹配');
                console.log('   - 可能的原因3: RPC节点连接问题');
            }
            
            return false;
        }
    } catch (error) {
        console.error('❌ 验证过程中出现整体错误:');
        console.error(`   ${error.message}`);
        return false;
    }
}

// 运行验证
async function main() {
    console.log('\n====================================');
    console.log('        CCIP Router 验证工具        ');
    console.log('====================================\n');
    
    // 配置的Router地址
    const routerAddress = '0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59';
    const rpcUrl = process.env.SEPOLIA_RPC_URL || 'https://eth-sepolia.public.blastapi.io';
    
    const isValid = await verifyRouter(routerAddress, rpcUrl);
    
    console.log('\n====================================');
    console.log('              验证结果              ');
    console.log('====================================');
    
    if (isValid) {
        console.log('✅ Router地址验证成功');
        console.log('   费用估算失败可能是由于其他原因，如:');
        console.log('   - 链选择器配置错误');
        console.log('   - 消息格式不正确');
        console.log('   - 合约余额不足');
    } else {
        console.log('❌ Router地址验证失败');
        console.log('   请更新helper-hardhat-config.js中的Router地址');
        console.log('   建议: 查阅Chainlink最新文档获取正确的CCIP配置');
    }
    
    console.log('====================================\n');
}

main();