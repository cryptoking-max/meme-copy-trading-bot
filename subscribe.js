import WebSocket from "ws";
import dotenv from "dotenv";
import TelegramBot from "node-telegram-bot-api";
// const TelegramBot = require("node-telegram-bot-api");

dotenv.config();
const TOKEN = process.env.TOKEN;
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

async function subscribe(msg) {
  const uri = "wss://pumpportal.fun/api/data";
  const ws = new WebSocket(uri);

  ws.on("open", () => {
    // Subscribing to token creation events
    const payload = {
      method: "subscribeNewToken",
    };
    ws.send(JSON.stringify(payload));

    // Subscribing to trades made by accounts
    // const accountPayload = {
    //   method: "subscribeAccountTrade",
    //   keys: ["4HzieLPvRToXQjxwupzLPyotgki6R9WbQw6E2dC3G2on"], // array of accounts to watch
    // };
    // ws.send(JSON.stringify(accountPayload));

    // const subscribeRaydiumLiquidity = {
    //   method: "subscribeRaydiumLiquidity",
    // };
    // ws.send(JSON.stringify(subscribeRaydiumLiquidity));

    // // Subscribing to trades on tokens
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
      console.log("🔄", data);

      // Create styled message based on transaction type
      if (data.txType === "create") {
        // Get metadata URI and parse for image
        const uri = data.uri || "";
        console.log(uri);
        let imageUrl = "";

        if (uri) {
          try {
            const response = await fetch(uri);
            const metadata = await response.json();
            imageUrl = metadata.image || "";
            console.log("image_url", imageUrl);
          } catch (error) {
            console.error("Error fetching metadata:", error);
          }
        }

        console.log(data);
        const formattedMessage =
          `🚀 <b>${data.name || "Unknown"}</b> ($${data.symbol || "N/A"})\n` +
          `💎 Buy: <code>${(
            data.initialBuy || 0
          ).toLocaleString()}</code> | SOL: <code>${(
            data.solAmount || 0
          ).toFixed(2)}</code>◎ | MC: <code>${(data.marketCapSol || 0).toFixed(
            2
          )}</code>◎\n` +
          `🏦 Pool: ${(data.pool || "N/A").toUpperCase()} | 🔗 <code>${(
            data.mint || "N/A"
          )}</code>\n` +
          `🌊 BC: <code>${(
            data.vTokensInBondingCurve || 0
          ).toLocaleString()}</code> tokens, <code>${(
            data.vSolInBondingCurve || 0
          ).toFixed(2)}</code>◎`;

        // Send image first if available

        await bot.sendMessage(msg.chat.id, formattedMessage, {
          parse_mode: "HTML",
        });
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

    console.log("👟👟Bot is running...");
  } catch (error) {
    console.error("Fatal error:", error);
  }
}

main();
