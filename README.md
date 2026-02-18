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
---

## Installation

1. **Clone the repository:**
   ```sh
   git clone https://github.com/paco-darthvadr/chain-app.git
   cd chain-app
   ```

2. **Install dependencies:**
   ```sh
   yarn install
   ```

3. **Configure environment variables:**
   - Copy `.env.example` to `.env` and fill in the required values (database URL, etc).

   - Change the CORS URL's in the server.js to your own

4. **Set up the database:**
   - Create your database :
     ```
    - For testing 
    - If only using a file DB run:
     ```sh
     npx prisma db push 
    - then
     ```sh
     npx prisma generate 
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
   yarn run dev
   # or
   npm run dev
   ```

---

## Database Setup

- The app uses Prisma ORM. The schema is defined in `prisma/schema.prisma`.
- Migrations are in `prisma/migrations/`.

- It is enough to only run npx prisma db push and npx prisma generate to create the db file and get started:
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

- `yarn dev` — Start the Next.js development server
- `yarn build` / `npm run build` — Build the app for production
- `yarn start` / `npm start` — Start the production server
- `npx prisma migrate dev` — Run migrations in development
- `npx prisma studio` — Open Prisma Studio
- `yarn seed` — Seed the database

---

## TODO
- [ ] Add new games ( Add other game classed, Like how iv done for the chessgame class )
- [ ] Add more blockchain transaction details to game history
- [ ] Improve error handling and user feedback
- [ ] Add unit and integration tests
- [ ] Enhance mobile responsiveness
- [ ] Refactor and document API endpoints
- [ ] Add more user profile customization
- [ ] Optimize performance for large user/game lists
- [ ] The Users page needs work, plan is to list online/offline users, for the game challenge, also to have past games ether 
- [ ] listed or a linked, and achievements 
- [ ] move away from using Prisma or any DB and rely on Verus as the DB

## Other TODO's 
- [ ] tournaments
- [ ] Ranking
- [ ] Thoughts ? Tier and suscription based tournaments ( Mainnet baased model to pay costs for storage )  

---

## License

