import WebSocket from "ws";
import dotenv from "dotenv";
import TelegramBot from "node-telegram-bot-api";
// const TelegramBot = require("node-telegram-bot-api");
import {
  swap,
  getBalance,
  createProvider,
  loadwallet,
  rpc_connection,
} from "./swap.js";
import {
  getLatestCoin,
  token_sell,
  getTokenPrice,
  getSPLTokens,
  token_buy,
  SPL_token_balance,
  getPnl,
  getCoinData,
  filterToken,
  token_analysis,
  
} from "./fuc.js";
import { monitoring_buy_one, monitoring_sell, monitoring_buy_all, monitoring_sell_all } from "./index.js";
import { readFile } from "fs/promises";
import bs58 from "bs58";
dotenv.config();
const TOKEN = process.env.TOKEN;
import { Keypair } from "@solana/web3.js";

const keyData = await readFile("keypair.json", "utf8");
const secretKey = new Uint8Array(JSON.parse(keyData));

const keypair = Keypair.fromSecretKey(secretKey);
// const PRIVATE_KEY = bs58.encode(keypair.secretKey);
const PUBLIC_KEY = keypair.publicKey.toString();
// const action_token_address = process.env.ACTION_TOKEN_ADDRESS;

const bot = new TelegramBot(TOKEN, { polling: true });

let running = false;

async function start(msg) {
  running = true;
  await bot.sendMessage(msg.chat.id, "Starting real-time messages...");
  await subscribe(msg);
}

