import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  GuildMember,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("userinfo")
  .setDescription("Display information about a user")
  .addUserOption((option) =>
    option
      .setName("user")
      .setDescription("The user to look up (defaults to you)")
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const target = interaction.options.getUser("user") ?? interaction.user;
  const member = interaction.guild?.members.cache.get(target.id) as
    | GuildMember
    | undefined;

  const joinedAt = member?.joinedTimestamp
    ? Math.floor(member.joinedTimestamp / 1000)
    : null;
  const createdAt = Math.floor(target.createdTimestamp / 1000);

  const roles =
    member?.roles.cache
      .filter((r) => r.id !== interaction.guildId)
      .map((r) => r.toString())
      .slice(0, 10)
      .join(", ") || "None";

  const embed = new EmbedBuilder()
    .setColor(member?.displayColor ?? 0x5865f2)
    .setTitle(`👤 ${target.tag}`)
    .setThumbnail(target.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: "Account Created", value: `<t:${createdAt}:R>`, inline: true },
      joinedAt
        ? { name: "Joined Server", value: `<t:${joinedAt}:R>`, inline: true }
        : { name: "Status", value: "Not in server", inline: true },
      { name: "Roles", value: roles, inline: false }
    )
    .setFooter({ text: `User ID: ${target.id}` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
    }

