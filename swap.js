import axios from "axios";
import pkg from "@coral-xyz/anchor";
import {
  Keypair,
  Connection,
  Transaction,
  ComputeBudgetProgram,
  LAMPORTS_PER_SOL,
  VersionedTransaction,
} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { readFile, writeFile } from "fs/promises";
import { Wallet } from "@project-serum/anchor";
import { getTokenPrice, sleep, getTokenPrice_sol } from "./fuc.js";

import dotenv from "dotenv";
import bs58 from "bs58";
dotenv.config();

export const loadwallet = async () => {
  const privateKey = process.env.PRIVATE_KEY;
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

export const createProvider = (wallet, connection) => {
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);
  return provider;
};

export const createTransaction = () => {
  const transaction = new Transaction();
  transaction.add(
    ComputeBudgetProgram.setComputeUnitLimit({
      units: 200000, // Setting compute unit limit
    }),
    ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 5000, // Setting the priority fee (adjust based on congestion)
    })
  );
  return transaction;
};

export const rpc_connection = () => {
  const newConnection = new Connection(process.env.RPC_URL, "confirmed");
  return newConnection;
};

const getResponse = async (
  tokenA,
  tokenB,
  amount,
  slippageBps,
  anchorWallet
) => {
  const response = await axios.get(
    `https://quote-api.jup.ag/v6/quote?inputMint=${tokenA}&outputMint=${tokenB}&amount=${amount}&slippageBps=${slippageBps}`
  );
  const quoteResponse = response.data;
  const swapResponse = await axios.post(`https://quote-api.jup.ag/v6/swap`, {
    quoteResponse,
    userPublicKey: anchorWallet.publicKey.toString(),
    wrapAndUnwrapSol: true,
    dynamicComputeUnitLimit: true, // allow dynamic compute limit instead of max 1,400,000
    prioritizationFeeLamports: 200000, // or custom lamports: 1000
  });
  return swapResponse.data;
};

const executeTransaction = async (
  connection,
  swapTransaction,
  anchorWallet
) => {
  try {
    if (!anchorWallet || !anchorWallet.keypair) {
      throw new Error("Invalid anchorWallet: keypair is undefined");
    }

    const swapTransactionBuf = Buffer.from(swapTransaction, "base64");
    const latestBlockHash = await connection.getLatestBlockhash();
    console.log("latestBlockHash", latestBlockHash);
    const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
    console.log("transaction", transaction);

    transaction.sign([anchorWallet.keypair]);

    // Execute the transaction
    const rawTransaction = transaction.serialize();
    console.log("rawTransaction", rawTransaction);
    await sleep(1000);
    const txid = await connection.sendRawTransaction(rawTransaction, {
      skipPreflight: false,
      maxRetries: 5,
    });
    console.log("txid", txid);
    const signature = await connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: txid,
    });

    return {
      confirm: true,
      signature: txid,
    };
  } catch (error) {
    console.log("Transaction error:", error);
    console.log("Transaction reconfirm after 10s!");
    await new Promise((resolve) => setTimeout(resolve, 10000));
    return {
      confirm: false,
      signature: "",
    };
  }
};

export const getBalance = async () => {
  const connection = rpc_connection();
  const walletInstance = await loadwallet();
  const balance = await connection.getBalance(walletInstance.publicKey);
  console.log("balance =>", balance / LAMPORTS_PER_SOL, "SOL");
  return balance / LAMPORTS_PER_SOL;
};

export const swap = async (tokenA, tokenB, amount) => {
  const connection = rpc_connection();
  const wallet = await loadwallet();

  // Check SOL balance before proceeding
  const solBalance = await connection.getBalance(wallet.publicKey);

  // If tokenA is SOL, check if we have enough balance for the swap
  if (tokenA === "So11111111111111111111111111111111111111112") {
    const requiredBalance =
      amount + process.env.MINIMUM_SOL_FOR_FEES * LAMPORTS_PER_SOL;
    if (solBalance < requiredBalance) {
      throw new Error(
        `Insufficient SOL balance. Need ${
          requiredBalance / LAMPORTS_PER_SOL
        } SOL, have ${solBalance / LAMPORTS_PER_SOL} SOL`
      );
    }
  }

 

  console.log(`Swapping ${amount} of ${tokenA} for ${tokenB}...`);

  let slippageBps = process.env.SLIPPAGE_BPS;
  let success = false;

  while (success == false) {
    try {
      let confirm = false;
      let signature;
      let txid;
      const quoteData = await getResponse(
        tokenA,
        tokenB,
        amount,
        slippageBps,
        wallet
      );

      // Continue with transaction execution
      const result = await executeTransaction(
        connection,
        quoteData.swapTransaction,
        wallet
      );
      
      confirm = result.confirm;
      txid = result.signature;
      // await sleep(1000);
      

      // Save token info if trading with SOL
      if (
        tokenA === "So11111111111111111111111111111111111111112" ||
        tokenB === "So11111111111111111111111111111111111111112"
      ) {
        const tokenInfo = {
          timestamp: new Date().toISOString(),
          action:
            tokenA === "So11111111111111111111111111111111111111112"
              ? "buy"
              : "sell",
          address:
            tokenA === "So11111111111111111111111111111111111111112"
              ? tokenB
              : tokenA,
          
          price: "0", // Default value in case price fetch fails
          splTokenAmount: 
          tokenA === "So11111111111111111111111111111111111111112"
            ? amount / await getTokenPrice_sol(tokenB)
            : amount / LAMPORTS_PER_SOL,// Fetch SPL token balance
        };

        try {
          // Try to get token price, but don't fail if it errors
          try {
            tokenInfo.price =
              tokenA === "So11111111111111111111111111111111111111112"
                ? await getTokenPrice(tokenB)
                : await getTokenPrice(tokenA);
          } catch (priceError) {
            console.warn(
              "Warning: Failed to fetch token price:",
              priceError.message
            );
          }

          // Read existing data or create new array
          let existingData = [];
          try {
            const fileData = await readFile("token_trades.json", "utf8");
            existingData = JSON.parse(fileData);
          } catch (err) {
            // File doesn't exist yet, will create new
          }

          // Add new trade info
          existingData.push(tokenInfo);
          console.log("tokenInfo----------------\n", tokenInfo);

          // Write updated data back to file
          await writeFile(
            "token_trades.json",
            JSON.stringify(existingData, null, 2)
          );
          console.log("Token trade info saved to token_trades.json");
        } catch (err) {
          console.error("Error saving token info:", err);
        }

        console.log(`✌✌✌Swap successful! ${tokenA} for ${tokenB}`);
        console.log(`https://solscan.io/tx/${txid}`);
        success = true;
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    } catch (error) {
      console.log("error", error);
      console.log("Retry after 5s");
      process.exit(1);
    }
  }
};
