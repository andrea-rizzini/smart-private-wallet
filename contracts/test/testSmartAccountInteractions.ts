const hre = require("hardhat");
require("dotenv").config();

async function main() {
    const account = await hre.ethers.getContractAt("Account", "0x81f1b5913671d834eeb93de069c39767c1ca1984");
    const count = await account.counter(); // just to test how many times we've interacted with the contract
    console.log("Number of interactions with contract Account: ", count.toString(), "times");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })