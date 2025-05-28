import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { swap, loadwallet, rpc_connection, createProvider } from "./swap.js";
import dotenv from "dotenv";
dotenv.config();
import fs from "fs";
import path from "path";
import { readFile, writeFile } from "fs/promises";
import axios from "axios";
import bs58 from "bs58";
// Remove unused json import since it's not needed
import nacl from "tweetnacl";

// Add null checks and default values for environment variables
const ACTION_TOKEN_DECIMALS = process.env.ACTION_TOKEN_DECIMALS || 9; // Default to 9 decimals
const USDC_DECIMALS = process.env.USDC_DECIMALS || 6; // Default to 6 decimals for USDC

const LAMPORTS_PER_SPL = 10 ** ACTION_TOKEN_DECIMALS;
const LAMPORTS_PER_USDC = 10 ** USDC_DECIMALS;
const SETTINGS_FILE = "settings.json";
let keypair;
try {
  const keyData = await readFile("keypair.json", "utf8");
  if (!keyData) {
    throw new Error("Empty keypair file");
  }
  const secretKey = new Uint8Array(JSON.parse(keyData));
  keypair = Keypair.fromSecretKey(secretKey);
} catch (error) {
  console.error("Error reading keypair file:", error);
  process.exit(1);
}

const saveSettings = async (settings) => {
  await writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));
};