async function stop(msg) {
  running = false;
  await bot.sendMessage(msg.chat.id, "Stopped real-time messages.");
}
async function Balance(msg) {
  const balance = await getBalance();
  console.log("💰Balance =>", balance);
  await bot.sendMessage(msg.chat.id, `Balance: ${balance} SOL`);
}
async function Position(msg) {
  try {
    const positions = await getSPLTokens(PUBLIC_KEY);
    console.log("💰 Current Positions:", positions);

    if (positions.length === 0) {
      await bot.sendMessage(
        msg.chat.id,
        "😢 No token positions found yet. Time to start trading! 🚀"
      );
      return;
    }

    let message = "🗂️ Your Current Token Positions 🗂️\n\n";
    for (const pos of positions) {
      const pnl = await getPnl(pos.spl_mint);

      message += `🌟Token: <code>${pos.spl_mint}</code>\n`;
      message += `💎 Balance: ${pos.spl_balance}\n`;
      message += `💵 Current Price: ${pnl.current_price} $\n`;
      message += `💵 Buy Price: ${pnl.buy_price} $\n`;
      message += `💵 PnL Amount: ${pnl.pnl_amount} $\n`;

      if (pnl) {
        console.log("pnl", pnl);
        const pnlEmoji = pnl.pnl_percentage >= 0 ? "📈" : "📉";
        const valueEmoji = pnl.pnl_percentage >= 0 ? "🤑" : "😰";
        message += `${pnlEmoji} PnL: ${pnl.pnl_percentage}%\n`;
        message += `${valueEmoji} Value: ${pos.spl_balance * pnl.current_price} $\n`;
      }
      message += "\n";
    }

    await bot.sendMessage(msg.chat.id, message, { parse_mode: "HTML" });
  } catch (error) {
    console.error("Error fetching positions:", error);
    await bot.sendMessage(
      msg.chat.id,
      "😭 Oops! Something went wrong fetching your positions. Please try again! 🔄"
    );
  }
}
async function subscribe(msg) {
  const uri = "wss://pumpportal.fun/api/data";
  const ws = new WebSocket(uri);

  ws.on("open", () => {
    // Subscribing to token creation events
    // const payload = {
    //   method: "subscribeNewToken",
    // };
    // ws.send(JSON.stringify(payload));

    // Subscribing to trades made by accounts
    const accountPayload = {
      method: "subscribeAccountTrade",
      keys: ["4HzieLPvRToXQjxwupzLPyotgki6R9WbQw6E2dC3G2on"], // array of accounts to watch
    };
    ws.send(JSON.stringify(accountPayload));

    // Subscribing to trades on tokens
    // const tokenPayload = {
    //   method: "subscribeTokenTrade",
    //   keys: ["91WNez8D22NwBssQbkzjy4s2ipFrzpmn5hfvWVe2aY5p"], // array of token CAs to watch
    // };
    // ws.send(JSON.stringify(tokenPayload));
  });

  ws.on("message", async (message) => {
    if (!running) {
      ws.close();
      return;
    }

    try {
      const data = JSON.parse(message);
      

      // Create styled message based on transaction type
      if (data.txType === "buy") {
        
        // const spl_tokens = await getSPLTokens(PUBLIC_KEY);
        
        console.log("🔄 new token", JSON.stringify(data.mint));
        const formattedMessage = `🔄 new token ${data.mint}`;

        // await monitoring_buy_one(data.mint);
        // monitoring_buy_all();
        // await monitoring_sell();
        await monitoring_sell_all();
        // await token_buy(data.mint, 0.0001);

        await bot.sendMessage(msg.chat.id, formattedMessage, {
          parse_mode: "HTML",
        });
        // const score = await get_token_score(data.mint);
        // if (score < 20) {
        //   console.log("❔ Token is not safe 0-20% - skipping");
        // } else if (score < 40) {
        //   const formattedMessage = `💛 Token is safe to buy 20-30%`;
        //   console.log(formattedMessage);
        //   await bot.sendMessage(msg.chat.id, formattedMessage, {
        //     parse_mode: "HTML",
        //   });
        // } else if (score < 60) {
        //   const formattedMessage = `💚 Token is safe to buy 30-55%`;
        //   console.log(formattedMessage);
        //   await bot.sendMessage(msg.chat.id, formattedMessage, {
        //     parse_mode: "HTML",
        //   });
        // } else {
        //   const formattedMessage = `💙 Token is safe to buy 55-100%`;
        //   console.log(formattedMessage);
        //   await bot.sendMessage(msg.chat.id, formattedMessage, {
        //     parse_mode: "HTML",
        //   });
        // }
        // Get metadata URI and parse for image

        // const result1 = await filterToken(data.mint);
        // console.log(result1);
        // const result2 = await token_analysis(data.mint);
        // console.log(result2);
        // const formattedMessage1 = `${data.name} \n ${data.mint} \n ${JSON.stringify(result1)}`
        // const formattedMessage2 = `🔍 <b>Token Analysis for ${data.name}</b>\n\n` +
        //     `📊 <b>Market Data:</b>\n` +
        //     `• Market Cap: ${result2.marketCapAnalysis.marketCap.toFixed(2)} SOL\n` +
        //     `• Price: ${Number(result2.marketCapAnalysis.price).toFixed(8)} SOL\n` +
        //     `• Total Supply: ${result2.marketCapAnalysis.totalSupply.toLocaleString()}\n\n` +
        //     `🛡️ <b>Security Analysis:</b>\n` +
        //     `• Mint Authority: ${result2.securityAnalysis.mintAuthority.status}\n` +
        //     `• Liquidity Lock: ${result2.securityAnalysis.liquidityLock.status}\n` +
        //     `• Top 10 Holders: ${result2.securityAnalysis.holderDistribution.top10Percentage}\n\n` +
        //     `⚠️ <b>Risk Assessment:</b>\n` +
        //     `• Security Score: ${result2.Security_Score}/100\n` +
        //     `• Risk Level: ${result2.riskLevel}\n` +
        //     `• High Risk Indicators: ${result2.highRiskIndicators}\n` +
        //     `• Moderate Risk Indicators: ${result2.moderateRiskIndicators}\n` +
        //     `• Low Risk Indicators: ${result2.lowRiskIndicators}\n\n` +
        //     `💰 LP Value: ${result2.lpValue.toFixed(2)} SOL\n\n` +
        //     `📝 <b>Recommendation:</b>\n${result2.recommendation}`
        // const formattedMessage =
        //   `🚀 <b>${data.name || "Unknown"}</b> ($${data.symbol || "N/A"})\n` +
        //   `💎 Buy: <code>${(
        //     data.initialBuy || 0
        //   ).toLocaleString()}</code> | SOL: <code>${(
        //     data.solAmount || 0
        //   ).toFixed(2)}</code>◎ | MC: <code>${(data.marketCapSol || 0).toFixed(
        //     2
        //   )}</code>◎\n` +
        //   `🏦 Pool: ${(data.pool || "N/A").toUpperCase()} | 🔗 <code>${(
        //     data.mint || "N/A"
        //   )}</code>\n` +
        //   `🌊 BC: <code>${(
        //     data.vTokensInBondingCurve || 0
        //   ).toLocaleString()}</code> tokens, <code>${(
        //     data.vSolInBondingCurve || 0
        //   ).toFixed(2)}</code>◎` +
        //   `\n` +
        //   `🔍 <b>Token Analysis for ${data.name}</b>\n\n` +
        //   `💰 Security Score: ${await get_token_score(data.mint)}/100`;

        // Send image first if available

        
      } else {
        // Handle other transaction types...
        const formattedMessage = JSON.stringify(data, null, 2);
        await bot.sendMessage(msg.chat.id, formattedMessage, {
          parse_mode: "HTML",
        });
      }
    } catch (error) {
      console.error("Error processing message:", error);
    }
  });

  ws.on("close", () => {
    console.log("WebSocket connection closed");
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });
}

function main() {
  try {
    
    // Add command handlers
    bot.onText(/\/start/, start);
    bot.onText(/\/stop/, stop);
    // bot.onText(/\/help/, help);
    bot.onText(/\/getBalance/, Balance);
    bot.onText(/\/position/, Position);

    console.log("👟👟Bot is running...");
  } catch (error) {
    console.error("Fatal error:", error);
  }
}

main();
