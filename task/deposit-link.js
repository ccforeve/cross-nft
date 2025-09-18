const { task } = require("hardhat/config");
const { networkConfig } = require("../helper-hardhat-config");

/**
 * 向NFTPoolLockAndRelease合约充值LINK代币任务
 * 参数:
 * - amount: 要充值的LINK代币数量（必填）
 * - targetNetwork: 网络名称（可选，默认使用当前网络）
 * - json: 输出结构化JSON格式（可选）
 */
task("deposit-link")
    .addParam("amount", "amount of LINK to deposit")
    .addOptionalParam("targetNetwork", "network name")
    .addFlag("json", "output structured JSON summary only")
    .setAction(async (taskArgs, hre) => {
        const { getNamedAccounts, deployments, ethers } = hre;
        const { firstAccount } = await getNamedAccounts();
        const summary = {
            network: hre.network.name,
            sender: firstAccount,
            amountLINK: taskArgs.amount,
            txHash: undefined,
            success: false
        };

        try {
            // 验证金额参数
            let amount;
            try {
                if (taskArgs.amount === undefined || taskArgs.amount === null || taskArgs.amount === "") {
                    throw new Error("amount is required");
                }
                amount = ethers.parseEther(taskArgs.amount);
            } catch (e) {
                const msg = `Invalid amount: ${taskArgs.amount}`;
                if (taskArgs.json) {
                    console.log(JSON.stringify({ ok: false, error: msg }));
                    return;
                }
                console.error("❌", msg);
                return;
            }

            console.log(`Starting deposit-link task on ${hre.network.name}...`);
            console.log(`Sender account: ${firstAccount}`);
            console.log(`Amount to deposit: ${taskArgs.amount} LINK`);

            // 获取合约实例
            console.log("Getting NFTPoolLockAndRelease deployment...");
            const nftPoolLockAndReleaseDeployment = await deployments.get("NFTPoolLockAndRelease");
            console.log(`NFTPoolLockAndRelease address: ${nftPoolLockAndReleaseDeployment.address}`);
            
            console.log("Creating NFTPoolLockAndRelease contract instance...");
            const nftPoolLockAndRelease = await ethers.getContractAt(
                "NFTPoolLockAndRelease",
                nftPoolLockAndReleaseDeployment.address,
                firstAccount
            );

            // 获取LinkToken合约实例
            console.log("Getting LinkToken contract instance...");
            const linkTokenAddress = networkConfig[hre.network.config.chainId].linkToken;
            console.log(`LinkToken address: ${linkTokenAddress}`);
            // 使用ethers.getContract来创建合约实例
            const linkToken = await ethers.getContractAt("LinkTokenInterface", linkTokenAddress);
            // 将合约连接到firstAccount
            const linkTokenWithSigner = linkToken.connect((await ethers.getSigners())[0]);

            // 检查余额
            console.log("Checking sender's LINK balance...");
            const senderBalance = await linkTokenWithSigner.balanceOf(firstAccount);
            console.log(`Sender's current LINK balance: ${ethers.formatEther(senderBalance)}`);
            
            if (senderBalance < amount) {
                const msg = `Insufficient LINK balance: ${ethers.formatEther(senderBalance)} < ${ethers.formatEther(amount)}`;
                if (taskArgs.json) {
                    console.log(JSON.stringify({ ok: false, error: msg }));
                    return;
                }
                console.error("❌", msg);
                return;
            }

            // 两种充值方式可选：直接转账或调用depositLink函数
            // 1. 直接转账方式（与lock-and-cross.js中的逻辑一致）
            console.log(`Transferring ${ethers.formatEther(amount)} LINK to contract...`);
            const transferTx = await linkTokenWithSigner.transfer(
                nftPoolLockAndRelease.target, 
                amount
            );
            
            console.log("Transfer transaction sent, waiting for confirmation...");
            const receipt = await transferTx.wait(2);
            
            // 2. 使用depositLink函数方式（需要先授权）
            /*
            console.log(`Approving ${ethers.formatEther(amount)} LINK to contract...`);
            const approveTx = await linkToken.approve(nftPoolLockAndRelease.target, amount);
            await approveTx.wait(1);
            
            console.log(`Depositing ${ethers.formatEther(amount)} LINK to contract...`);
            const depositTx = await nftPoolLockAndRelease.depositLink(amount);
            console.log("Deposit transaction sent, waiting for confirmation...");
            const receipt = await depositTx.wait(2);
            */

            console.log("✅ LINK transfer successful!");
            console.log(`Transaction hash: ${receipt.hash}`);
            
            // 检查合约余额更新
            console.log("Checking contract's LINK balance after deposit...");
            const contractBalance = await linkTokenWithSigner.balanceOf(nftPoolLockAndRelease.target);
            console.log(`Contract's current LINK balance: ${ethers.formatEther(contractBalance)}`);

            summary.txHash = receipt.hash;
            summary.success = true;
            
            const result = { ok: true, ...summary };
            console.log(taskArgs.json ? JSON.stringify(result) : result);
            
        } catch (error) {
            console.error("❌ Deposit failed:", error);
            
            // 详细解析错误
            if (error.data) {
                try {
                    const decodedError = linkToken.interface.parseError(error.data);
                    console.log("Error details:", decodedError.name, decodedError.args);
                } catch (e) {
                    console.log("Raw error data:", error.data);
                }
            }
            const result = { ok: false, error: String(error?.message || error), ...summary };
            console.log(taskArgs.json ? JSON.stringify(result) : result);
        }
    });

module.exports = {};