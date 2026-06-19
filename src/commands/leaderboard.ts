import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import { getLeaderboard } from "../xp-manager.js";

export const data = new SlashCommandBuilder()
  .setName("leaderboard")
  .setDescription("Show the top 10 XP earners in this server");

const MEDALS = ["🥇", "🥈", "🥉"];

export async function execute(interaction: ChatInputCommandInteraction) {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ content: "Server only.", ephemeral: true });
    return;
  }

  await interaction.deferReply();

  const rows = getLeaderboard(guild.id, 10);

  if (rows.length === 0) {
    await interaction.editReply("No XP has been earned yet. Start chatting!");
    return;
  }

  const lines = await Promise.all(
    rows.map(async ({ user_id, xp }, i) => {
      const medal = MEDALS[i] ?? `**${i + 1}.**`;
      let label: string;
      try {
        const member = await guild.members.fetch(user_id);
        label = member.displayName;
      } catch {
        label = `<@${user_id}>`;
      }
      return `${medal} ${label} — ${xp.toLocaleString()} XP`;
    })
  );

  const embed = new EmbedBuilder()
    .setColor(0xf8c300)
    .setTitle("🏆 XP Leaderboard")
    .setDescription(lines.join("\n"))
    .setFooter({ text: `${guild.name} · Top ${rows.length}` })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
