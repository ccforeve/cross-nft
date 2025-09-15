const { task } = require("hardhat/config");
const { networkConfig } = require("../helper-hardhat-config");

task("lock-and-cross")
    .addOptionalParam("chainselector", "chain selector of dest chain")
    .addOptionalParam("receiver", "receiver address of dest chain")
    .addParam("tokenid", "tokenid to be cross chain")
    .setAction(async (taskArgs, hre) => {
        const { getNamedAccounts, deployments, ethers } = hre;
        const { firstAccount } = await getNamedAccounts();
        const tokenId = taskArgs.tokenid;
        
        console.log("Starting lock-and-cross task...");
        console.log("Token ID:", tokenId);
        console.log("First account:", firstAccount);
        
        // 1. 获取配置
        let chainselector, receiver;
        if (taskArgs.chainselector) {
            chainselector = taskArgs.chainselector;
            console.log("Using provided chainselector:", chainselector);
        } else {
            chainselector = networkConfig[hre.network.config.chainId].companionChainSelector;
            console.log("Using default chainselector from config:", chainselector);
        }
        
        if (taskArgs.receiver) {
            receiver = taskArgs.receiver;
            console.log("Using provided receiver:", receiver);
        } else {
            console.log("Getting receiver from companion network...");
            const nftPoolMintAndBurnDeployment = await hre.companionNetworks["destChain"].deployments.get("NFTPoolMintAndBurn");
            receiver = nftPoolMintAndBurnDeployment.address;
            console.log("Using default receiver from companion network:", receiver);
        }

        // 2. 获取合约实例
        try {
            console.log("Getting NFTPoolLockAndRelease deployment...");
            const nftPoolLockAndReleaseDeployment = await deployments.get("NFTPoolLockAndRelease");
            console.log("NFTPoolLockAndRelease deployment address:", nftPoolLockAndReleaseDeployment.address);
            
            console.log("Creating NFTPoolLockAndRelease contract instance...");
            const nftPoolLockAndRelease = await ethers.getContractAt(
                "NFTPoolLockAndRelease",
                nftPoolLockAndReleaseDeployment.address,
                firstAccount
            );
            console.log("NFTPoolLockAndRelease instance created at:", nftPoolLockAndRelease.target);
            
            console.log("Getting LinkToken contract instance...");
            const linkTokenAddress = networkConfig[hre.network.config.chainId].linkToken;
            console.log("LinkToken address:", linkTokenAddress);
            const linkToken = await ethers.getContractAt("LinkToken", linkTokenAddress, firstAccount);
            console.log("LinkToken instance created at:", linkToken.target);
            
            console.log("Getting MyToken contract instance...");
            const nft = await ethers.getContract("MyToken", firstAccount);
            console.log("MyToken instance created at:", nft.target);

            // 3. 构建 payload
            const payload = ethers.AbiCoder.defaultAbiCoder().encode(
                ["uint256", "address"], 
                [tokenId, firstAccount]
            );

            // 4. 预估费用
            let estimatedFee;
            try {
                console.log("Estimating fee...");
                estimatedFee = await nftPoolLockAndRelease.estimateFee(
                    chainselector,
                    receiver,
                    payload
                );
                console.log(`Estimated fee: ${ethers.formatEther(estimatedFee)} LINK`);
            } catch (error) {
                console.error("❌ Fee estimation failed:", error);
                estimatedFee = ethers.parseEther("1");
                console.log(`Using default fee: ${ethers.formatEther(estimatedFee)} LINK`);
            }

            // 5. 确保合约有足够的 LINK
            let currentBalance;
            try {
                console.log("Checking LINK balance...");
                currentBalance = await linkToken.balanceOf(nftPoolLockAndRelease.target);
                console.log(`Current LINK balance: ${ethers.formatEther(currentBalance)}`);
            } catch (error) {
                console.error("❌ LINK balance check failed:", error);
                currentBalance = ethers.parseEther("0");
            }
            
            // 确保所有值都是 BigInt 类型
            if (currentBalance < estimatedFee) {
                const amountNeeded = estimatedFee - currentBalance + ethers.parseEther("1");
                console.log(`Transferring ${ethers.formatEther(amountNeeded)} LINK to contract...`);
                
                try {
                    console.log("Sending LINK transfer transaction...");
                    const transferTx = await linkToken.transfer(
                        nftPoolLockAndRelease.target, 
                        amountNeeded
                    );
                    console.log("Transfer transaction sent, waiting for confirmation...");
                    await transferTx.wait(2);
                    console.log("✅ LINK transfer successful");
                } catch (error) {
                    console.error("❌ LINK transfer failed:", error);
                }
            }

            // 6. 授权 NFT
            console.log("Approving NFT...");
            try {
                const approveTx = await nft.approve(nftPoolLockAndRelease.target, tokenId);
                await approveTx.wait(1);
                console.log("✅ Single token approval successful");
            } catch (error) {
                console.log("Single approval failed, trying setApprovalForAll...");
                try {
                    const approveAllTx = await nft.setApprovalForAll(nftPoolLockAndRelease.target, true);
                    await approveAllTx.wait(1);
                    console.log("✅ SetApprovalForAll successful");
                } catch (error) {
                    console.error("❌ NFT approval failed:", error);
                    return; // 如果授权失败，终止任务
                }
            }

            // 7. 执行跨链锁定
            try {
                console.log("Locking and sending NFT...");
                const tx = await nftPoolLockAndRelease.lockAndSendNFT(
                    tokenId,
                    firstAccount,
                    chainselector,
                    receiver,
                    {
                        gasLimit: 1_500_000 // 大幅增加 Gas Limit
                    }
                );
                
                console.log("Transaction sent, waiting for confirmation...");
                const receipt = await tx.wait();
                console.log("✅ Transaction successful!");
                console.log(`Transaction hash: ${receipt.hash}`);
                
                // 检查事件日志
                const lockEvent = receipt.logs.find(log => 
                    log.fragment && log.fragment.name === "LockInitiated"
                );
                
                if (lockEvent) {
                    console.log("Lock initiated for token:", lockEvent.args.tokenId.toString());
                }
                
                const messageEvent = receipt.logs.find(log => 
                    log.fragment && log.fragment.name === "MessageSent"
                );
                
                if (messageEvent) {
                    console.log("📨 Message sent with ID:", messageEvent.args.messageId);
                }
            } catch (error) {
                console.error("❌ Transaction failed:", error);
                
                // 详细解析错误
                if (error.data) {
                    try {
                        const decodedError = nftPoolLockAndRelease.interface.parseError(error.data);
                        console.log("Error details:", decodedError.name, decodedError.args);
                    } catch (e) {
                        console.log("Raw error data:", error.data);
                    }
                }
            }
        } catch (error) {
            console.error("❌ Failed to get contract instances:", error);
        }
    });

module.exports = {};