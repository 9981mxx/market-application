import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import mysql from "mysql2/promise";

const projectRoot = path.resolve(import.meta.dirname, "..");
const databaseName = process.env.MYSQL_DATABASE || "market_application";

if (!/^[A-Za-z0-9_]+$/.test(databaseName)) {
  throw new Error("MYSQL_DATABASE may contain only letters, numbers, and underscores");
}

for (const name of ["MYSQL_HOST", "MYSQL_USER", "MYSQL_PASSWORD"]) {
  if (!process.env[name]) throw new Error(`${name} is required`);
}

function findSourceDatabase() {
  const configured = process.env.D1_SOURCE_FILE;
  if (configured) return path.resolve(projectRoot, configured);

  const directory = path.join(
    projectRoot,
    ".wrangler",
    "state",
    "v3",
    "d1",
    "miniflare-D1DatabaseObject",
  );
  const candidates = fs.readdirSync(directory)
    .filter((name) => name.endsWith(".sqlite") && name !== "metadata.sqlite")
    .map((name) => path.join(directory, name))
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs);

  if (!candidates[0]) throw new Error(`No local D1 database found in ${directory}`);
  return candidates[0];
}

const sourcePath = findSourceDatabase();
if (!fs.existsSync(sourcePath)) throw new Error(`D1 source file does not exist: ${sourcePath}`);

const tables = [
  "roles",
  "role_permissions",
  "accounts",
  "sessions",
  "channels",
  "end_users",
  "invitations",
  "invitation_bindings",
  "audit_logs",
  "withdrawal_requests",
  "notifications",
  "file_assets",
  "system_configs",
  "backup_runs",
];
const deleteOrder = [
  "backup_runs",
  "file_assets",
  "notifications",
  "withdrawal_requests",
  "invitation_bindings",
  "invitations",
  "end_users",
  "channels",
  "sessions",
  "accounts",
  "role_permissions",
  "roles",
  "audit_logs",
];

const sqlite = new DatabaseSync(sourcePath, { readOnly: true });
const rowsByTable = Object.fromEntries(
  tables.map((table) => [table, sqlite.prepare(`SELECT * FROM ${table}`).all()]),
);

const connection = await mysql.createConnection({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  charset: "utf8mb4",
  multipleStatements: true,
});

try {
  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`,
  );
  await connection.changeUser({ database: databaseName });
  const schema = fs.readFileSync(path.join(projectRoot, "db", "mysql-schema.sql"), "utf8");
  await connection.query(schema);

  await connection.beginTransaction();
  for (const table of deleteOrder) await connection.query(`DELETE FROM \`${table}\``);

  for (const table of tables) {
    for (const row of rowsByTable[table]) {
      const columns = Object.keys(row);
      const placeholders = columns.map(() => "?").join(", ");
      const identifiers = columns.map((column) => `\`${column}\``).join(", ");
      const values = columns.map((column) => {
        const value = row[column];
        if (value && column.endsWith("_at") && typeof value === "string" && value.includes("T")) {
          const date = new Date(value);
          if (!Number.isNaN(date.valueOf())) return date.toISOString().slice(0, 19).replace("T", " ");
        }
        return value;
      });
      await connection.execute(
        `INSERT INTO \`${table}\` (${identifiers}) VALUES (${placeholders})`,
        values,
      );
    }
  }

  const counts = Object.fromEntries(tables.map((table) => [table, rowsByTable[table].length]));
  await connection.execute(
    "INSERT INTO data_sync_runs (source_type, source_path, row_counts) VALUES ('cloudflare-d1-local', ?, ?)",
    [path.relative(projectRoot, sourcePath), JSON.stringify(counts)],
  );
  await connection.commit();

  console.log(`Synced local D1 data to MySQL database ${databaseName}.`);
  for (const [table, count] of Object.entries(counts)) console.log(`${table}: ${count}`);
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  sqlite.close();
  await connection.end();
}