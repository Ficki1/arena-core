import db from "./database.js";

const COOLDOWN_MS = 60_000;
const BASE_XP_MIN = 15;
const BASE_XP_MAX = 25;

export const HOUSE_MULTIPLIERS: Record<string, number> = {
  Scribes: 1.0,
  Heralds: 1.1,
  Artisans: 1.2,
  Echoes: 0.8,
  Seers: 1.3,
  "Forge Masters": 1.5,
};

const HOUSE_NAMES = Object.keys(HOUSE_MULTIPLIERS);

export function getHouseInfo(roleNames: string[]): {
  house: string | null;
  multiplier: number;
} {
  for (const house of HOUSE_NAMES) {
    if (roleNames.includes(house)) {
      return { house, multiplier: HOUSE_MULTIPLIERS[house] };
    }
  }
  return { house: null, multiplier: 1.0 };
}

interface XpRow {
  xp: number;
  last_earned_at: number;
}

interface RankRow {
  rank: number;
}

interface LeaderboardRow {
  user_id: string;
  xp: number;
}

const stmtGet = db.prepare<[string, string]>(
  "SELECT xp, last_earned_at FROM user_xp WHERE user_id = ? AND guild_id = ?"
);

const stmtUpsert = db.prepare<[string, string, number, number]>(`
  INSERT INTO user_xp (user_id, guild_id, xp, last_earned_at)
  VALUES (?, ?, ?, ?)
  ON CONFLICT (user_id, guild_id) DO UPDATE SET
    xp             = xp + excluded.xp,
    last_earned_at = excluded.last_earned_at
`);

const stmtXp = db.prepare<[string, string]>(
  "SELECT xp FROM user_xp WHERE user_id = ? AND guild_id = ?"
);

const stmtRank = db.prepare<[string, number]>(
  "SELECT COUNT(*) AS rank FROM user_xp WHERE guild_id = ? AND xp > ?"
);

const stmtLeaderboard = db.prepare<[string, number]>(
  "SELECT user_id, xp FROM user_xp WHERE guild_id = ? ORDER BY xp DESC LIMIT ?"
);

export function tryEarnXp(
  userId: string,
  guildId: string,
  roleNames: string[]
): number | null {
  const now = Date.now();
  const row = stmtGet.get(userId, guildId) as XpRow | undefined;

  if (row && now - row.last_earned_at < COOLDOWN_MS) {
    return null;
  }

  const base =
    Math.floor(Math.random() * (BASE_XP_MAX - BASE_XP_MIN + 1)) + BASE_XP_MIN;
  const { multiplier } = getHouseInfo(roleNames);
  const earned = Math.floor(base * multiplier);

  stmtUpsert.run(userId, guildId, earned, now);
  return earned;
}

export function getUserXp(
  userId: string,
  guildId: string
): { xp: number; rank: number } {
  const row = stmtXp.get(userId, guildId) as XpRow | undefined;
  const xp = row?.xp ?? 0;
  const rankRow = stmtRank.get(guildId, xp) as RankRow;
  return { xp, rank: rankRow.rank + 1 };
}

export function getLeaderboard(
  guildId: string,
  limit = 10
): LeaderboardRow[] {
  return stmtLeaderboard.all(guildId, limit) as LeaderboardRow[];
}

const stmtAddXp = db.prepare<[string, string, number]>(`
  INSERT INTO user_xp (user_id, guild_id, xp, last_earned_at)
  VALUES (?, ?, ?, 0)
  ON CONFLICT (user_id, guild_id) DO UPDATE SET
    xp = xp + excluded.xp
`);

export function addXp(userId: string, guildId: string, amount: number): void {
  stmtAddXp.run(userId, guildId, amount);
              }
  
