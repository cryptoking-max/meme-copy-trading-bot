import crypto from 'crypto';
import dotenv from 'dotenv';
import bs58 from 'bs58';
import fs from 'fs';
dotenv.config();

const privateKey = process.env.PRIVATE_KEY;

const privateKeyBytes = bs58.decode(privateKey);

const keyPairArray = Array.from(privateKeyBytes);

console.log('Key Pair Array:', keyPairArray);

