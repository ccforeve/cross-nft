const { task } = require("hardhat/config");
const { networkConfig } = require("../helper-hardhat-config");

task("lock-and-cross")
    .addOptionalParam("chainselector", "chain selector of dest chain")
    .addOptionalParam("receiver", "receiver address of dest chain")
    .addParam("tokenid", "tokenid to be cross chain")
    .addFlag("json", "output structured JSON summary only")
    .addFlag("dryrun", "estimate and validate only, do not send tx")
    .addFlag("lockonly", "if true, only lock NFT without sending message")
    .setAction(async (taskArgs, hre) => {
        const { getNamedAccounts, deployments, ethers } = hre;
        const { firstAccount } = await getNamedAccounts();
        let tokenId;
        const summary = {
            network: hre.network.name,
            sender: firstAccount,
            receiver: undefined,
            tokenId: undefined,
            chainselector: undefined,
            estimatedFeeLINK: undefined,
            linkTopupLINK: "0",
            txHash: undefined,
            events: {}
        };
        try {
            if (taskArgs.tokenid === undefined || taskArgs.tokenid === null || taskArgs.tokenid === "") {
                throw new Error("tokenid is required");
            }
            tokenId = BigInt(taskArgs.tokenid);
            summary.tokenId = tokenId.toString();
        } catch (e) {
            const msg = `Invalid tokenid: ${taskArgs.tokenid}`;
            if (taskArgs.json) {
                console.log(JSON.stringify({ ok: false, error: msg }));
                return;
            }
            console.error("❌", msg);
            return;
        }
        
        console.log("Starting lock-and-cross task...");
        console.log("Token ID:", tokenId);
        console.log("First account:", firstAccount);
        
        // 1. 获取配置
        let chainselector, receiver;
        if (taskArgs.chainselector) {
            try {
                if (!/^\d+$/.test(String(taskArgs.chainselector))) throw new Error("chainselector must be a numeric string");
                chainselector = String(taskArgs.chainselector);
            } catch (e) {
                const msg = `Invalid chainselector: ${taskArgs.chainselector}`;
                if (taskArgs.json) { console.log(JSON.stringify({ ok: false, error: msg })); return; }
                console.error("❌", msg);
                return;
            }
            console.log("Using provided chainselector:", chainselector);
        } else {
            chainselector = networkConfig[hre.network.config.chainId].companionChainSelector;
            console.log("Using default chainselector from config:", chainselector);
        }
        
        if (taskArgs.receiver) {
            receiver = taskArgs.receiver;
            if (!ethers.isAddress(receiver)) {
                const msg = `Invalid receiver address: ${receiver}`;
                if (taskArgs.json) { console.log(JSON.stringify({ ok: false, error: msg })); return; }
                console.error("❌", msg);
                return;
            }
            console.log("Using provided receiver:", receiver);
        } else {
            console.log("Getting receiver from companion network...");
            const nftPoolMintAndBurnDeployment = await hre.companionNetworks["destChain"].deployments.get("NFTPoolMintAndBurn");
            receiver = nftPoolMintAndBurnDeployment.address;
            console.log("Using default receiver from companion network:", receiver);
        }
        summary.receiver = receiver;
        summary.chainselector = String(chainselector);

        // 2. 获取合约实例
        try {
            console.log("Getting NFTPoolLockAndRelease deployment...");
            const nftPoolLockAndReleaseDeployment = await deployments.get("NFTPoolLockAndRelease");
            console.log("NFTPoolLockAndRelease deployment address:", nftPoolLockAndReleaseDeployment.address);
            
            console.log("Creating NFTPoolLockAndRelease contract instance...");
            let nftPoolLockAndReleaseBase = await ethers.getContractAt(
                "NFTPoolLockAndRelease",
                nftPoolLockAndReleaseDeployment.address
            );
            let nftPoolLockAndRelease;
            if (taskArgs.dryrun) {
                nftPoolLockAndRelease = nftPoolLockAndReleaseBase;
            } else {
                // 使用connect方法连接到签名者
                nftPoolLockAndRelease = nftPoolLockAndReleaseBase.connect((await ethers.getSigners())[0]);
            }
            console.log("NFTPoolLockAndRelease instance created at:", nftPoolLockAndRelease.target);
            
            console.log("Getting LinkToken contract instance...");
            const linkTokenAddress = networkConfig[hre.network.config.chainId].linkToken;
            console.log("LinkToken address:", linkTokenAddress);
            const linkTokenBase = await ethers.getContractAt("LinkToken", linkTokenAddress);
            const linkToken = taskArgs.dryrun
                ? linkTokenBase
                : linkTokenBase.connect((await ethers.getSigners())[0]);
            console.log("LinkToken instance created at:", linkToken.target);
            
            let nft;
            if (!taskArgs.dryrun) {
                console.log("Getting MyToken contract instance...");
                const myTokenBase = await ethers.getContract("MyToken");
                nft = myTokenBase.connect((await ethers.getSigners())[0]);
                console.log("MyToken instance created at:", nft.target);
            }

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
                summary.estimatedFeeLINK = ethers.formatEther(estimatedFee);
            } catch (error) {
                console.error("❌ Fee estimation failed:", error);
                estimatedFee = ethers.parseEther("1");
                console.log(`Using default fee: ${ethers.formatEther(estimatedFee)} LINK`);
                summary.estimatedFeeLINK = ethers.formatEther(estimatedFee);
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
            if (!taskArgs.dryrun && currentBalance < estimatedFee) {
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
                    summary.linkTopupLINK = ethers.formatEther(amountNeeded);
                } catch (error) {
                    console.error("❌ LINK transfer failed:", error);
                }
            }

            // 6. 授权 NFT（dryrun 跳过）
            if (!taskArgs.dryrun) {
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
                
                // 验证授权是否成功
                console.log("Verifying NFT approval...");
                try {
                    const approvedAddress = await nft.getApproved(tokenId);
                    const isApprovedForAll = await nft.isApprovedForAll(firstAccount, nftPoolLockAndRelease.target);
                    console.log(`Approved address for token ${tokenId}: ${approvedAddress}`);
                    console.log(`Is approved for all: ${isApprovedForAll}`);
                    if (approvedAddress !== nftPoolLockAndRelease.target && !isApprovedForAll) {
                        console.error("❌ NFT approval verification failed: contract is not authorized");
                        return;
                    }
                } catch (error) {
                    console.error("❌ NFT approval verification failed:", error);
                }
            }

            // 7. 执行跨链锁定
            if (taskArgs.dryrun) {
                const result = { ok: true, dryrun: true, ...summary };
                console.log(taskArgs.json ? JSON.stringify(result) : result);
                return;
            }

            try {
                console.log("Locking NFT...");
                
                // 验证合约实例
                console.log("Contract instance verification:");
                console.log("- nftPoolLockAndRelease exists:", !!nftPoolLockAndRelease);
                console.log("- Contract target address:", nftPoolLockAndRelease.target);
                
                // 测试单独的操作步骤，而不是一次执行整个流程
                console.log("\nTesting individual operations:");
                
                // 1. 验证NFT所有权
                const owner = await nft.ownerOf(tokenId);
                console.log(`NFT owner for token ${tokenId}: ${owner}`);
                if (owner.toLowerCase() !== firstAccount.toLowerCase() && owner.toLowerCase() !== nftPoolLockAndRelease.target.toLowerCase()) {
                    console.error("❌ You do not own this NFT");
                    return;
                }
                
                // 如果NFT已经在合约中，就直接进行后续操作
                if (owner.toLowerCase() === nftPoolLockAndRelease.target.toLowerCase()) {
                    console.log("✅ NFT is already in contract, proceeding with operation...");
                }
                
                let tx;
                let resultMessage;
                
                // 根据lockonly参数决定执行哪个函数
                if (taskArgs.lockonly) {
                    // 只锁定NFT，不发送消息
                    console.log("\nAttempting lockNFT transaction...");
                    console.log(`- Token ID: ${tokenId}`);
                    tx = await nftPoolLockAndRelease.lockNFT(
                        tokenId,
                        {
                            gasLimit: 1_000_000,
                            gasPrice: ethers.parseUnits("50", "gwei")
                        }
                    );
                    resultMessage = "✅ NFT locked successfully without sending message";
                } else {
                    // 锁定并发送NFT
                    // 构建payload并验证
                    const payload = ethers.AbiCoder.defaultAbiCoder().encode(
                        ["uint256", "address"], 
                        [tokenId, firstAccount]
                    );
                    console.log(`Payload constructed: ${payload}`);
                    
                    console.log("\nAttempting lockAndSendNFT transaction with enhanced debugging...");
                    console.log(`- Token ID: ${tokenId}`);
                    console.log(`- New owner: ${firstAccount}`);
                    console.log(`- Chain selector: ${chainselector}`);
                    console.log(`- Receiver: ${receiver}`);
                    
                    tx = await nftPoolLockAndRelease.lockAndSendNFT(
                        tokenId,
                        firstAccount,
                        chainselector,
                        receiver,
                        {
                            gasLimit: 2_000_000, // 增加gas limit
                            gasPrice: ethers.parseUnits("50", "gwei")
                        }
                    );
                    resultMessage = "✅ NFT locked and message sent successfully";
                }
                
                console.log("Transaction sent, waiting for confirmation...");
                console.log(`Transaction hash (pending): ${tx.hash}`);
                
                const receipt = await tx.wait();
                console.log(resultMessage);
                console.log(`Transaction hash: ${receipt.hash}`);
                summary.txHash = receipt.hash;
                
                // 检查事件日志
                const lockEvent = receipt.logs.find(log => 
                    log.fragment && log.fragment.name === "LockInitiated"
                );
                
                if (lockEvent) {
                    console.log("Lock initiated for token:", lockEvent.args.tokenId.toString());
                    summary.events.LockInitiated = {
                        tokenId: lockEvent.args.tokenId?.toString?.() ?? String(tokenId)
                    };
                }
                
                if (!taskArgs.lockonly) {
                    const messageEvent = receipt.logs.find(log => 
                        log.fragment && log.fragment.name === "MessageSent"
                    );
                    
                    if (messageEvent) {
                        console.log("📨 Message sent with ID:", messageEvent.args.messageId);
                        summary.events.MessageSent = {
                            messageId: messageEvent.args.messageId
                        };
                    }
                }
                
                const result = { ok: true, ...summary };
                console.log(taskArgs.json ? JSON.stringify(result) : result);
            } catch (error) {
                console.error("❌ Transaction failed:", error);
                
                // 详细解析错误
                if (error.data) {
                    try {
                        const decodedError = nftPoolLockAndRelease.interface.parseError(error.data);
                        console.log("Error details:", decodedError.name, decodedError.args);
                    } catch (e) {
                        console.log("Raw error data:", error.data);
                        // 尝试手动解码错误数据
                        if (error.data.startsWith('0x')) {
                            const errorSignature = error.data.slice(0, 10);
                            console.log("Error signature:", errorSignature);
                        }
                    }
                }
                
                // 检查是否有交易哈希
                if (error.transaction && error.transaction.hash) {
                    console.log(`Transaction hash (failed): ${error.transaction.hash}`);
                    
                    try {
                        // 即使交易失败，也尝试获取收据来查看更多信息
                        const receipt = await ethers.provider.getTransactionReceipt(error.transaction.hash);
                        if (receipt) {
                            console.log("Transaction receipt details:");
                            console.log("- Status code:", receipt.status);
                            console.log("- Gas used:", receipt.gasUsed.toString());
                            console.log("- Block number:", receipt.blockNumber);
                            console.log("- Logs count:", receipt.logs.length);
                            
                            // 检查是否有任何事件被触发
                            if (receipt.logs.length > 0) {
                                console.log("Events triggered before revert:");
                                // 尝试解析事件
                                receipt.logs.forEach((log, index) => {
                                    try {
                                        // 检查是否是我们合约的事件
                                        if (log.address.toLowerCase() === nftPoolLockAndRelease.target.toLowerCase()) {
                                            const parsedLog = nftPoolLockAndRelease.interface.parseLog(log);
                                            console.log(`- Event ${index + 1}:`, parsedLog.name);
                                            console.log(`  Args:`, parsedLog.args);
                                        }
                                    } catch (e) {
                                        console.log(`- Unparsed log ${index + 1} at address:`, log.address);
                                    }
                                });
                            }
                        }
                    } catch (e) {
                        console.log("Failed to get transaction receipt:", e);
                    }
                }
                
                // 检查NFT所有权状态，确认是否真的转移成功
                try {
                    const currentOwner = await nft.ownerOf(tokenId);
                    console.log(`Current NFT owner after failed transaction: ${currentOwner}`);
                    console.log(`Is contract the owner: ${currentOwner.toLowerCase() === nftPoolLockAndRelease.target.toLowerCase()}`);
                    console.log(`Is user the owner: ${currentOwner.toLowerCase() === firstAccount.toLowerCase()}`);
                } catch (e) {
                    console.log("Failed to check NFT ownership:", e);
                }
                
                const result = { ok: false, error: String(error?.message || error), ...summary };
                console.log(taskArgs.json ? JSON.stringify(result) : result);
            }
        } catch (error) {
            console.error("❌ Failed to get contract instances:", error);
            const result = { ok: false, error: String(error?.message || error), ...summary };
            console.log(taskArgs.json ? JSON.stringify(result) : result);
        }
    });

module.exports = {};