export type USDCStr = `${number}`;

export type LinkNote = {
    type: "notev1";
    note: string;
    sender: string;
    sender_address: string;
    usdc: USDCStr;
    id: string;
  };