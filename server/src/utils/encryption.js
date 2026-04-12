import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const algorithm = 'aes-256-cbc';
const key = Buffer.from(process.env.BACKUP_ENCRYPTION_KEY || '12345678901234567890123456789012', 'utf8'); // Must be 32 chars
// In production, ensure env var is set and correct length. 
// If key is shorter, pad it? Better to enforce correct key.
// For now, I'll assume the user provides a valid 32-char string or I use a default for dev (NOT SAFE FOR PROD).
// Actually, let's hash the provided key to ensure 32 bytes if needed, or just require 32 bytes.
// Let's use scrypt to derive a 32 byte key from a password/secret.

let cachedKey = null;

const getKey = () => {
    if (cachedKey) return cachedKey;
    const secret = process.env.BACKUP_ENCRYPTION_KEY || 'default_secret_very_secure';
    cachedKey = crypto.scryptSync(secret, 'salt', 32);
    return cachedKey;
}

export const encryptData = (data) => {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, getKey(), iv);
    let encrypted = cipher.update(JSON.stringify(data));
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return { iv: iv.toString('hex'), encryptedData: encrypted.toString('hex') };
};

export const decryptData = (text) => {
    const iv = Buffer.from(text.iv, 'hex');
    const encryptedText = Buffer.from(text.encryptedData, 'hex');
    const decipher = crypto.createDecipheriv(algorithm, getKey(), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return JSON.parse(decrypted.toString());
};

export const encryptDataWithPassword = (data, password) => {
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(password, 'backup_salt', 32);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(JSON.stringify(data));
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return { iv: iv.toString('hex'), encryptedData: encrypted.toString('hex') };
};

export const decryptDataWithPassword = (payload, password) => {
    const iv = Buffer.from(payload.iv, 'hex');
    const key = crypto.scryptSync(password, 'backup_salt', 32);
    const encryptedText = Buffer.from(payload.encryptedData, 'hex');
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return JSON.parse(decrypted.toString());
};

export const encryptFile = (inputPath, outputPath) => {
    // Stream based encryption for large files could be better, but for JSON dump loaded in memory:
    // This is a placeholder if we want to stream.
};
