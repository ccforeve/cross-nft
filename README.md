# Coress NFT（Chainlink CCIP 跨链示例）

本项目演示如何使用 Chainlink CCIP 在以太坊测试网（Sepolia ↔ Holesky）之间跨链转移 NFT，支持锁定-释放与铸造-销毁两种路径。基于 Hardhat 与 hardhat-deploy。

## 快速开始

1) 安装依赖

```bash
npm i
```

2) 配置环境变量（创建 `.env`，可参考下方示例）

```ini
PRIVATE_KEY=
SEPOLIA_RPC_URL=
HOLESKY_RPC_URL=
```

3) 编译

```bash
npx hardhat compile
```

## 常用命令

- 编译：`npx hardhat compile`
- 部署（Sepolia）：`npx hardhat deploy --network sepolia`
- 部署（Holesky）：`npx hardhat deploy --network holesky`
- 查看帮助：`npx hardhat help`

## 跨链示例：锁定并发送 NFT

从当前网络将 NFT 跨链发送至对端（默认会依据 `helper-hardhat-config.js` 推导目标链 selector 与接收合约）。

```bash
npx hardhat lock-and-cross --network sepolia --tokenid 1

# 如需手动指定参数
npx hardhat lock-and-cross \
  --network sepolia \
  --tokenid 1 \
  --chainselector 16015286601757825753 \
  --receiver 0xReceiverOnDest
```

注意：源链池合约需要有足额 LINK 支付 CCIP 费用；脚本会尝试从当前账户补足。

## 推送到 GitHub

项目已配置 `.gitignore` 忽略常见产物（如 `node_modules/`、`artifacts/`、`cache/` 等）。如确需提交构建产物，请修改 `.gitignore` 后重新提交。

```bash
git add -A
git commit -m "docs: update README and env example"
git push
```

## 目录说明

### 核心合约 (contracts/)
- `MyToken.sol`：基础 NFT 合约，用于在源链（Sepolia）上创建和管理 NFT
- `NFTPoolLockAndRelease.sol`：锁定-释放模式的跨链池合约，负责锁定源链 NFT 并通过 CCIP 发送跨链消息
- `WrappedMyToken.sol`：目标链上的封装 NFT 合约，代表从源链跨链过来的 NFT
- `NFTPoolMintAndBurn.sol`：铸造-销毁模式的跨链池合约，负责在目标链铸造新的封装 NFT
- `NFTReceive.sol`：接收链上的消息处理器，负责处理来自 CCIP 的跨链消息
- `NFTSender.sol`：发送链上的消息发送器，负责构建和发送 CCIP 消息
- `CCIPSimulator.sol`：CCIP 协议的本地模拟器，用于测试环境中的跨链功能模拟

### 部署脚本 (deploy/)
- `0_deploy_ccip_simulator.js`：部署 CCIP 模拟器（本地测试用）
- `1_deploy_nft.js`：部署基础 NFT 合约
- `2_deploy_pool_lock_and_release.js`：部署锁定-释放模式的跨链池合约
- `3_deploy_wnft.js`：部署封装 NFT 合约
- `4_deploy_pool_mint_and_burn.js`：部署铸造-销毁模式的跨链池合约

### 部署结果 (deployments/)
- `sepolia/`：Sepolia 网络上的合约部署信息和构建输入
- `holoesky/`：Holesky 网络上的合约部署信息和构建输入

### 辅助脚本 (scripts/)
- `deploy.js`：主要部署脚本，协调多个合约的部署过程
- `approve-link-to-router.js`：批准 Router 合约使用 LINK 代币用于支付 CCIP 费用
- `ccip-debug.js`：CCIP 功能调试脚本，用于排查跨链问题
- `minimal-deploy.js`：最小化部署脚本，仅包含核心功能
- `simple-deploy-wnft.js`：简化版封装 NFT 部署脚本
- `test-ccip-transfer.js`：测试 CCIP 跨链转账功能
- `test-router-fee.js`：测试 Router 合约的费用计算
- `verify-router.js`：验证 Router 合约配置是否正确

### 自定义任务 (task/)
- `index.js`：任务注册入口文件
- `check-nft.js`：检查 NFT 信息的任务
- `deposit-link.js`：向跨链池存入 LINK 代币的任务
- `lock-and-cross.js`：锁定并跨链发送 NFT 的任务
- `mint-nft.js`：铸造 NFT 的任务

### 诊断工具 (diagnostics/)
- `check-matic-balance.js`：检查 Polygon Amoy 网络的 MATIC 余额
- `check-link-balance.js`：检查 LINK 代币余额
- `check-chain-selector.js`：检查链选择器值
- `simple-check-chain-selector.js`：简化版链选择器检查脚本
- `check-receiver-address.js`：检查接收地址有效性
- `check-ccip-fee-sufficiency.js`：检查 CCIP 跨链交易费用是否充足

### 项目文档 (docs/)
- `amoy-deployment-status.md`：Polygon Amoy 网络部署状态记录
- `ccip-fix-solution.md`：CCIP 相关问题修复方案
- `polygon-amoy-faucet-info.md`：Polygon Amoy 测试网络水龙头信息

