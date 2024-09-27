import fs from 'fs';
import path from 'path';

async function createFileForMixerCaching(
  directory: string,
  fileName: string,
  defaultContent: any = []
) {
  try {
    const dirPath = path.join(__dirname, directory);
    const filePath = path.join(dirPath, fileName);

    if (!fs.existsSync(dirPath)) {
      await fs.promises.mkdir(dirPath, { recursive: true });
      console.log(`Directory created: ${dirPath}`);
    }

    if (!fs.existsSync(filePath)) {
      await fs.promises.writeFile(filePath, JSON.stringify(defaultContent, null, 2), 'utf8');
      console.log(`File created: ${filePath}`);
    } else {
      console.log(`File already exists: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error creating file or directory: ${error}`);
  }
}

async function createAllCacheFiles() {
  const filesToCreate = [
    { directory: '../../../apps/version1_onboarding/cache/', fileName: 'CommitmentCreated_eth_0.01.json' },
    { directory: '../../../apps/version1_onboarding/cache/', fileName: 'CommitmentCreated_eth_0.1.json' },
    { directory: '../../../apps/version1_onboarding/cache/', fileName: 'CommitmentCreated_eth_1.json' },
    { directory: '../../../apps/version1_onboarding/cache/', fileName: 'CommitmentCreated_eth_10.json' },

    { directory: '../../../apps/version2_private_transfers/cache/', fileName: 'CommitmentCreated_eth_0.01.json' },
    { directory: '../../../apps/version2_private_transfers/cache/', fileName: 'CommitmentCreated_eth_0.1.json' },
    { directory: '../../../apps/version2_private_transfers/cache/', fileName: 'CommitmentCreated_eth_1.json' },
    { directory: '../../../apps/version2_private_transfers/cache/', fileName: 'CommitmentCreated_eth_10.json' },

    { directory: '../../../apps/version3_compliance/cache/', fileName: 'CommitmentCreated_eth_0.01.json' },
    { directory: '../../../apps/version3_compliance/cache/', fileName: 'CommitmentCreated_eth_0.1.json' },
    { directory: '../../../apps/version3_compliance/cache/', fileName: 'CommitmentCreated_eth_1.json' },
    { directory: '../../../apps/version3_compliance/cache/', fileName: 'CommitmentCreated_eth_10.json' },

    { directory: '../../../apps/version3_compliance_without_relayer/cache/', fileName: 'CommitmentCreated_eth_0.01.json' },
    { directory: '../../../apps/version3_compliance_without_relayer/cache/', fileName: 'CommitmentCreated_eth_0.1.json' },
    { directory: '../../../apps/version3_compliance_without_relayer/cache/', fileName: 'CommitmentCreated_eth_1.json' },
    { directory: '../../../apps/version3_compliance_without_relayer/cache/', fileName: 'CommitmentCreated_eth_10.json' },
  ];

  for (const { directory, fileName } of filesToCreate) {
    await createFileForMixerCaching(directory, fileName);
  }
}

createAllCacheFiles();