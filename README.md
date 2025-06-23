# Chain App - Verus Blockchain Chess Platform

A sophisticated chess application that integrates with the Verus blockchain for decentralized identity management and real-time multiplayer gameplay.

## 🎯 Overview

Chain App is a full-stack chess platform that combines traditional chess gameplay with modern blockchain technology. Users authenticate through their Verus blockchain identities (i-addresses) instead of traditional usernames and passwords, creating a truly decentralized gaming experience.

## ✨ Features

### 🏆 Core Chess Features
- **Full Chess Implementation**: Complete chess rules including castling, en passant, pawn promotion
- **Real-time Multiplayer**: Live chess games with instant move synchronization
- **Game State Management**: Persistent game states with move history
- **Move Validation**: Server-side move validation and rule enforcement
- **Game Analytics**: Track wins, losses, and game statistics

### 🔐 Verus Blockchain Integration
- **Verus ID Authentication**: Login using Verus i-addresses
- **QR Code Login**: Mobile wallet integration with QR code scanning
- **Decentralized Identity**: No traditional usernames/passwords required
- **Secure Verification**: Blockchain-based identity verification

### 💬 Real-time Communication
- **Live Chat System**: Multiple chat rooms (General, Strategy, Off-Topic)
- **User Presence**: Real-time user online/offline status
- **Player Challenges**: Challenge other users to chess games
- **Game Notifications**: Real-time game updates and notifications

### 🎮 Gaming Features
- **Player Challenges**: Challenge any online user to a game
- **Game Rooms**: Join specific game rooms for organized play
- **Rematch System**: Offer and accept rematches after games
- **Game History**: View past games and results
- **User Profiles**: Display names, avatars, and game statistics

## 🏗️ Architecture

### Frontend
- **Next.js 14** with App Router
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Radix UI** components
- **Socket.IO Client** for real-time features

### Backend
- **Next.js API Routes** for REST endpoints
- **Prisma ORM** with SQLite database
- **Socket.IO Server** (separate Node.js server)
- **Verus Blockchain Integration**

### Database Schema
```sql
User {
  id: String (CUID)
  verusId: String (unique)
  displayName: String?
  avatarUrl: String?
  createdAt: DateTime
  updatedAt: DateTime
}

Game {
  id: String (CUID)
  whitePlayerId: String (ref: User.id)
  blackPlayerId: String (ref: User.id)
  boardState: JSON
  status: String (IN_PROGRESS, COMPLETED, ABORTED)
  winner: String?
  createdAt: DateTime
  updatedAt: DateTime
}

Move {
  id: String (CUID)
  gameId: String (ref: Game.id)
  move: String (e.g., "e2e4")
  createdAt: DateTime
}
```

## 🚀 Getting Started

### Prerequisites

- **Node.js 18+** and **Yarn** or **npm**
- **Verus Desktop Wallet** or **Verus Mobile Wallet**
- **Verus i-address** (identity address)
- **Git**

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repository-url>
   cd chain-app
   ```

2. **Install dependencies**
   ```bash
   yarn install
   # or
   npm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file in the root directory:
   ```env
   # Database
   DATABASE_URL="file:./prisma/dev.db"
   
   # App URLs (update with your IP address)
   NEXT_PUBLIC_APP_URL=http://192.168.0.162:3000
   NEXT_PUBLIC_SOCKET_URL=http://192.168.0.162:3001
   
   # Verus Blockchain Configuration
   TESTNET=true
   TESTNET_VERUS_RPC_NETWORK=http://localhost:27486
   MAINNET_VERUS_RPC_NETWORK=http://localhost:27486
   TESTNET_VALU_LOGIN_IADDRESS=your_testnet_login_iaddress
   MAINNET_VALU_LOGIN_IADDRESS=your_mainnet_login_iaddress
   TESTNET_VALU_LOGIN_WIF=your_testnet_wif_key
   MAINNET_VALU_LOGIN_WIF=your_mainnet_wif_key
   TESTNET_LOGIN_URL=http://192.168.0.162:3000
   MAINNET_LOGIN_URL=http://192.168.0.162:3000
   
   # TinyURL API (for QR code shortening)
   TINYURLTOKEN=your_tinyurl_api_token
   ```

4. **Set up the database**
   ```bash
   # Generate Prisma client
   npx prisma generate
   
   # Run database migrations
   npx prisma migrate dev
   
   # (Optional) Seed the database
   npx prisma db seed
   ```

5. **Start the development servers**
   ```bash
   yarn dev
   ```
   This starts both:
   - Next.js server on `http://192.168.0.162:3000`
   - Socket.IO server on `http://192.168.0.162:3001`

### Verus Blockchain Setup

