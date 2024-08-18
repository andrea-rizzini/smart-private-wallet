import fs from 'fs';

export async function getUnredeemedNullifiers(path: string) {

    const data = fs.readFileSync(path, 'utf-8');
    
    const nullifiers = JSON.parse(data);
  
    // Filter for redeemed: false
    const unredeemed = nullifiers.filter((item: { redeemed: boolean }) => item.redeemed === false);
  
    return unredeemed;
  }