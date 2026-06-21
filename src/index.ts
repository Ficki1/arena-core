import "dotenv/config";
import express from "express";
import {
  Client,
  GatewayIntentBits,
  Collection,
  Events,
  Interaction,
  ChatInputCommandInteraction,
  Message,
} from "discord.js";

import * as ping from "./commands/ping.js";
import * as help from "./commands/help.js";
import * as serverinfo from "./commands/serverinfo.js";
import * as userinfo from "./commands/userinfo.js";
import * as house from "./commands/house.js";
import * as xp from "./commands/xp.js";
import * as leaderboard from "./commands/leaderboard.js";
import * as mission from "./commands/mission.js";
import { tryEarnXp } from "./xp-manager.js";

/* ---------------- WEB SERVER ---------------- */

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.get("/", (_req, res) => {
  res.send("Arena bot is alive!");
});

app.listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

/* ---------------- DISCORD BOT ---------------- */

interface Command {
  data: { name: string; toJSON: () => unknown };
  execute: (
    interaction: ChatInputCommandInteraction
  ) => Promise<void>;
}

const token = process.env.DISCORD_BOT_TOKEN;

if (!token) {
  console.error("Missing DISCORD_BOT_TOKEN environment variable.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
});

const commands = new Collection<string, Command>();

const commandModules: Command[] = [
  ping,
  help,
  serverinfo,
  userinfo,
  house,
  xp,
  leaderboard,
  mission,
];

for (const mod of commandModules) {
  commands.set(mod.data.name, mod);
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`✅ Logged in as ${readyClient.user.tag}`);
  console.log(
    `📡 Serving ${readyClient.guilds.cache.size} server(s)`
  );
  console.log(
    `💬 Commands loaded: ${[...commands.keys()]
      .map((c) => `/${c}`)
      .join(", ")}`
  );
  console.log("⚡ XP system active");
});

client.on(Events.MessageCreate, (message: Message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  const roleNames =
    message.member?.roles.cache.map((r) => r.name) ?? [];

  const earned = tryEarnXp(
    message.author.id,
    message.guild.id,
    roleNames
  );

  if (earned !== null) {
    console.log(
      `⚡ ${message.author.tag} earned ${earned} XP in ${message.guild.name}`
    );
  }
});

client.on(
  Events.InteractionCreate,
  async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = commands.get(interaction.commandName);

    if (!command) {
      await interaction.reply({
        content: "Unknown command.",
        ephemeral: true,
      });
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);

      const msg = {
        content: "Something went wrong running that command.",
        ephemeral: true,
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg);
      } else {
        await interaction.reply(msg);
      }
    }
  }
);

client.login(token);
