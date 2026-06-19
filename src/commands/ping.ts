import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("ping")
  .setDescription("Check the bot's latency");

export async function execute(interaction: ChatInputCommandInteraction) {
  const sent = await interaction.reply({
    content: "Pinging...",
    fetchReply: true,
  });

  const latency = sent.createdTimestamp - interaction.createdTimestamp;
  const apiLatency = Math.round(interaction.client.ws.ping);

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("🏓 Pong!")
    .addFields(
      { name: "Roundtrip Latency", value: `${latency}ms`, inline: true },
      { name: "WebSocket Heartbeat", value: `${apiLatency}ms`, inline: true }
    )
    .setTimestamp();

  await interaction.editReply({ content: "", embeds: [embed] });
}
