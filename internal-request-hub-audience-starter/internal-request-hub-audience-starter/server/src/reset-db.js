import fs from "node:fs";
import { createDatabase, defaultDatabasePath } from "./db.js";

for (const suffix of ["", "-shm", "-wal"]) {
  fs.rmSync(`${defaultDatabasePath}${suffix}`, { force: true });
}

const db = createDatabase();
db.close();
console.log(`Reset database at ${defaultDatabasePath}`);
