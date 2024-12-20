// data from https://github.com/ultrasoundmoney/ofac-ethereum-addresses/tree/main
// periodically update the local data list for testing

import axios from 'axios';
import csv from 'csv-parser';
import fs from 'fs';
import path from 'path';

import { Alchemy, AssetTransfersCategory, Network } from  'alchemy-sdk'
import { Readable } from 'stream';

const OFAC_API_URL = 'https://raw.githubusercontent.com/ultrasoundmoney/ofac-ethereum-addresses/main/data.csv'; // URL GitHub

interface QueueItem {
    address: string;
    hops: number;
}

interface SanctionedAddress {
  date_added: string;
  address: string;
  name: string;
}

async function csvToJson(csvData: string): Promise<SanctionedAddress[]> {
  return new Promise((resolve, reject) => {
      const results: SanctionedAddress[] = [];
      const readable = Readable.from(csvData);
      readable.pipe(csv())
          .on('data', (data) => results.push(data))
          .on('end', () => resolve(results))
          .on('error', reject);
  });
}

export async function fetchSanctionedAddresses(): Promise<{ address: string }[]> {
    try {
        const response = await axios.get(OFAC_API_URL);
        const csvData = response.data;

        // Convert CSV to JSON
        const jsonData = await csvToJson(csvData);
        return jsonData;
    } catch (error) {
        console.error('Error fetching sanctioned addresses:', error);
        throw new Error('Failed to fetch sanctioned addresses');
    }
}

export async function checkSanctionedAddress(address: string, maxHops = 3): Promise<{ sanction: boolean; message: string }> {
    
    // we leave this just for testing
    const dirPath = path.join(__dirname, '../../sanctioned_addresses/');
    const filePath = path.join(dirPath, 'sanctioned_addresses.json');
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const sanctionedAddresses: { address: string }[] = JSON.parse(fileContent);

    // if you want use the local list, comment the next line and uncomment the previous block
    // const sanctionedAddresses = await fetchSanctionedAddresses();

    const isSanctioned = (address: string): boolean => {
        return sanctionedAddresses.some(entry => entry.address.toLowerCase() === address.toLowerCase());
    };

    if (isSanctioned(address)) {
        return { sanction: true, message: `Address ${address} is in the OFAC sanctioned-addresses list !\nYou'll be reported` };
    }

    const config = {
        apiKey: process.env.ALCHEMY_API_KEY, 
        network: Network.BASE_SEPOLIA, 
    };

    const alchemy = new Alchemy(config);

    let queue: QueueItem[] = [{ address, hops: 0 }];
    let visited: Set<string> = new Set();

    while (queue.length > 0) {
        const { address: currentAddress, hops } = queue.shift() as QueueItem;  
    
        if (hops >= maxHops) {
          continue;  
        }
    
        if (visited.has(currentAddress)) {
          continue;
        }
        visited.add(currentAddress);

        const transfers = await alchemy.core.getAssetTransfers({
            fromBlock: "0x0",
            toAddress: currentAddress,
            category: [AssetTransfersCategory.EXTERNAL, AssetTransfersCategory.ERC20],
        });
    
        for (const transfer of transfers.transfers) {
          const fromAddress = transfer.from.toLowerCase();
    
          if (isSanctioned(fromAddress)) {
            return { sanction: true, message: `Address ${address} has been involved in transactions with a sanctioned addresses: ${fromAddress}.\nYou'll be reported` };
          }
    
          if (!visited.has(fromAddress)) {
            queue.push({ address: fromAddress, hops: hops + 1 });
          }
        }
      }

      return { sanction: false, message: `Address ${address} is fine !` };
}