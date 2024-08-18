import { HardhatUserConfig } from "hardhat/types";
import "@nomicfoundation/hardhat-toolbox";
import { config as dotEnvConfig } from "dotenv";

dotEnvConfig();

const config: HardhatUserConfig = {
  defaultNetwork: "base",
  networks: {
    hardhat: {},
    base: {
      url: process.env.RPC_URL_BASE_SEPOLIA!,
      accounts: [
        process.env.PRIVATE_KEY_ALICE!,
        process.env.PRIVATE_KEY_BOB!,
        process.env.PRIVATE_KEY_FAUCET!,
        process.env.PRIVATE_KEY_RELAYER!,
      ],
    },
    arb: {
      url: process.env.RPC_URL_ARBITRUM_SEPOLIA!,
      accounts: [
        process.env.PRIVATE_KEY_ALICE!,
        process.env.PRIVATE_KEY_BOB!,
        process.env.PRIVATE_KEY_FAUCET!,
        process.env.PRIVATE_KEY_RELAYER!,
      ],
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY, 
  },
  solidity: {
    compilers: [
      {
        version: "0.8.12",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000,
          },
          viaIR: true,
        },
      }
    ],
  },
  
};

export default config;
