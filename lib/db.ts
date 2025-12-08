// SQLite database setup for MVP
import Database from "better-sqlite3";
import path from "path";
import { TradeIntent, ExecutedTrade } from "./types";

const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), "agentpay.db");

// Lazy database initialization to avoid build-time issues
let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(dbPath);
    
    // Initialize tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS trade_intents (
        id TEXT PRIMARY KEY,
        userAddress TEXT NOT NULL,
        agentId TEXT NOT NULL,
        symbol TEXT NOT NULL,
        side TEXT NOT NULL CHECK(side IN ('long', 'short')),
        size REAL NOT NULL,
        leverage INTEGER NOT NULL,
        expectedPaymentAmount TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending', 'paid', 'executed')),
        paymentRequestId TEXT,
        createdAt INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS executed_trades (
        id TEXT PRIMARY KEY,
        tradeIntentId TEXT NOT NULL,
        paymentRequestId TEXT,
        paymentStatus TEXT NOT NULL CHECK(paymentStatus IN ('paid', 'failed')),
        perpTxHash TEXT NOT NULL,
        entryPrice REAL NOT NULL,
        timestamp INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'executed',
        FOREIGN KEY (tradeIntentId) REFERENCES trade_intents(id)
      );

      CREATE INDEX IF NOT EXISTS idx_trade_intents_user ON trade_intents(userAddress);
      CREATE INDEX IF NOT EXISTS idx_trade_intents_status ON trade_intents(status);
      CREATE INDEX IF NOT EXISTS idx_executed_trades_timestamp ON executed_trades(timestamp DESC);
    `);
  }
  return db;
}

// Trade Intent operations
export const tradeIntents = {
  create: (intent: TradeIntent): void => {
    getDb().prepare(`
      INSERT INTO trade_intents (
        id, userAddress, agentId, symbol, side, size, leverage,
        expectedPaymentAmount, status, paymentRequestId, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      intent.id,
      intent.userAddress,
      intent.agentId,
      intent.symbol,
      intent.side,
      intent.size,
      intent.leverage,
      intent.expectedPaymentAmount,
      intent.status,
      intent.paymentRequestId || null,
      intent.createdAt
    );
  },

  getById: (id: string): TradeIntent | null => {
    const row = getDb().prepare("SELECT * FROM trade_intents WHERE id = ?").get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      userAddress: row.userAddress,
      agentId: row.agentId,
      symbol: row.symbol,
      side: row.side as "long" | "short",
      size: row.size,
      leverage: row.leverage,
      expectedPaymentAmount: row.expectedPaymentAmount,
      status: row.status as "pending" | "paid" | "executed",
      paymentRequestId: row.paymentRequestId || undefined,
      createdAt: row.createdAt,
    };
  },

  updateStatus: (id: string, status: "pending" | "paid" | "executed", paymentRequestId?: string): void => {
    if (paymentRequestId) {
      getDb().prepare("UPDATE trade_intents SET status = ?, paymentRequestId = ? WHERE id = ?").run(
        status,
        paymentRequestId,
        id
      );
    } else {
      getDb().prepare("UPDATE trade_intents SET status = ? WHERE id = ?").run(status, id);
    }
  },
};

// Executed Trade operations
export const executedTrades = {
  create: (trade: ExecutedTrade): void => {
    getDb().prepare(`
      INSERT INTO executed_trades (
        id, tradeIntentId, paymentRequestId, paymentStatus,
        perpTxHash, entryPrice, timestamp, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      trade.id,
      trade.tradeIntentId,
      trade.paymentRequestId || null,
      trade.paymentStatus,
      trade.perpTxHash,
      trade.entryPrice,
      trade.timestamp,
      trade.status
    );
  },

  getAll: (limit: number = 50): Array<ExecutedTrade & { tradeIntent?: TradeIntent }> => {
    const rows = getDb().prepare(`
      SELECT 
        et.*,
        ti.userAddress,
        ti.agentId,
        ti.symbol,
        ti.side,
        ti.size,
        ti.leverage
      FROM executed_trades et
      LEFT JOIN trade_intents ti ON et.tradeIntentId = ti.id
      ORDER BY et.timestamp DESC
      LIMIT ?
    `).all(limit) as any[];

    return rows.map((row) => ({
      id: row.id,
      tradeIntentId: row.tradeIntentId,
      paymentRequestId: row.paymentRequestId || undefined,
      paymentStatus: row.paymentStatus as "paid" | "failed",
      perpTxHash: row.perpTxHash,
      entryPrice: row.entryPrice,
      timestamp: row.timestamp,
      status: row.status as "executed",
      tradeIntent: row.symbol ? {
        id: row.tradeIntentId,
        userAddress: row.userAddress,
        agentId: row.agentId,
        symbol: row.symbol,
        side: row.side as "long" | "short",
        size: row.size,
        leverage: row.leverage,
        expectedPaymentAmount: "",
        status: "executed" as const,
        createdAt: row.timestamp,
      } : undefined,
    }));
  },
};

export default getDb;

