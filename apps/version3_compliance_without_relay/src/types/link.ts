export type EthersStr = `${number}`;

export type LinkNote = {
    type: "notev1";
    note: string;
    sender: string;
    sender_address: string;
    ethers: EthersStr;
    id: string;
  };