const loadSettings = async () => {
  try {
    const data = await readFile(SETTINGS_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    // Return default settings if file doesn't exist
    return {
      auto: false,
      buyAmount: 0.1,
      takeProfitPercentage: 10,
      stopLossEnabled: false,
      stopLossPercentage: 10,
      min_usd_market_cap: 0,
      min_reply_count: 0,
      require_website: true,
      require_twitter: true,
      require_telegram: true,
      require_revoked_authority: true,
    };
  }
};

let settings = await loadSettings();
// console.log("🔧 Settings loaded:", settings);

// Save default settings if file doesn't exist
try {
  await readFile(SETTINGS_FILE);
} catch (error) {
  await saveSettings(settings);
}

export const getKeyPairFromPrivateKey = async (key) => {
  const { default: bs58 } = await import("bs58");
  return Keypair.fromSecretKey(new Uint8Array(bs58.decode(key)));
};
export const getPublicKeyFromPrivateKey = async (key) => {
  const keypair = await getKeyPairFromPrivateKey(key);
  return keypair.publicKey;
};
export const bufferFromUInt64 = (value) => {
  let buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(BigInt(value));
  return buffer;
};

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const getLatestCoin = async (limit = 1) => {
  const response = await fetch(
    `https://frontend-api.pump.fun/coins?offset=0&limit=${limit}&sort=created_timestamp&order=DESC&includeNsfw=true`
  );
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return response.json();
};

export const getCoinData = async (mint) => {
  const response = await fetch(`https://frontend-api.pump.fun/coins/${mint}`);
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return response.json();
};

export const getKingOfTheHillCoin = async () => {
  const response = await fetch(
    "https://frontend-api.pump.fun/coins/king-of-the-hill"
  );
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return response.json();
};

export const fetchLatestCoins = async (limit = 40) => {
  const response = await fetch(
    `https://frontend-api.pump.fun/coins?offset=0&limit=${limit}&sort=created_timestamp&order=DESC&includeNsfw=true`
  );
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return response.json();
};

export const checkIfAuthoritiesRevoked = async (mintAddress) => {
  const connection = rpc_connection();
  const mintPubkey = new PublicKey(mintAddress);
  const mintInfo = await connection.getParsedAccountInfo(
    mintPubkey,
    "confirmed"
  );
  console.log(mintInfo);

  if (mintInfo && mintInfo.value) {
    const { data } = mintInfo.value;
    const { mintAuthority, freezeAuthority } = data.parsed.info;
    return !mintAuthority && !freezeAuthority;
  }
  return false;
};

export const displayCoinDetails = async (coin) => {
  const isRevoked = await checkIfAuthoritiesRevoked(coin.mint);

  console.log(`
    Name: ${coin.name}
    Symbol: ${coin.symbol}
    Description: ${coin.description}
    Creator: ${coin.creator}
    total_supply: ${coin.total_supply}
    USD Market Cap: ${coin.usd_market_cap}
    SOL Market Cap: ${coin.market_cap}
    Created At: ${new Date(coin.created_timestamp).toLocaleString()}
    Twitter: ${coin.twitter || "N/A"}
    Telegram: ${coin.telegram || "N/A"}
    Website: ${coin.website || "N/A"}
    Freeze and Mint Authority Revoked: ${isRevoked ? "Yes" : "No"}
    `);

  const inquirer = await import("inquirer");
  const answers = await inquirer.default.prompt([
    {
      type: "list",
      name: "action",
      message: `What would you like to do with ${coin.name}?`,
      choices: [
        { name: "Buy this coin", value: "buy" },
        { name: "Return to latest coins", value: "return" },
      ],
    },
  ]);

  return answers.action;
};
export const token_buy = async (mint, sol_amount) => {
  const sol_address = "So11111111111111111111111111111111111111112";
  await swap(sol_address, mint, sol_amount * LAMPORTS_PER_SOL);

  console.log("buyed");
};
export const token_sell = async (mint, balance_percentage) => {
  const sol_address = "So11111111111111111111111111111111111111112";

  try {
    // Get token balance first
    const tokenBalance = await SPL_token_balance(mint);
    if (!tokenBalance) {
      throw new Error("No tokens to sell");
    }

    console.log("tokenBalance", tokenBalance);
    const tokenAmount = Math.floor(
      ((balance_percentage * tokenBalance) / 100.0) * LAMPORTS_PER_SPL
    );
    if (tokenAmount <= 0) {
        console.log(`⚠️ Cannot sell - token amount too small: ${tokenAmount}`);
        return;
      }
    if (tokenAmount < 10) {
      console.log("all sell tokenAmount", tokenAmount, mint);
      await swap(mint, sol_address, tokenAmount);
      return;
    }
    if (isNaN(tokenAmount) || tokenAmount < 0) {
      throw new Error(`Invalid token amount calculated: ${tokenAmount}`);
    }

    console.log(
      `Attempting to sell ${tokenAmount} tokens (${balance_percentage}% of balance ${mint})`
    );
    await swap(mint, sol_address, tokenAmount);
    console.log(
      `Successfully sold ${tokenAmount} tokens (${balance_percentage}% of balance)`
    );
  } catch (error) {
    console.error("Error in token_sell:", error.message);
    throw error;
  }
};
export const SPL_token_balance = async (mint) => {
  // mint_address = new PublicKey(mint)
  const SPLtoken_info = await getSPLTokens(process.env.PUBLIC_KEY);
  for (let i = 0; i < SPLtoken_info.length; i++) {
    if (SPLtoken_info[i].spl_mint === mint) {
      return SPLtoken_info[i].spl_balance;
    }
  }
};
export const getSPLTokens = async (walletAddress) => {
  const connection = rpc_connection();
  try {
    const publicKey = new PublicKey(walletAddress);

    // Get all token accounts for the wallet
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      publicKey,
      {
        programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
      }
    );

    if (tokenAccounts.value.length === 0) {
      console.log("No SPL tokens found.");
      return [];
    }

    console.log("SPL Tokens held by wallet:");
    const tokens = tokenAccounts.value.map((accountInfo) => {
      const tokenAmount =
        accountInfo.account.data.parsed.info.tokenAmount.uiAmount;
      const tokenMint = accountInfo.account.data.parsed.info.mint;
      // const token_price = accountInfo.account.data.parsed.info.tokenPrice
      // const token_price = await getTokenPrice(tokenMint)
      // console.log("token info",accountInfo.account.data.parsed.info)
      // console.log(
      //   `😇SPL_TOKEN_MINT: ${tokenMint} | 😇SPL_TOKEN_BALANCE: ${tokenAmount}`
      // );
      return {
        spl_mint: tokenMint,
        spl_balance: tokenAmount,
        // spl_price: token_price
      };
    });

    return tokens;
  } catch (error) {
    console.error("Error fetching SPL tokens:", error);
    return [];
  }
};

