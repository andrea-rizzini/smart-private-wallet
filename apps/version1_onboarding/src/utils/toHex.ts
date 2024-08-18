
export function toHex(number: any, length = 32) {
    const str = number instanceof Buffer ? number.toString('hex') : BigInt(number).toString(16)
    return '0x' + str.padStart(length * 2, '0')
 }

 export function toFixedHex(number?: number | Buffer | bigint | string, length = 32) {
    let hexString;
    if (number instanceof Buffer) {
        hexString = number.toString('hex');  
    } else {
        hexString = toHex(number).replace('0x', '');  
    }
  
    let result = '0x' + hexString.padStart(length * 2, '0');
  
    return result;
  }
