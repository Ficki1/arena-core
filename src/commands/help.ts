import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("help")
  .setDescription("Show all available commands");

export async function execute(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("📖 Help — Available Commands")
    .setDescription("Here are all the commands you can use:")
    .addFields(
      {
        name: "/ping",
        value: "Check bot latency",
        inline: false,
      },
      {
        name: "/help",
        value: "Show this help message",
        inline: false,
      },
      {
        name: "/house",
        value: "Choose or view your Arena House",
        inline: false,
      },
      {
        name: "/xp",
        value: "Check XP and rank",
        inline: false,
      },
      {
        name: "/leaderboard",
        value: "View top contributors",
        inline: false,
      },
      {
        name: "/mission",
        value: "Claim and submit missions",
        inline: false,
      }
    )
    .setFooter({ text: "Use / to trigger commands" })
    .setTimestamp();

  await interaction.reply({
    embeds: [embed],
    ephemeral: true,
  });
        }
