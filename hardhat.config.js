require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-ethers");
require("hardhat-deploy");
require("hardhat-deploy-ethers");
require("dotenv").config();
require("./task")

const config = require("./config");
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL;
const HOLESKY_RPC_URL = process.env.HOLESKY_RPC_URL;
/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.24",
  networks: {
    sepolia: {
      // url: "SEPOLIA_RPC_URL",
      url: "https://eth-sepolia.public.blastapi.io",
      chainId: 11155111,
      accounts: [PRIVATE_KEY],
      blockConfirmations: 6,
      companionNetworks: {
        destChain: "amoy"
      }
    },
    amoy: {
      // url: "AMOY_RPC_URL",
      url: "https://rpc-amoy.polygon.technology",
      chainId: 80002,
      accounts: [PRIVATE_KEY],
      blockConfirmations: 6,
      gas: 30000000,
      gasPrice: 100000000000,
      companionNetworks: {
        destChain: "sepolia"
      }
    }
  },
  etherscan: {
    apiKey: "T8KDXJ9C7R9XZ4PSF4WAKCN3CG54UJ89CB",
    timeout: 60000,
  },
  namedAccounts: {
    firstAccount: {
      default: 0
    },
    secondAccount: {
      default: 1
    }
  }
};
