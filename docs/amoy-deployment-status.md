# Polygon Amoy网络部署状态总结

## 当前状态
1. **网络配置已更新**：
   - 已在`helper-hardhat-config.js`中配置了Polygon Amoy网络（chainId: 80002）的router、linkToken和companionChainSelector
   - 已在`hardhat.config.js`中添加了Polygon Amoy网络配置，并将Sepolia网络的companionNetworks指向amoy
   - 已添加gas和gasPrice设置优化部署参数

2. **部署失败原因**：
   - 最新错误：`insufficient funds for gas * price + value: balance 100000000000000000, tx cost 265061700000000000, overshot 165061700000000000`
   - 详细分析：账户有0.1 MATIC，但部署WrappedMyToken合约需要约0.266 MATIC
   - 差额：需要额外约0.166 MATIC

## 部署账户信息
- 部署账户地址：`0xfF266A6A5d969393C878FB54217807571EA4193C`
- 当前余额：`0.1 MATIC`
- 所需余额：至少`0.3 MATIC`

## 获取测试MATIC的建议
请获取更多Polygon Amoy测试网的测试MATIC（至少0.3 MATIC以确保足够）：

1. **官方水龙头**：
   - Polygon官方水龙头：https://faucet.polygon.technology/
   - 选择"Amoy"网络和"MATIC"代币类型
   - 输入你的钱包地址，完成验证后获取测试币

2. **Chainlink Faucet**：
   - https://faucets.chain.link/amoy
   - 可同时获取MATIC和LINK代币（用于CCIP跨链操作）

3. **Discord社区**：
   - 加入Polygon官方Discord社区，在指定频道请求测试MATIC

## 下一步操作建议
1. **获取更多测试MATIC**：通过上述方法获取资金到部署账户

2. **验证余额**：使用`npx hardhat run check-matic-balance.js --network amoy`确认余额充足

3. **再次尝试部署**：获取资金后，运行以下命令重新部署目标链合约：
   ```bash
   npx hardhat deploy --network amoy --tags destchain
   ```

4. **执行跨链操作**：部署成功后，可以使用`lock-and-cross`任务进行NFT跨链操作

## 部署验证
成功部署后，合约信息将保存在`deployments/amoy/`目录下。

## 注意事项
- 测试网代币没有实际价值，仅用于开发和测试
- 不同测试网的代币不能互相转换
- 如果您在获取测试MATIC过程中遇到困难，可以尝试使用项目中已配置的Sepolia网络继续开发和测试工作。