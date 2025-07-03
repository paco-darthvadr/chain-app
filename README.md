# Chain App

## Overview

Chain App is a full-stack chess application with blockchain integration. It allows users to register, challenge each other, play chess games, and store game results on-chain. The app features real-time updates, user authentication, a dashboard, leaderboards, and customizable themes.

## Features
- User registration and authentication (VerusID)
- Real-time chess games with challenge system
- Game results can be stored on the blockchain
- Dashboard with user and game statistics
- Leaderboard tracking wins
- Theme switcher with multiple color themes
- Responsive UI with modern design

---

## Prerequisites
- **Node.js** (v18 or higher recommended)
- **Yarn** 
- **SQLite** (default, as configured in Prisma)
- **PostgreSQL** or another database supported by Prisma (optional, if you want to switch from SQLite)

---

## Installation

1. **Clone the repository:**
   ```sh
   git clone <repo-url>
   cd chain-app
   ```

2. **Install dependencies:**
   ```sh
   yarn install
   ```

3. **Configure environment variables:**
   - Copy `.env.example` to `.env` and fill in the required values (database URL, etc).

4. **Set up the database:**
   - Create your database (e.g., in PostgreSQL):
     ```sh
     createdb chainappdb
     ```
   - Run Prisma migrations:
     ```sh
     npx prisma migrate deploy
     # or for development
     npx prisma migrate dev
     ```
   - (Optional) Seed the database:
     ```sh
     yarn seed
     # or
     npx ts-node prisma/seed.ts
     ```

5. **Start the development server:**
   ```sh
   yarn dev
   # or
   npm run dev
   ```

6. **Access the app:**
   - Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Database Setup

- The app uses Prisma ORM. The schema is defined in `prisma/schema.prisma`.
- Migrations are in `prisma/migrations/`.
- To apply migrations:
  ```sh
  npx prisma migrate deploy
  # or
  npx prisma migrate dev
  ```
- To open Prisma Studio (GUI for DB):
  ```sh
  npx prisma studio
  ```
- To seed the database:
  ```sh
  yarn seed
  # or
  npx ts-node prisma/seed.ts
  ```

---

## Useful Commands

- `yarn dev` / `npm run dev` — Start the Next.js development server
- `yarn build` / `npm run build` — Build the app for production
- `yarn start` / `npm start` — Start the production server
- `npx prisma migrate dev` — Run migrations in development
- `npx prisma studio` — Open Prisma Studio
- `yarn seed` — Seed the database

---

## TODO
- [ ] Add new games
- [ ] Add more blockchain transaction details to game history
- [ ] Improve error handling and user feedback
- [ ] Add unit and integration tests
- [ ] Enhance mobile responsiveness
- [ ] Refactor and document API endpoints
- [ ] Add user profile customization
- [ ] Optimize performance for large user/game lists

---

## License
MIT
