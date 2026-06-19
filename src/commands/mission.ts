import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  GuildMember,
  TextChannel,
  Guild,
} from "discord.js";
import db from "../database.js";
import { addXp, getHouseInfo } from "../xp-manager.js";

const HOUSE_NAMES = [
  "Scribes",
  "Heralds",
  "Artisans",
  "Echoes",
  "Seers",
  "Forge Masters",
] as const;

interface Mission {
  id: number;
  title: string;
  description: string;
  xp_reward: number;
  target_house: string | null;
  status: "active" | "claimed" | "completed";
  claimed_by: string | null;
  message_id: string | null;
  submission_text: string | null;
  submitted_at: number | null;
  verified_by: string | null;
}

// ── prepared statements ────────────────────────────────────────────────────

const stmtCreate = db.prepare<[string, string, string, number, string | null, string, number]>(
  `INSERT INTO missions (guild_id, title, description, xp_reward, target_house, created_by, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
);

const stmtSetMessageId = db.prepare<[string, number]>(
  `UPDATE missions SET message_id = ? WHERE id = ?`
);

const stmtList = db.prepare<[string]>(
  `SELECT id, title, description, xp_reward, target_house, status, claimed_by,
          message_id, submission_text, submitted_at, verified_by
   FROM missions
   WHERE guild_id = ? AND status IN ('active', 'claimed')
   ORDER BY created_at DESC`
);

const stmtGetById = db.prepare<[number, string]>(
  `SELECT id, title, description, xp_reward, target_house, status, claimed_by,
          message_id, submission_text, submitted_at, verified_by
   FROM missions WHERE id = ? AND guild_id = ?`
);

const stmtClaim = db.prepare<[string, number, string]>(
  `UPDATE missions SET status = 'claimed', claimed_by = ?
   WHERE id = ? AND guild_id = ?`
);

const stmtSubmit = db.prepare<[string, number, number, string]>(
  `UPDATE missions SET submission_text = ?, submitted_at = ?
   WHERE id = ? AND guild_id = ?`
);

const stmtComplete = db.prepare<[string, number, string]>(
  `UPDATE missions SET status = 'completed', verified_by = ?
   WHERE id = ? AND guild_id = ?`
);

// ── helpers ────────────────────────────────────────────────────────────────

async function fetchTextChannel(guild: Guild, name: string): Promise<TextChannel | null> {
  try {
    await guild.channels.fetch();
  } catch (e) {
    console.error(`[mission] failed to fetch channels:`, e);
  }
  return (
    (guild.channels.cache.find(
      (c) => c.isTextBased() && c.name === name
    ) as TextChannel) ?? null
  );
}

async function fetchMember(guild: Guild, userId: string): Promise<GuildMember | null> {
  try {
    return await guild.members.fetch(userId);
  } catch {
    return null;
  }
}

function buildMissionEmbed(mission: Mission): EmbedBuilder {
  const isClaimed = mission.status === "claimed";

  return new EmbedBuilder()
    .setColor(isClaimed ? 0xf59e0b : 0x5865f2)
    .setTitle(`${isClaimed ? "⚡" : "📋"} ${mission.title}`)
    .setDescription(mission.description)
    .addFields(
      { name: "XP Reward", value: `${mission.xp_reward.toLocaleString()} XP`, inline: true },
      {
        name: "Eligible",
        value: mission.target_house ? `🏛️ ${mission.target_house}` : "🌐 All Houses",
        inline: true,
      },
      { name: "Mission ID", value: `#${mission.id}`, inline: true },
      {
        name: "Status",
        value: isClaimed ? `⚡ Claimed by <@${mission.claimed_by}>` : "✅ Available",
      }
    )
    .setFooter({
      text: isClaimed
        ? "This mission has been claimed"
        : `Use /mission claim ${mission.id} to take this mission`,
    })
    .setTimestamp();
}

async function postOrEditMissionsChannel(guild: Guild, mission: Mission): Promise<void> {
  const ch = await fetchTextChannel(guild, "missions");
  if (!ch) {
    console.warn(`[mission] #missions channel not found in ${guild.name}`);
    return;
  }

  const embed = buildMissionEmbed(mission);

  if (mission.message_id) {
    try {
      const msg = await ch.messages.fetch(mission.message_id);
      await msg.edit({ embeds: [embed] });
      return;
    } catch (e) {
      console.warn(`[mission] could not edit message ${mission.message_id}, reposting:`, e);
    }
  }

  const sent = await ch.send({ embeds: [embed] });
  stmtSetMessageId.run(sent.id, mission.id);
}

