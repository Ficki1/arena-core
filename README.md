🛡️ ARENA CORE

The community bot powering the Arena Discord experience.

ARENA CORE is a custom Discord bot built to support the Arena community through engagement, XP progression, house membership, leaderboards, and mission submissions.

The idea is simple: give community members more ways to participate, track their progress, represent their houses, and engage with the wider Arena community.

✨ Features

🤖 Basic Commands

Command| Description
"/ping"| Check whether the bot is responding.
"/help"| View the available bot commands.
"/serverinfo"| Display information about the Discord server.
"/userinfo"| View information about a server member.

🏠 House System

The house system allows members to claim a house and participate in Arena's house-based community experience.

- "/house" — Interact with the house system.

⭐ XP & Progression

ARENA CORE includes an experience points (XP) system designed to recognise community participation and support progression.

Current functionality includes:

- Earning XP through eligible messages.
- XP cooldowns to regulate how frequently members earn experience.
- House multipliers that influence XP earnings.
- Personal XP and rank tracking.
- Manual XP awards by authorised administrators.

🏆 Leaderboard

The leaderboard gives members a way to compare their progress and see who is leading the community.

- "/leaderboard" — View members ranked by XP.

🎯 Missions

ARENA CORE includes mission-related functionality for community participation and proof submissions.

The available mission features depend on the commands and configuration implemented in the project.

🧰 Technology Stack

ARENA CORE is built with the following technologies:

- TypeScript — Application development.
- Node.js — JavaScript runtime.
- discord.js — Discord API integration.
- SQLite — Local database storage.
- better-sqlite3 — SQLite database integration.
- tsx — Running TypeScript directly.

📁 Project Structure

arena-core/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── database.ts
    ├── xp-manager.ts
    ├── deploy-commands.ts
    └── commands/
        ├── ping.ts
        ├── help.ts
        ├── serverinfo.ts
        ├── userinfo.ts
        ├── house.ts
        ├── xp.ts
        ├── leaderboard.ts
        └── mission.ts

🚀 Project Status

ARENA CORE is a community bot project for the Arena ecosystem. Its features and functionality may evolve as development continues.

🔒 Security

Never commit Discord bot tokens, API keys, passwords, or other sensitive credentials to the repository.

Use environment variables or an appropriate secrets-management solution to configure private credentials.

📌 About

ARENA CORE is being developed to make community participation within Arena more engaging, measurable, and competitive.

The project brings together community interaction, progression, house identity, and mission-related functionality in one Discord bot.
