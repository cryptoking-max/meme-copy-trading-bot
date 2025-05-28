import { PublicKey } from "@solana/web3.js";
import { rpc_connection } from "./swap.js";
// import { filterCoins } from "./fuc.js"
import { getCoinData } from "./fuc.js"
import { Connection } from "@solana/web3.js";
import dotenv from "dotenv";

dotenv.config();
const action_token_address = process.env.ACTION_TOKEN_ADDRESS;
const newConnection = new Connection(process.env.RPC_URL, "confirmed");
const latestBlockHash = await newConnection.getBlockTime();
console.log(latestBlockHash)
// Replace with your wallet address
// const WALLET_ADDRESS = "DopsYMstRqBm3SSsn1vY6sjhFPjXbtQeTPoXWsoopodF";

// // Connect to Solana mainnet (or devnet/testnet if needed)
// let result= await filterCoins(action_token_address)
// console.log(result)
