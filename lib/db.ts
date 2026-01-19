// Database layer with automatic adapter selection
// Uses SQLite for local development, in-memory for serverless (Vercel)

import { TradeIntent, ExecutedTrade } from "./types";

// Detect if running on Vercel serverless environment
const isVercel = process.env.VERCEL === "1" || process.env.VERCEL_ENV !== undefined;

// Type definitions for our database interface
interface TradeIntentsOps {
  create: (intent: TradeIntent) => void;
  getById: (id: string) => TradeIntent | null;
  updateStatus: (id: string, status: "pending" | "paid" | "executed", paymentRequestId?: string) => void;
}

interface ExecutedTradesOps {
  create: (trade: ExecutedTrade) => void;
  getAll: (limit?: number) => Array<ExecutedTrade & { tradeIntent?: TradeIntent }>;
}

// Lazy-loaded adapters
let _tradeIntents: TradeIntentsOps | null = null;
let _executedTrades: ExecutedTradesOps | null = null;
let _getDb: (() => unknown) | null = null;

function initializeAdapters() {
  if (_tradeIntents && _executedTrades) return;

  if (isVercel) {
    // Use in-memory store for Vercel
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const memoryDb = require("./db-memory");
    _tradeIntents = memoryDb.memoryTradeIntents;
    _executedTrades = memoryDb.memoryExecutedTrades;
    _getDb = () => ({ inMemory: true });
    
    if (process.env.NODE_ENV !== "production") {
      console.log("[DB] Using in-memory store (Vercel environment)");
    }
  } else {
    // Use SQLite for local development
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require("better-sqlite3");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require("path");
    
    const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), "agentpay.db");
    let db: InstanceType<typeof Database> | null = null;

    const getDb = () => {
      if (!db) {
        db = new Database(dbPath);
        
        // Initialize tables
        db.exec(`
          CREATE TABLE IF NOT EXISTS trade_intents (
            id TEXT PRIMARY KEY,
            userAddress TEXT NOT NULL,
            agentId TEXT NOT NULL,
            symbol TEXT NOT NULL,
            side TEXT NOT NULL CHECK(side IN ('buy', 'sell')),
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
            swapTxHash TEXT NOT NULL,
            executionPrice REAL NOT NULL,
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
    };

    _getDb = getDb;

    // SQLite-based Trade Intent operations
    _tradeIntents = {
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const row = getDb().prepare("SELECT * FROM trade_intents WHERE id = ?").get(id) as any;
        if (!row) return null;
        return {
          id: row.id,
          userAddress: row.userAddress,
          agentId: row.agentId,
          symbol: row.symbol,
          side: row.side as "buy" | "sell",
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

    // SQLite-based Executed Trade operations
    _executedTrades = {
      create: (trade: ExecutedTrade): void => {
        getDb().prepare(`
          INSERT INTO executed_trades (
            id, tradeIntentId, paymentRequestId, paymentStatus,
            swapTxHash, executionPrice, timestamp, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          trade.id,
          trade.tradeIntentId,
          trade.paymentRequestId || null,
          trade.paymentStatus,
          trade.swapTxHash,
          trade.executionPrice,
          trade.timestamp,
          trade.status
        );
      },

      getAll: (limit: number = 50): Array<ExecutedTrade & { tradeIntent?: TradeIntent }> => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
          swapTxHash: row.swapTxHash,
          executionPrice: row.executionPrice,
          timestamp: row.timestamp,
          status: row.status as "executed",
          tradeIntent: row.symbol ? {
            id: row.tradeIntentId,
            userAddress: row.userAddress,
            agentId: row.agentId,
            symbol: row.symbol,
            side: row.side as "buy" | "sell",
            size: row.size,
            leverage: row.leverage,
            expectedPaymentAmount: "",
            status: "executed" as const,
            createdAt: row.timestamp,
          } : undefined,
        }));
      },
    };

    if (process.env.NODE_ENV !== "production") {
      console.log("[DB] Using SQLite database:", dbPath);
    }
  }
}

// Export proxies that initialize on first access
export const tradeIntents: TradeIntentsOps = {
  create: (intent) => {
    initializeAdapters();
    return _tradeIntents!.create(intent);
  },
  getById: (id) => {
    initializeAdapters();
    return _tradeIntents!.getById(id);
  },
  updateStatus: (id, status, paymentRequestId) => {
    initializeAdapters();
    return _tradeIntents!.updateStatus(id, status, paymentRequestId);
  },
};

export const executedTrades: ExecutedTradesOps = {
  create: (trade) => {
    initializeAdapters();
    return _executedTrades!.create(trade);
  },
  getAll: (limit) => {
    initializeAdapters();
    return _executedTrades!.getAll(limit);
  },
};

export default function getDb() {
  initializeAdapters();
  return _getDb!();
}

// Export environment detection for debugging
export const dbEnvironment = {
  isVercel,
  type: isVercel ? "memory" : "sqlite",
};
