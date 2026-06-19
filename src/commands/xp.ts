import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  GuildMember,
} from "discord.js";
import { getUserXp, getHouseInfo, HOUSE_MULTIPLIERS } from "../xp-manager.js";

export const data = new SlashCommandBuilder()
  .setName("xp")
  .setDescription("Check your XP")
  .addUserOption((opt) =>
    opt
      .setName("user")
      .setDescription("User to check (defaults to you)")
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ content: "Server only.", ephemeral: true });
    return;
  }

  const target = interaction.options.getUser("user") ?? interaction.user;
  const member = await guild.members.fetch(target.id).catch(() => null) as GuildMember | null;

  const roleNames = member?.roles.cache.map((r) => r.name) ?? [];
  const { house, multiplier } = getHouseInfo(roleNames);
  const { xp, rank } = getUserXp(target.id, guild.id);

  const multiplierLabel = house
    ? `${house} — ${multiplier}x`
    : "No House — 1.0x";

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`⚡ ${target.username}'s XP`)
    .setThumbnail(target.displayAvatarURL({ size: 128 }))
    .addFields(
      { name: "XP", value: xp.toLocaleString(), inline: true },
      { name: "Rank", value: `#${rank}`, inline: true },
      { name: "House Multiplier", value: multiplierLabel, inline: true }
    )
    .setFooter({ text: "Earn XP by chatting · 60s cooldown between gains" })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