1. **Install Verus Desktop Wallet**
   - Download from [Verus.io](https://verus.io/wallet)
   - Create a new wallet or import existing one

2. **Get your i-address**
   - Open Verus Desktop Wallet
   - Go to "Identities" tab
   - Copy your i-address (starts with "i")

3. **Configure Verus RPC**
   - Ensure Verus daemon is running
   - Default RPC port: 27486
   - Update environment variables with your RPC settings

## 🎮 How to Use

### 1. User Registration & Login

1. **Navigate to Login Page**
   - Go to `http://192.168.0.162:3000/login`

2. **Enter Your i-address**
   - Input your Verus i-address (e.g., `iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq`)

3. **Scan QR Code**
   - Use your Verus mobile wallet to scan the generated QR code
   - Or click the provided link

4. **Complete Authentication**
   - Approve the login request in your wallet
   - You'll be redirected to the dashboard

### 2. Creating a Test User (Development)

1. **Access Dev Tools**
   - Go to `http://192.168.0.162:3000/dev/create-user`

2. **Create Test User**
   - Enter a test username (e.g., "testuser1")
   - Click "Create User"

3. **Select User**
   - Go to Users page
   - Select your created user to start using the app

### 3. Playing Chess

1. **Challenge a Player**
   - Go to Users page
   - Click "Challenge" next to any online user
   - Wait for them to accept

2. **Join a Game**
   - Accept incoming challenges
   - Or join existing games from the Games page

3. **Make Moves**
   - Click and drag pieces to make moves
   - Valid moves are highlighted
   - Pawn promotion dialog appears automatically

4. **Game Features**
   - View move history
   - See captured pieces
   - Offer rematches after game ends

### 4. Chat System

1. **Join Chat Rooms**
   - Navigate to Chat page
   - Select a room (General, Strategy, Off-Topic)

2. **Send Messages**
   - Type messages in the chat input
   - Press Enter to send

3. **User Presence**
   - See who's online in each room
   - View user join/leave notifications

## 🔧 Development

### Project Structure
```
chain-app/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── chat/              # Chat functionality
│   ├── game/              # Chess game logic
│   ├── games/             # Game management
│   ├── login/             # Verus authentication
│   ├── models/            # Chess piece models
│   ├── referee/           # Chess rules engine
│   ├── users/             # User management
│   └── utils/             # Utility functions
├── components/            # React components
│   ├── chat/              # Chat components
│   ├── chessboard/        # Chess UI components
│   ├── dashboard/         # Dashboard components
│   └── ui/                # UI components
├── prisma/                # Database schema and migrations
├── server.js              # Socket.IO server
└── public/                # Static assets
```

### Key Technologies

#### Verus Integration
- **verusid-ts-client**: Verus ID operations
- **verus-typescript-primitives**: Blockchain primitives
- **verusd-rpc-ts-client**: RPC communication
- **@bitgo/utxo-lib**: UTXO operations

#### Real-time Features
- **Socket.IO**: Real-time communication
- **WebSocket**: Live game updates
- **Event-driven architecture**: Game state synchronization

#### Chess Engine
- **Custom TypeScript implementation**: Full chess rules
- **Move validation**: Server-side rule enforcement
- **State management**: Persistent game states

### Development Commands

```bash
# Start development servers
yarn dev

# Build for production
yarn build

# Start production server
yarn start

# Run database migrations
npx prisma migrate dev

# Open Prisma Studio
npx prisma studio

# Generate Prisma client
npx prisma generate

# Seed database
npx prisma db seed
```

## 🔒 Security Considerations

### Environment Variables
- Never commit `.env` files to version control
- Use `.env.local` for local development
- Set up proper environment variables in production

### Verus Integration
- Keep WIF keys secure and never expose them
- Use testnet for development
- Implement proper error handling for blockchain operations

### Database Security
- SQLite database is excluded from version control
- Implement proper input validation
- Use parameterized queries with Prisma

## 🚀 Deployment

### Production Setup

1. **Environment Configuration**
   ```env
   NODE_ENV=production
   DATABASE_URL="your_production_database_url"
   NEXT_PUBLIC_APP_URL="https://your-domain.com"
   NEXT_PUBLIC_SOCKET_URL="https://your-domain.com:3001"
   ```

2. **Build and Deploy**
   ```bash
   yarn build
   yarn start
   ```

3. **Socket.IO Server**
   - Deploy `server.js` separately
   - Configure reverse proxy for WebSocket support
   - Set up SSL certificates for secure connections

### Recommended Hosting
- **Vercel**: Next.js hosting
- **Railway**: Socket.IO server hosting
- **PlanetScale**: Database hosting
- **Cloudflare**: CDN and SSL

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

### Common Issues

1. **CORS Errors**
   - Ensure Socket.IO server is running
   - Check CORS configuration in `server.js`
   - Verify IP addresses in environment variables

2. **Verus Authentication Fails**
   - Check Verus daemon is running
   - Verify i-address format
   - Ensure RPC network configuration is correct

3. **Database Issues**
   - Run `npx prisma migrate dev`
   - Check database file permissions
   - Verify DATABASE_URL in environment

4. **Socket Connection Issues**
   - Check both servers are running
   - Verify port configurations
   - Check firewall settings

### Getting Help
- Check the [Issues](https://github.com/your-repo/issues) page
- Create a new issue with detailed error information
- Include environment details and error logs

## 🔗 Links

- [Verus Documentation](https://docs.verus.io/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Socket.IO Documentation](https://socket.io/docs/)
- [Prisma Documentation](https://www.prisma.io/docs/)

---

**Built with ❤️ using Verus blockchain technology**
