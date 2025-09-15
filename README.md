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

- `contracts/`：核心合约（NFT、跨链池、接收/发送器、模拟器）
- `deploy/`：分步骤部署脚本
- `deployments/`：各网络部署结果与 solc 输入
- `task/`：Hardhat 自定义任务（如 `lock-and-cross`）

