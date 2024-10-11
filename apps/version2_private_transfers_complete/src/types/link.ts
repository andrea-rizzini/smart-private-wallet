export type USDCStr = `${number}`;

export type LinkNote = {
    type: "notev1";
    symmetric_key: string;
    sender: string;
    sender_address: string;
    recevier: string;
    usdc: USDCStr;
    id: string;
  };