export const getTokenPrice = async (tokenMintAddress1) => {
  let config = {
    method: "get",
    maxBodyLength: Infinity,
    url: `https://api.jup.ag/price/v2?ids=${tokenMintAddress1}`,
    headers: {},
  };

  try {
    const response = await axios.request(config);
    const result = response.data;
    const price = result.data[`${tokenMintAddress1}`].price;
    // console.log(`Price in SOL: ${price}`);
    return price;
  } catch (error) {
    console.log(error);
    throw error;
  }
};
export const getTokenPrice_sol = async (tokenMintAddress1) => {
  let config = {
    method: "get",
    maxBodyLength: Infinity,
    url: `https://api.jup.ag/price/v2?ids=${tokenMintAddress1}&vsToken=So11111111111111111111111111111111111111112`,
    headers: {},
  };

  try {
    const response = await axios.request(config);
    const result = response.data;
    const price = result.data[`${tokenMintAddress1}`].price;
    // console.log(`Price in SOL: ${price}`);
    return price;
  } catch (error) {
    console.log(error);
    throw error;
  }
};
// export const getTokenPrice = async (mint) => {
//   try {
//     // First try Portal Pump
//     const tokenData = await getCoinData(mint);
//     if (tokenData) {
//       const marketCap = tokenData.market_cap;
//       const totalSupply = tokenData.total_supply;
//       // console.log("Market Cap (Portal Pump)", marketCap);
//       // console.log("Total Supply (Portal Pump)", totalSupply);
//       const tokenPrice = marketCap / (totalSupply / LAMPORTS_PER_SOL);
//       return tokenPrice;
//     }
//   } catch (error) {
//     console.log("Portal Pump API failed, trying DexScreener...");
//   }

//   try {
//     // Fallback to DexScreener
//     const response = await fetch(
//       `https://api.dexscreener.com/latest/dex/tokens/${mint}`
//     );
//     if (!response.ok)
//       throw new Error(`DexScreener HTTP error! status: ${response.status}`);

//     const data = await response.json();
//     if (data.pairs && data.pairs.length > 0) {
//       // Get the first pair (usually the most liquid one)
//       const pair = data.pairs[0];
//       console.log(`${mint} Price (DexScreener): $${pair.priceUsd}`);
//       // Convert USD price to SOL price using the SOL/USD price
//       const solResponse = await fetch(
//         "https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112"
//       );
//       const solData = await solResponse.json();
//       if (solData.pairs && solData.pairs.length > 0) {
//         const solPrice = solData.pairs[0].priceUsd;
//         const priceInSol = parseFloat(pair.priceUsd) / parseFloat(solPrice);
//         return priceInSol;
//       }
//     }
//   } catch (error) {
//     console.error("DexScreener API failed:", error);
//   }

//   console.log("Could not get price from either API");
//   return 0;
// };

