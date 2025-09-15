const { task } = require("hardhat/config")

task("check-nft")
    .addFlag("json", "output structured JSON only")
    .addOptionalParam("address", "filter by owner address")
    .addOptionalParam("contract", "MyToken contract address override")
    .setAction(async (taskArgs, hre) => {
        const { ethers, deployments } = hre;

        let myTokenAddr;
        try {
            if (taskArgs.contract) {
                if (!ethers.isAddress(taskArgs.contract)) throw new Error("invalid contract address");
                myTokenAddr = taskArgs.contract;
            } else {
                const d = await deployments.get("MyToken");
                myTokenAddr = d.address;
            }
        } catch (e) {
            const msg = `Failed to resolve MyToken address: ${e?.message || e}`;
            const out = { ok: false, error: msg, network: hre.network.name };
            console.log(taskArgs.json ? JSON.stringify(out) : out);
            return;
        }

        const nft = await ethers.getContractAt("MyToken", myTokenAddr);

        const result = {
            ok: true,
            network: hre.network.name,
            contract: String(myTokenAddr),
            totalSupply: "0",
            tokens: []
        };

        try {
            const totalSupply = await nft.totalSupply();
            result.totalSupply = totalSupply.toString();
            if (!taskArgs.json) {
                console.log(`checking status of MyToken at ${myTokenAddr} on ${hre.network.name}`);
            }

            for (let tokenId = 0n; tokenId < totalSupply; tokenId++) {
                try {
                    const owner = await nft.ownerOf(tokenId);
                    if (!taskArgs.address || owner.toLowerCase() === taskArgs.address.toLowerCase()) {
                        result.tokens.push({ tokenId: tokenId.toString(), owner });
                        if (!taskArgs.json) {
                            console.log(`tokenId: ${tokenId} - owner: ${owner}`);
                        }
                    }
                } catch (_) {
                    // 非连续 tokenId 或查询失败时跳过
                }
            }
        } catch (error) {
            const out = { ok: false, error: String(error?.message || error), ...result };
            console.log(taskArgs.json ? JSON.stringify(out) : out);
            return;
        }

        console.log(taskArgs.json ? JSON.stringify(result) : result);
    })

module.exports = {}