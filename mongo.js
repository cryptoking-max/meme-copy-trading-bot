import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
const client = new MongoClient(MONGO_URI);
const db = client.db("sniperbot");
const users_collection = db.collection("users");
const trades_collection = db.collection("trades");
const tokens_collection = db.collection("tokens");

export async function getUser(chatId) {
    return await users_collection.findOne({ chat_id: chatId });
}

export async function createUser(chatId, username) {
    try {
        const newUser = {
            chat_id: chatId,
            username: username,
            balance: 10, // Initial balance of 10 SOL
            created_at: new Date(),
            positions: {}, // Current open positions
            trade_history: [], // History of all trades
            settings: {
                max_slippage: 1, // Default 1% slippage
                stop_loss: 5, // Default 5% stop loss
                take_profit: 10, // Default 10% take profit
                max_position_size: 2, // Max SOL per trade
                auto_trade: false
            },
            
            
        };
        await users_collection.insertOne(newUser);
        return true;
    } catch (e) {
        console.error(`Error creating user: ${e}`);
        return false;
    }
}

export async function updateUserSettings(chatId, settings) {
    try {
        const result = await users_collection.updateOne(
            { chat_id: chatId },
            { $set: { settings: settings } }
        );
        return Boolean(result.modifiedCount);
    } catch (e) {
        console.error(`Error updating user settings: ${e}`);
        return false;
    }
}

export async function recordTrade(chatId, tradeData) {
    try {
        const trade = {
            chat_id: chatId,
            token_address: tradeData.token_address,
            token_symbol: tradeData.token_symbol,
            type: tradeData.type, // 'buy' or 'sell'
            amount: tradeData.amount,
            price: tradeData.price,
            timestamp: new Date(),
            tx_hash: tradeData.tx_hash
        };
        
        await trades_collection.insertOne(trade);
        
        // Update user's trade history
        await users_collection.updateOne(
            { chat_id: chatId },
            { $push: { trade_history: trade } }
        );
        
        return true;
    } catch (e) {
        console.error(`Error recording trade: ${e}`);
        return false;
    }
}

export async function trackToken(tokenData) {
    try {
        const token = {
            address: tokenData.address,
            symbol: tokenData.symbol,
            name: tokenData.name,
            first_seen: new Date(),
            last_price: tokenData.price,
            price_history: [{
                price: tokenData.price,
                timestamp: new Date()
            }],
            // volume_24h: tokenData.volume || 0,
            market_cap: tokenData.market_cap || 0
        };
        
        await tokens_collection.updateOne(
            { address: tokenData.address },
            { $set: token },
            { upsert: true }
        );
        
        return true;
    } catch (e) {
        console.error(`Error tracking token: ${e}`);
        return false;
    }
}

export async function getUserPositions(chatId) {
    const user = await getUser(chatId);
    return user ? user.positions || {} : {};
}

export async function getTokenStats(address) {
    return await tokens_collection.findOne({ address });
}
export async function getTokenPrice(address){
    const token = await tokens_collection.findOne({ address });
    return token ? token.last_price : 0;
}

