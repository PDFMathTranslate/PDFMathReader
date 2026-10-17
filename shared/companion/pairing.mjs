// Pairing codes are shown to people and typed on a phone, so they use an
// unambiguous alphabet in two groups of four symbols.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export const COMPANION_DEFAULT_PORT = 8891;
export const PAIRING_CODE_BYTES = 8;

export function pairingCodeFromBytes(bytes) {
  const symbols = [...bytes]
    .slice(0, PAIRING_CODE_BYTES)
    .map((byte) => ALPHABET[byte % ALPHABET.length])
    .join('');
  return symbols.match(/.{4}/g).join('-');
}

export function normalizePairingCode(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}
