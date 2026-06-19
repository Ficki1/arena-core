import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  GuildMember,
} from "discord.js";

const HOUSE_NAMES = [
  "Scribes",
  "Heralds",
  "Artisans",
  "Echoes",
  "Seers",
  "Forge Masters",
] as const;

const HOUSE_COLORS: Record<string, number> = {
  Scribes: 0x4a90d9,
  Heralds: 0xe8c84a,
  Artisans: 0x8b5cf6,
  Echoes: 0x34d399,
  Seers: 0xf97316,
  "Forge Masters": 0xef4444,
};

export const data = new SlashCommandBuilder()
  .setName("house")
  .setDescription("Join a House")
  .addStringOption((option) =>
    option
      .setName("role")
      .setDescription("The House you want to join")
      .setRequired(true)
      .addChoices(
        ...HOUSE_NAMES.map((name) => ({ name, value: name }))
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const guild = interaction.guild;
  if (!guild) {
    await interaction.editReply("This command can only be used in a server.");
    return;
  }

  const member = interaction.member as GuildMember;
  const chosenHouse = interaction.options.getString("role", true);

  const allRoles = await guild.roles.fetch();

  const targetRole = allRoles.find((r) => r.name === chosenHouse);
  if (!targetRole) {
    await interaction.editReply(
      `The role **${chosenHouse}** doesn't exist in this server. Please create it first.`
    );
    return;
  }

  const existingHouseRoles = member.roles.cache.filter((r) =>
    (HOUSE_NAMES as readonly string[]).includes(r.name)
  );

  for (const [, role] of existingHouseRoles) {
    await member.roles.remove(role);
  }

  await member.roles.add(targetRole);

  const color = HOUSE_COLORS[chosenHouse] ?? 0x5865f2;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`🏛️ House ${chosenHouse}`)
    .setDescription(
      `${member.toString()} has joined **House ${chosenHouse}**.`
    )
    .setTimestamp();

  if (existingHouseRoles.size > 0) {
    const previous = existingHouseRoles.map((r) => r.name).join(", ");
    embed.setFooter({ text: `Left: ${previous}` });
  }

  await interaction.editReply({ embeds: [embed] });
      }

