import express from "express";
import { Client, GatewayIntentBits, Collection, Events } from "discord.js";
...

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.get("/", (_req, res) => {
  res.send("Arena bot is alive");
});

app.listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

// ---- your Discord bot starts here ----

const client = new Client({...});
...
client.login(token);
