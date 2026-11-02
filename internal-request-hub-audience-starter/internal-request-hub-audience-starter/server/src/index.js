import { createApp } from "./app.js";
import { createDatabase } from "./db.js";

const port = Number(process.env.PORT ?? 3001);
const db = createDatabase(process.env.DB_FILE);
const app = createApp({ db });

const server = app.listen(port, () => {
  console.log(`Request Hub API listening on http://localhost:${port}`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
