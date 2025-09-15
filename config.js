// 加载环境变量
require('dotenv').config();

// 现在可以访问 .env 文件中的变量
const config = {
  apiKey: process.env.API_URL,
  sepoliaPrivateKeyAccount1: process.env.SEPOLIA_PRIVATE_KEY_ACCOUNT1,
  sepoliaPrivateKeyAccount2: process.env.SEPOLIA_PRIVATE_KEY_ACCOUNT2,
  sepoliaId: process.env.SEPOLIA_ID
};

module.exports = config;