export const getPnl = async (spl_mint) => {
  try {
    // Get current token price and balance
    const currentPrice = await getTokenPrice(spl_mint);
    const tokenBalance = await SPL_token_balance(spl_mint);
    if (tokenBalance === 0) {
      return {
        pnl_amount: 0,
        pnl_percentage: 0,
        current_price: currentPrice,
        buy_price: 0,
        spl_balance: tokenBalance,
      };
    }
    // Read trade history to find buy price
    let buyPrice = 0;
    try {
      const fileData = await readFile("token_trades.json", "utf8");
      const trades = JSON.parse(fileData);

      // Separate buy and sell trades for this token
      const buyTrades = trades.filter(
        (trade) => trade.address === spl_mint && trade.action === "buy"
      );
      const sellTrades = trades.filter(
        (trade) => trade.address === spl_mint && trade.action === "sell"
      );

      // Calculate total cost and amount for buys
      const totalBuyCost = buyTrades.reduce(
        (sum, trade) => sum + parseFloat(trade.price) * trade.splTokenAmount,
        0
      );
      const totalBuyAmount = buyTrades.reduce(
        (sum, trade) => sum + trade.splTokenAmount,
        0
      );

      // Calculate total cost and amount for sells
      const totalSellCost = sellTrades.reduce(
        (sum, trade) => sum + parseFloat(trade.price) * trade.splTokenAmount,
        0
      );
      const totalSellAmount = sellTrades.reduce(
        (sum, trade) => sum + trade.splTokenAmount,
        0
      );

      // Calculate net cost and net amount
      const netCost = totalBuyCost - totalSellCost;
      const netAmount = totalBuyAmount - totalSellAmount;
      
      // Calculate average buy price if net amount is positive
      if (tokenBalance > 0) {
        buyPrice = netCost / tokenBalance;
        console.log(`----${spl_mint}-------netCost-------------`, netCost);
        console.log(`----${spl_mint}-------tokenBalance-------------`, tokenBalance);
        console.log(`----${spl_mint}-------netAmount-------------`, netAmount);
        console.log(`----${spl_mint}-------buyPrice-------------`, buyPrice);
      }

    } catch (err) {
      console.warn("Could not read trade history:", err);
      return null;
    }

    if (buyPrice === 0) {
      console.warn("No buy price found for token");
      return null;
    }

    // Calculate PnL
    const pnlAmount = (currentPrice - buyPrice) * tokenBalance;
    const pnlPercentage = ((currentPrice - buyPrice) / buyPrice) * 100;

    return {
      pnl_amount: pnlAmount,
      pnl_percentage: pnlPercentage,
      current_price: currentPrice,
      buy_price: buyPrice,
      spl_balance: tokenBalance,
    };
  } catch (error) {
    console.error("Error calculating PnL:", error);
    return null;
  }
};


