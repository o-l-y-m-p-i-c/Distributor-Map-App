import {createCipheriv, createDecipheriv, createHash, randomBytes} from 'node:crypto';
import {getEnv} from '@/lib/config/env';

const algorithm = 'aes-256-gcm';

function getKey() {
  return createHash('sha256').update(getEnv().TOKEN_ENCRYPTION_KEY).digest();
}

export function encryptAccessToken(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    'v1',
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}


export function decryptAccessToken(value: string) {
  const [version, ivEncoded, tagEncoded, encryptedEncoded] = value.split('.');
  if (version !== 'v1' || !ivEncoded || !tagEncoded || !encryptedEncoded) throw new Error('Invalid encrypted access token');
  const decipher = createDecipheriv(algorithm, getKey(), Buffer.from(ivEncoded, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagEncoded, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedEncoded, 'base64url')), decipher.final()]).toString('utf8');
}
