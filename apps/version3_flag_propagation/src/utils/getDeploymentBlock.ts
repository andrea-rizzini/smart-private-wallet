import hre from "hardhat";

export async function get_deployment_block(address_: string) {

    const code =  await hre.ethers.provider.getCode(address_);
    if (code === '0x') {
        console.error('Contract does not exist on that address');
        return;
    }

    const filter = {
        fromBlock: 0,
        toBlock: 'latest',
        address: address_
    };
    const logs = await hre.ethers.provider.getLogs(filter);

    /*for (const log of logs) {
        const tx = await hre.ethers.provider.getTransaction(log.transactionHash);
        console.log(`Block number: ${tx.blockNumber}`);
    }*/

    //console.log(`Block number: ${logs[0].blockNumber}`);
    return logs[0].blockNumber;

}

// async function main() {
//     n = await get_deployment_block('0xBF53e3744661928Cc39D9274B5Db0949150C0392');
//     console.log(n);
// }

// main()

