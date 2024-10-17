import { Keypair } from "../pool/keypair";

export type USDCStr = `${number}`;

export type LinkNote = {
    type: "notev1";
    key: string;
    sender: string;
    sender_address: string;
    receiver: string;
    usdc: USDCStr;
    id: string;
    challenge: bigint;
  };