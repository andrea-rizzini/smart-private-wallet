
export function toHex(number: any, length = 32) {
  const str = number instanceof Buffer ? number.toString('hex') : BigInt(number).toString(16)
  return '0x' + str.padStart(length * 2, '0')
 }

 export function toFixedHex(number?: number | Buffer | bigint | string, length = 32): string {
  let hexString: string;

  if (number instanceof Buffer) {
    hexString = number.toString('hex');
  } else {

    hexString = BigInt(number as number | string | bigint).toString(16);
  }

  hexString = hexString.padStart(length * 2, '0');

  let result = '0x' + hexString;

  if (result.includes('-')) {
    result = '-' + result.replace('-', '');
  }

  return result;
}