// ── slash command definition ───────────────────────────────────────────────

export const data = new SlashCommandBuilder()
  .setName("mission")
  .setDescription("Mission system")
  .addSubcommand((sub) =>
    sub
      .setName("create")
      .setDescription("Create a new mission [Admin only]")
      .addStringOption((opt) =>
        opt.setName("title").setDescription("Mission title").setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName("description").setDescription("What members need to do").setRequired(true)
      )
      .addIntegerOption((opt) =>
        opt
          .setName("xp")
          .setDescription("XP reward for completion")
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(100_000)
      )
      .addStringOption((opt) =>
        opt
          .setName("house")
          .setDescription("Restrict to a specific House (leave blank for all)")
          .setRequired(false)
          .addChoices(...HOUSE_NAMES.map((h) => ({ name: h, value: h })))
      )
  )
  .addSubcommand((sub) =>
    sub.setName("list").setDescription("List all active and claimed missions")
  )
  .addSubcommand((sub) =>
    sub
      .setName("claim")
      .setDescription("Claim a mission")
      .addIntegerOption((opt) =>
        opt.setName("id").setDescription("Mission ID to claim").setRequired(true).setMinValue(1)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("submit")
      .setDescription("Submit proof for your claimed mission")
      .addIntegerOption((opt) =>
        opt.setName("id").setDescription("Mission ID").setRequired(true).setMinValue(1)
      )
      .addStringOption((opt) =>
        opt
          .setName("proof")
          .setDescription("Proof of completion — text description or link")
          .setRequired(true)
          .setMaxLength(1000)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("complete")
      .setDescription("Approve a submitted mission and award XP [Admin only]")
      .addIntegerOption((opt) =>
        opt.setName("id").setDescription("Mission ID to complete").setRequired(true).setMinValue(1)
      )
  );

// ── subcommand handlers ────────────────────────────────────────────────────

async function handleCreate(interaction: ChatInputCommandInteraction) {
  const member = interaction.member as GuildMember;
  if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: "❌ Only admins can create missions.", ephemeral: true });
    return;
  }

  const guild = interaction.guild!;
  const title = interaction.options.getString("title", true);
  const description = interaction.options.getString("description", true);
  const xpReward = interaction.options.getInteger("xp", true);
  const targetHouse = interaction.options.getString("house") ?? null;

  const result = stmtCreate.run(
    guild.id, title, description, xpReward, targetHouse,
    interaction.user.id, Date.now()
  );
  const missionId = Number(result.lastInsertRowid);

  await interaction.reply({
    content: `✅ Mission **${title}** created (ID #${missionId}).`,
    ephemeral: true,
  });

  const mission: Mission = {
    id: missionId,
    title,
    description,
    xp_reward: xpReward,
    target_house: targetHouse,
    status: "active",
    claimed_by: null,
    message_id: null,
    submission_text: null,
    submitted_at: null,
    verified_by: null,
  };

  await postOrEditMissionsChannel(guild, mission);
}

