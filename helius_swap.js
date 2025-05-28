import { Helius } from 'helius-sdk';
import { Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Wallet } from "@project-serum/anchor";
import dotenv from "dotenv";
import bs58 from "bs58";


const helius = new Helius('https://api.helius.xyz/v0', process.env.HELIUS_API_KEY);
dotenv.config();
// const wallet = new Wallet(Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY)));

const loadwallet = async () => {
  const privateKey = "";
  if (!privateKey) {
    throw new Error("PRIVATE_KEY environment variable is not set");
  }
  const decodedKey = bs58.decode(privateKey);
  const keypair = Keypair.fromSecretKey(decodedKey);

  if (!keypair) {
    throw new Error("Failed to create Keypair from the provided private key");
  }

  const wallet = new Wallet(keypair);
  // Add the keypair to the wallet instance
  wallet.keypair = keypair;

  return wallet;
};

const wallet = await loadwallet();
// Swap 0.5 USDC to SOL with 2% maximum dynamic slippage
const swapParams = {
  inputMint: 'So11111111111111111111111111111111111111112', // USDC
  outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // SOL
  amount: 0.01*LAMPORTS_PER_SOL, // 0.5 USDC (USDC has 6 decimals)
  maxDynamicSlippageBps: 200, // Optional: 2% maximum dynamic slippage (default is 3%)
};

const result = await helius.rpc.executeJupiterSwap(swapParams, wallet);
console.log(result);
