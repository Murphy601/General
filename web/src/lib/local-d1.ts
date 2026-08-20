import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { D1Database, D1PreparedStatement } from './env';

type SqlValue = null | number | bigint | string | Uint8Array;

const DEFAULT_DB_PATH = join(process.cwd(), '.data', 'accounts.sqlite');
const MIGRATION_PATH = join(process.cwd(), 'migrations', '0001_init.sql');

let sqlite: DatabaseSync | null = null;
let wrapped: D1Database | null = null;
let openedPath = '';

function dbPath() {
  return process.env.LOCAL_ACCOUNTS_DB || DEFAULT_DB_PATH;
}

class LocalStatement implements D1PreparedStatement {
  private values: unknown[] = [];
  private readonly database: DatabaseSync;
  private readonly sql: string;

  constructor(database: DatabaseSync, sql: string) {
    this.database = database;
    this.sql = sql;
  }

  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }

  private args(): SqlValue[] {
    return this.values as SqlValue[];
  }

  async first<T = Record<string, unknown>>() {
    const row = this.database.prepare(this.sql).get(...this.args());
    return ((row as T) ?? null) as T | null;
  }

  async all<T = Record<string, unknown>>() {
    const results = this.database.prepare(this.sql).all(...this.args()) as T[];
    return { results };
  }

  async run() {
    try {
      this.database.prepare(this.sql).run(...this.args());
      return { success: true };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      throw new Error(error);
    }
  }
}

function openSqlite(): DatabaseSync {
  const path = dbPath();
  if (sqlite && openedPath === path) return sqlite;
  mkdirSync(dirname(path), { recursive: true });
  sqlite = new DatabaseSync(path);
  openedPath = path;
  if (existsSync(MIGRATION_PATH)) {
    sqlite.exec(readFileSync(MIGRATION_PATH, 'utf8'));
  }
  wrapped = {
    prepare: (query: string) => new LocalStatement(sqlite!, query),
  };
  return sqlite;
}

/** File-backed D1 stand-in for `next dev` / local tests. Not used on the Worker. */
export function getLocalDb(): D1Database {
  openSqlite();
  return wrapped!;
}

export function resetLocalDbCache() {
  sqlite?.close();
  sqlite = null;
  wrapped = null;
  openedPath = '';
}