async function handleList(interaction: ChatInputCommandInteraction) {
  const rows = stmtList.all(interaction.guildId!) as Mission[];

  if (rows.length === 0) {
    await interaction.reply({ content: "No active missions right now.", ephemeral: true });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("📋 Missions")
    .setFooter({ text: `${rows.length} mission${rows.length === 1 ? "" : "s"}` })
    .setTimestamp();

  for (const row of rows.slice(0, 10)) {
    let statusLine: string;
    if (row.status === "claimed" && row.submission_text) {
      statusLine = `📨 Submitted by <@${row.claimed_by}> — awaiting review`;
    } else if (row.status === "claimed") {
      statusLine = `⚡ Claimed by <@${row.claimed_by}>`;
    } else {
      statusLine = "✅ Available";
    }

    embed.addFields({
      name: `#${row.id} — ${row.title}`,
      value: [
        row.description,
        `**XP:** ${row.xp_reward.toLocaleString()} · **Eligible:** ${row.target_house ?? "All Houses"}`,
        `**Status:** ${statusLine}`,
      ].join("\n"),
    });
  }

  await interaction.reply({ embeds: [embed] });
}

async function handleClaim(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild!;
  const missionId = interaction.options.getInteger("id", true);
  const mission = stmtGetById.get(missionId, guild.id) as Mission | undefined;

  console.log(`[claim] pre-claim  id=${missionId} status=${mission?.status ?? "not found"} claimedBy=${mission?.claimed_by ?? "null"}`);

  if (!mission) {
    await interaction.editReply(`❌ Mission #${missionId} not found.`);
    return;
  }

  if (mission.status !== "active") {
    const who = mission.claimed_by ? ` by <@${mission.claimed_by}>` : "";
    await interaction.editReply(`❌ Mission #${missionId} is already claimed${who}.`);
    return;
  }

  if (mission.target_house) {
    const member = await fetchMember(guild, interaction.user.id);
    if (!member) {
      await interaction.editReply("❌ Could not verify your roles. Please try again.");
      return;
    }
    const roleNames = member.roles.cache.map((r) => r.name);
    if (!roleNames.includes(mission.target_house)) {
      await interaction.editReply(
        `❌ This mission is restricted to **${mission.target_house}**.`
      );
      return;
    }
  }

  const claimResult = stmtClaim.run(interaction.user.id, missionId, guild.id);

  // Re-read from DB to confirm what was actually written
  const after = stmtGetById.get(missionId, guild.id) as Mission | undefined;
  console.log(`[claim] post-claim id=${missionId} changes=${claimResult.changes} status=${after?.status ?? "?"} claimedBy=${after?.claimed_by ?? "null"}`);

  if (claimResult.changes === 0) {
    console.error(`[claim] UPDATE affected 0 rows for mission #${missionId} — claim failed silently`);
    await interaction.editReply(`❌ Failed to claim mission #${missionId}. Please try again.`);
    return;
  }

  await interaction.editReply(`⚔️ You claimed **${mission.title}**! Good luck.`);

  const updatedMission: Mission = {
    ...mission,
    status: "claimed",
    claimed_by: interaction.user.id,
  };

  await postOrEditMissionsChannel(guild, updatedMission);
}

async function handleSubmit(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild!;
  const missionId = interaction.options.getInteger("id", true);
  const proof = interaction.options.getString("proof", true);
  const mission = stmtGetById.get(missionId, guild.id) as Mission | undefined;

  console.log(`[submit] id=${missionId} status=${mission?.status ?? "not found"} claimedBy=${mission?.claimed_by ?? "null"} submittingUser=${interaction.user.id}`);

  if (!mission) {
    await interaction.editReply(`❌ Mission #${missionId} not found.`);
    return;
  }

  if (mission.status !== "claimed") {
    await interaction.editReply(
      `❌ Mission #${missionId} status is "${mission.status}" — only claimed missions can be submitted.`
    );
    return;
  }

  if (mission.claimed_by !== interaction.user.id) {
    await interaction.editReply(
      `❌ You haven't claimed mission #${missionId} (claimed by <@${mission.claimed_by}>).`
    );
    return;
  }

  const submitResult = stmtSubmit.run(proof, Date.now(), missionId, guild.id);
  console.log(`[submit] wrote submission id=${missionId} changes=${submitResult.changes}`);
  await interaction.editReply(
    `📨 Submission received for **${mission.title}**! An admin will review it shortly.`
  );

  // Post to #mission-submissions — isolated so a permissions error never clobbers the user reply
  try {
    const ch = await fetchTextChannel(guild, "mission-submissions");
    if (ch) {
      const embed = new EmbedBuilder()
        .setColor(0x3b82f6)
        .setTitle(`📨 Submission — ${mission.title}`)
        .setDescription(proof)
        .addFields(
          { name: "Mission ID", value: `#${mission.id}`, inline: true },
          { name: "XP Reward", value: `${mission.xp_reward.toLocaleString()} XP`, inline: true },
          {
            name: "Eligible",
            value: mission.target_house ? `🏛️ ${mission.target_house}` : "🌐 All Houses",
            inline: true,
          },
          { name: "Submitted by", value: `<@${interaction.user.id}>` }
        )
        .setFooter({ text: `Use /mission complete ${mission.id} to approve` })
        .setTimestamp();
      await ch.send({ embeds: [embed] });
      console.log(`[submit] posted to #mission-submissions for mission #${missionId}`);
    } else {
      console.warn(`[submit] #mission-submissions not found in ${guild.name} — submission saved to DB but not posted`);
    }
  } catch (e) {
    console.error(`[submit] failed to post to #mission-submissions (check bot permissions):`, e);
    // Submission is already saved — don't surface this as a user-facing error
  }
}

async function handleComplete(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const adminMember = interaction.member as GuildMember;
  if (!adminMember.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.editReply("❌ Only admins can complete missions.");
    return;
  }

  const guild = interaction.guild!;
  const missionId = interaction.options.getInteger("id", true);
  const mission = stmtGetById.get(missionId, guild.id) as Mission | undefined;

  if (!mission) {
    await interaction.editReply(`❌ Mission #${missionId} not found.`);
    return;
  }

  if (mission.status !== "claimed") {
    await interaction.editReply(
      `❌ Mission #${missionId} cannot be completed — it must be in "claimed" status (currently: ${mission.status}).`
    );
    return;
  }

  if (!mission.claimed_by) {
    await interaction.editReply(`❌ Mission #${missionId} has no claimant on record.`);
    return;
  }

  // Fetch the claimant's member to apply their house multiplier
  const claimant = await fetchMember(guild, mission.claimed_by);
  const roleNames = claimant?.roles.cache.map((r) => r.name) ?? [];
  const { house, multiplier } = getHouseInfo(roleNames);
  const xpAwarded = Math.floor(mission.xp_reward * multiplier);

  // Award XP and mark complete
  addXp(mission.claimed_by, guild.id, xpAwarded);
  stmtComplete.run(interaction.user.id, missionId, guild.id);

  const multiplierNote =
    multiplier !== 1.0
      ? ` (${mission.xp_reward.toLocaleString()} × ${multiplier} ${house} bonus)`
      : "";

  await interaction.editReply(
    `✅ Mission **${mission.title}** completed.\n` +
    `<@${mission.claimed_by}> awarded **${xpAwarded.toLocaleString()} XP**${multiplierNote}.`
  );

  // Post to #mission-results — isolated so a permissions error never clobbers the admin reply
  try {
    const ch = await fetchTextChannel(guild, "mission-results");
    if (ch) {
      const embed = new EmbedBuilder()
        .setColor(0x22c55e)
        .setTitle(`🏆 Mission Complete — ${mission.title}`)
        .setDescription(
          mission.submission_text
            ? `**Submission:** ${mission.submission_text}`
            : "_No submission text on record._"
        )
        .addFields(
          { name: "Completed by", value: `<@${mission.claimed_by}>`, inline: true },
          { name: "XP Awarded", value: `${xpAwarded.toLocaleString()} XP`, inline: true },
          { name: "Approved by", value: `<@${interaction.user.id}>`, inline: true }
        )
        .setFooter({
          text: house
            ? `${house} house bonus applied (×${multiplier})`
            : "No house bonus applied",
        })
        .setTimestamp();
      await ch.send({ embeds: [embed] });
      console.log(`[complete] posted to #mission-results for mission #${missionId}`);
    } else {
      console.warn(`[complete] #mission-results not found in ${guild.name}`);
    }
  } catch (e) {
    console.error(`[complete] failed to post to #mission-results (check bot permissions):`, e);
  }

  // Edit the original #missions post to show completed status — also isolated
  try {
    const missionsCh = await fetchTextChannel(guild, "missions");
    if (missionsCh && mission.message_id) {
      const completedEmbed = new EmbedBuilder()
        .setColor(0x22c55e)
        .setTitle(`✅ ${mission.title}`)
        .setDescription(mission.description)
        .addFields(
          { name: "XP Awarded", value: `${xpAwarded.toLocaleString()} XP`, inline: true },
          {
            name: "Eligible",
            value: mission.target_house ? `🏛️ ${mission.target_house}` : "🌐 All Houses",
            inline: true,
          },
          { name: "Mission ID", value: `#${mission.id}`, inline: true },
          { name: "Status", value: `🏆 Completed by <@${mission.claimed_by}>` }
        )
        .setFooter({ text: `Approved by @${interaction.user.username}` })
        .setTimestamp();
      const msg = await missionsCh.messages.fetch(mission.message_id);
      await msg.edit({ embeds: [completedEmbed] });
    }
  } catch (e) {
    console.warn(`[complete] could not update #missions post for #${missionId}:`, e);
  }
}

// ── entry point ────────────────────────────────────────────────────────────

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: "Server only.", ephemeral: true });
    return;
  }

  try {
    const sub = interaction.options.getSubcommand();
    if (sub === "create")   return await handleCreate(interaction);
    if (sub === "list")     return await handleList(interaction);
    if (sub === "claim")    return await handleClaim(interaction);
    if (sub === "submit")   return await handleSubmit(interaction);
    if (sub === "complete") return await handleComplete(interaction);
  } catch (e) {
    console.error(`[mission] unhandled error in /${interaction.options.getSubcommand()}:`, e);
    const msg = { content: "❌ Something went wrong. Please try again.", ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply(msg.content);
    } else {
      await interaction.reply(msg);
    }
  }
                       }
    
