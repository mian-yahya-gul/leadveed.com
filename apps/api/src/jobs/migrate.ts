import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { pool } from "../lib/db.js";

const schema = fileURLToPath(new URL("../../../../db/schema.sql", import.meta.url));
await pool.query(readFileSync(process.env.SCHEMA_FILE ?? schema, "utf8"));
console.log("schema applied");
await pool.end();
