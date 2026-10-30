const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** Solana public keys are 32-byte values encoded as base58. */
export function isValidSolanaAddress(value: string): boolean {
  const address = value.trim();
  if (address.length < 32 || address.length > 44) return false;

  let number = BigInt(0);
  for (const character of address) {
    const digit = BASE58_ALPHABET.indexOf(character);
    if (digit < 0) return false;
    number = number * BigInt(58) + BigInt(digit);
  }

  let byteLength = 0;
  while (number > BigInt(0)) {
    byteLength += 1;
    number >>= BigInt(8);
  }

  const leadingZeroBytes = address.match(/^1+/)?.[0].length ?? 0;
  return byteLength + leadingZeroBytes === 32;
}
