import { REST, Routes } from "discord.js";
import * as ping from "./commands/ping.js";
import * as help from "./commands/help.js";
import * as serverinfo from "./commands/serverinfo.js";
import * as userinfo from "./commands/userinfo.js";
import * as house from "./commands/house.js";
import * as xp from "./commands/xp.js";
import * as leaderboard from "./commands/leaderboard.js";
import * as mission from "./commands/mission.js";

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;

if (!token || !clientId) {
  console.error(
    "Missing required environment variables: DISCORD_BOT_TOKEN and/or DISCORD_CLIENT_ID"
  );
  process.exit(1);
}

const commands = [ping, help, serverinfo, userinfo, house, xp, leaderboard, mission].map(
  (mod) => mod.data.toJSON()
);

const rest = new REST().setToken(token);

(async () => {
  try {
    console.log(`Registering ${commands.length} slash command(s) globally...`);

    const data = await rest.put(Routes.applicationCommands(clientId), {
      body: commands,
    });

    console.log(
      `✅ Successfully registered ${(data as unknown[]).length} slash command(s).`
    );
  } catch (error) {
    console.error("Failed to register commands:", error);
    process.exit(1);
  }
})();
                  