export const checkTokenForRug = async (mint_address, apiToken) => {
  try {
    const response = await fetch(
      `https://solsniffer.com/api/v2/token/refresh/${mint_address}`,
      {
        headers: {
          accept: "application/json",
          "X-API-KEY": apiToken,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const tokenData = data.tokenData;
    const tokenInfo = data.tokenInfo;

    // Analyze market cap and liquidity
    const marketCapAnalysis = {
      marketCap: tokenInfo.mktCap,
      totalSupply: tokenInfo.supplyAmount,
      price: tokenInfo.price,
    };

    // Analyze holder distribution
    const holders = tokenData.ownersList;
    const top10Percentage = calculateTop10Percentage(holders);
    const holderRisk = calculateHolderRisk(holders);

    // Analyze security aspects
    const securityAnalysis = {
      mintAuthority: {
        status: tokenData.auditRisk.mintDisabled ? "Low Risk" : "High Risk",
        details:
          "Mint authority " +
          (tokenData.auditRisk.mintDisabled
            ? "is disabled"
            : "is still enabled"),
      },
      liquidityLock: {
        status: tokenData.auditRisk.lpBurned ? "Low Risk" : "High Risk",
        details:
          "Liquidity " +
          (tokenData.auditRisk.lpBurned ? "is burned/locked" : "is not locked"),
      },
      holderDistribution: {
        status: holderRisk,
        top10Percentage: top10Percentage.toFixed(2) + "%",
        details: `Top 10 holders own ${top10Percentage.toFixed(2)}% of supply`,
      },
    };

    const analysis = {
      marketCapAnalysis,
      securityAnalysis,
      Security_Score: tokenData.score,
      riskLevel: getRiskLevel(tokenData.score),
      recommendation: getRiskRecommendation(tokenData.score),
      highRiskIndicators: tokenData.indicatorData.high.count,
      moderateRiskIndicators: tokenData.indicatorData.moderate.count,
      lowRiskIndicators: tokenData.indicatorData.low.count,
      lpValue:
        tokenData.liquidityList[0].pumpfun?.amount ||
        tokenData.liquidityList[0].raydium?.amount ||
        0,
    };

    // console.log("\n🔍 Token Risk Analysis Report:");
    // console.log("================================");
    // console.log(`Market Cap: $${analysis.marketCapAnalysis.marketCap.toFixed(2)}`);
    // console.log(`Price: $${analysis.marketCapAnalysis.price}`);
    // console.log(`Total Supply: ${analysis.marketCapAnalysis.totalSupply.toLocaleString()}`);
    // console.log("\n🛡️ Security Analysis:");
    // console.log(`Mint Authority: ${analysis.securityAnalysis.mintAuthority.status}`);
    // console.log(`Liquidity Lock: ${analysis.securityAnalysis.liquidityLock.status}`);
    // console.log(`Holder Distribution: ${analysis.securityAnalysis.holderDistribution.status}`);
    // console.log(`Top 10 Holders: ${analysis.securityAnalysis.holderDistribution.top10Percentage}`);
    // console.log("\n⚠️ Risk Assessment:");
    // console.log(`Security Score: ${analysis.Security_Score}/100`);
    // console.log(`Risk Level: ${analysis.riskLevel}`);
    // console.log(`Recommendation: ${analysis.recommendation}`);
    // console.log("\n🚨 Risk Indicators:");
    // console.log(`High Risk: ${analysis.highRiskIndicators}`);
    // console.log(`Moderate Risk: ${analysis.moderateRiskIndicators}`);
    // console.log(`Low Risk: ${analysis.lowRiskIndicators}`);
    // console.log(`LP Value: ${analysis.lpValue}`);
    // console.log("================================\n");

    return analysis;
  } catch (error) {
    console.error("Error checking token:", error);
    return null;
  }
};
export const token_analysis = async (mint_address) => {
  const analysis = await checkTokenForRug(
    mint_address,
    process.env.SOLSNIFFER_API_KEY
  );
  return analysis;
};
// Helper functions
const calculateHolderRisk = (holders) => {
  if (!holders || holders.length === 0) return "High Risk";
  if (holders.length < 100) return "High Risk";
  if (holders.length < 500) return "Medium Risk";
  return "Low Risk";
};

const calculateTop10Percentage = (holders) => {
  if (!holders || holders.length === 0) return 100;

  // Create a map to store highest percentage per address
  const addressPercentages = new Map();

  holders.forEach((holder) => {
    const percentage = parseFloat(holder.percentage);
    if (!isNaN(percentage)) {
      const existingPercentage = addressPercentages.get(holder.address) || 0;
      addressPercentages.set(
        holder.address,
        Math.max(existingPercentage, percentage)
      );
    }
  });

  // Convert map to array, sort by percentage and sum top 10
  return Array.from(addressPercentages.values())
    .sort((a, b) => b - a)
    .slice(0, 10)
    .reduce((sum, percentage) => sum + percentage, 0);
};

const getRiskLevel = (score) => {
  if (score >= 75) return "LOW RISK";
  if (score >= 50) return "MEDIUM RISK";
  if (score >= 25) return "HIGH RISK";
  return "VERY HIGH RISK";
};

const getRiskRecommendation = (score) => {
  if (score >= 75) return "ACCEPTABLE - Normal trading risks apply";
  if (score >= 50) return "MODERATE - Trade with caution";
  if (score >= 25) return "CAUTION - Trade with extreme caution";
  return "AVOID - Extremely high risk of rug pull";
};

// Add new environment variables with default values
const MAX_TOP_HOLDERS_PERCENTAGE = process.env.MAX_TOP_HOLDERS_PERCENTAGE || 80; // Default 80%
const MIN_SECURITY_SCORE = process.env.MIN_SECURITY_SCORE || 50; // Default 50
const MAX_LP_MARKET_CAP_RATIO = process.env.MAX_LP_MARKET_CAP_RATIO || 0.5; // Default 50%
const MIN_LP_MARKET_CAP_RATIO = process.env.MIN_LP_MARKET_CAP_RATIO || 0.1; // Default 10%
const REQUIRE_LIQUIDITY_LOCK = process.env.REQUIRE_LIQUIDITY_LOCK === "true"; // Default false
const REQUIRE_MINT_DISABLED = process.env.REQUIRE_MINT_DISABLED === "true"; // Default false

export const liquidity_value = async (mint_address) => {
  const analysis = await checkTokenForRug(
    mint_address,
    process.env.SOLSNIFFER_API_KEY
  );
  return analysis.lpValue;
};
export const lp_mckcap_percentage = async (mint_address) => {
  const analysis = await checkTokenForRug(
    mint_address,
    process.env.SOLSNIFFER_API_KEY
  );
  const marketCap = analysis.marketCapAnalysis.marketCap || 0;
  const lpValue = analysis.lpValue || 0;
  return marketCap > 0 ? (lpValue / marketCap) * 100 : 0;
};

export const filterToken = async (mint_address) => {
  try {
    const analysis = await checkTokenForRug(
      mint_address,
      process.env.SOLSNIFFER_API_KEY
    );

    if (!analysis) {
      console.log("❌ Could not perform token analysis");
      return false;
    }

    // Check Liquidity Lock
    if (
      REQUIRE_LIQUIDITY_LOCK &&
      analysis.securityAnalysis.liquidityLock.status === "High Risk"
    ) {
      console.log("❌ Failed Liquidity Lock check");
      return false;
    }

    // Check Mint Authority
    if (
      REQUIRE_MINT_DISABLED &&
      analysis.securityAnalysis.mintAuthority.status === "High Risk"
    ) {
      console.log("❌ Failed Mint Authority check");
      return false;
    }

    // Check Holder Distribution - ensure we have valid data
    const topHoldersPercentage = analysis.securityAnalysis.holderDistribution
      .top10Percentage
      ? parseFloat(analysis.securityAnalysis.holderDistribution.top10Percentage)
      : 100; // Default to 100% if data not available

    if (topHoldersPercentage > MAX_TOP_HOLDERS_PERCENTAGE) {
      console.log(
        `❌ Failed Holder Distribution check: ${topHoldersPercentage}% > ${MAX_TOP_HOLDERS_PERCENTAGE}%`
      );
      return false;
    }

    // Check LP to Market Cap ratio - ensure we have valid data
    const marketCap = analysis.marketCapAnalysis.marketCap || 0;
    const lpValue = analysis.lpValue || 0;
    const lpToMarketCapRatio = marketCap > 0 ? lpValue / marketCap : 0;

    if (
      lpToMarketCapRatio > MAX_LP_MARKET_CAP_RATIO ||
      lpToMarketCapRatio < MIN_LP_MARKET_CAP_RATIO
    ) {
      console.log(
        `❌ Failed LP/Market Cap ratio check: ${lpToMarketCapRatio.toFixed(
          4
        )} > ${MAX_LP_MARKET_CAP_RATIO}`
      );
      return false;
    }

    // Check Security Score (higher score is better)
    if (analysis.Security_Score < MIN_SECURITY_SCORE) {
      console.log(
        `❌ Failed Security Score check: ${analysis.Security_Score} < ${MIN_SECURITY_SCORE}`
      );
      return false;
    }

    // If all checks pass
    console.log("✅ Token passed all security checks:");
    console.log(
      `- Liquidity Lock: ${
        !REQUIRE_LIQUIDITY_LOCK ||
        analysis.securityAnalysis.liquidityLock.status === "Low Risk"
      }`
    );
    console.log(
      `- Mint Authority: ${
        !REQUIRE_MINT_DISABLED ||
        analysis.securityAnalysis.mintAuthority.status === "Low Risk"
      }`
    );
    console.log(
      `- Holder Distribution: ${topHoldersPercentage.toFixed(
        2
      )}% <= ${MAX_TOP_HOLDERS_PERCENTAGE}%`
    );
    console.log(
      `- LP/Market Cap Ratio: ${lpToMarketCapRatio.toFixed(
        4
      )} <= ${MAX_LP_MARKET_CAP_RATIO}`
    );
    console.log(
      `- Security Score: ${analysis.Security_Score} >= ${MIN_SECURITY_SCORE}`
    );
    return true;
  } catch (error) {
    console.error("Error filtering token:", error);
    return false;
  }
};