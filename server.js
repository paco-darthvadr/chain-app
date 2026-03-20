const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(mod => mod.default(...args));

const allowedOrigins = [
  'http://localhost:3000', // for local development
  'http://localhost:3001', // for Next.js on port 3001
  'http://192.168.0.162:3000', // for your specific IP
  'http://192.168.0.162:3001', // for your specific IP on port 3001
  'http://127.0.0.1:3000', // for localhost alternative
  'http://127.0.0.1:3001', // for localhost alternative on port 3001
  'https://dev.verus-timelock.xyz', // production frontend
  'https://socket.verus-timelock.xyz', // production socket
  'https://chess.autobb.app', // cloudflare tunnel
  'https://socket.autobb.app' // cloudflare tunnel socket
];
if (process.env.CLIENT_URL) {
  allowedOrigins.push(process.env.CLIENT_URL);
}

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      // allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) === -1) {
        const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    methods: ["GET", "POST"],
    credentials: true
  }
});

const rooms = {}; // { [roomId]: string[] }
const userSockets = {}; // { [userId]: Set<socketId> } — supports multiple sockets per user
const userGameStatus = {}; // { [userId]: 'available' | 'in-game' }
const pendingChallenges = []; // { challengerId, challengerName, challengeeId, mode, boardTheme, logoMode, gameType, timestamp }

function getUserStatus(userId) {
  if (!userSockets[userId] || userSockets[userId].size === 0) return 'offline';
  return userGameStatus[userId] || 'available';
}

function notifyStatusChange(userId) {
  const status = getUserStatus(userId);
  pendingChallenges.forEach(c => {
    const notifyId = c.challengerId === userId ? c.challengeeId : c.challengerId;
    if (notifyId === userId) return;
    const notifySockets = userSockets[notifyId];
    if (notifySockets) {
      for (const sid of notifySockets) {
        io.to(sid).emit('user-status-changed', { userId, status });
      }
    }
  });
}

io.on('connection', (socket) => {
  console.log(`A user connected: ${socket.id}`);
  console.log(`Total connections: ${Object.keys(io.sockets.sockets).length}`);

  socket.on('register-user', (userId) => {
    if (!userSockets[userId]) userSockets[userId] = new Set();
    userSockets[userId].add(socket.id);
    socket.userId = userId;
    console.log(`User ${userId} registered with socket ${socket.id} (${userSockets[userId].size} connections)`);
    console.log('Current registered users:', Object.keys(userSockets));
  });

  socket.on('joinRoom', ({ roomId, userId }) => {
    socket.join(roomId);
    socket.userId = userId;
    socket.roomId = roomId;

    if (!rooms[roomId]) {
      rooms[roomId] = [];
    }

    // Add user to room if not already present
    if (!rooms[roomId].includes(userId)) {
      rooms[roomId].push(userId);
    }
    
    console.log(`${userId} joined room ${roomId}. Users: ${rooms[roomId].join(', ')}`);

    // Notify everyone in the room (including sender) that a user has joined
    io.to(roomId).emit('userJoined', { userId });
    
    // Send the full user list to everyone in the room
    io.to(roomId).emit('updateUserList', { users: rooms[roomId] });
  });

  socket.on('challenge-user', ({ challengerId, challengerName, challengeeId, mode, boardTheme, logoMode, gameType }) => {
    console.log(`Challenge attempt: ${challengerName} (${challengerId}) challenging ${challengeeId}`);
    console.log('Available users:', Object.keys(userSockets));

    pendingChallenges.push({
      challengerId, challengerName, challengeeId, mode,
      boardTheme: boardTheme || 'classic', logoMode: logoMode || 'off',
      gameType: gameType || 'chess',
      timestamp: Date.now()
    });

    const challengeeSockets = userSockets[challengeeId];
    if (challengeeSockets && challengeeSockets.size > 0) {
        console.log(`Sending challenge to ${challengeeId} on ${challengeeSockets.size} socket(s)`);
        for (const sid of challengeeSockets) {
            io.to(sid).emit('new-challenge', {
                challengerId: challengerId,
                challengerName: challengerName,
                mode: mode,
                boardTheme: boardTheme || 'classic',
                logoMode: logoMode || 'off',
                gameType: gameType || 'chess',
                challengerStatus: getUserStatus(challengerId)
            });
        }
    } else {
        console.log(`User ${challengeeId} not found in userSockets`);
        socket.emit('challenge-failed', { message: 'User is not online or available for challenges.' });
    }
  });

  socket.on('challenge-declined', ({ challengerId, declinerName }) => {
      const idx = pendingChallenges.findIndex(c => c.challengerId === challengerId && c.challengeeId === socket.userId);
      if (idx !== -1) pendingChallenges.splice(idx, 1);

      const challengerSockets = userSockets[challengerId];
      if (challengerSockets) {
          for (const sid of challengerSockets) {
              io.to(sid).emit('challenge-denied', { challengerId, declinerName });
          }
      }
  });

  socket.on('challenge-cancel', ({ challengerId, challengeeId }) => {
    const idx = pendingChallenges.findIndex(c => c.challengerId === challengerId && c.challengeeId === challengeeId);
    if (idx !== -1) pendingChallenges.splice(idx, 1);
    const targetSockets = userSockets[challengeeId];
    if (targetSockets) {
      for (const sid of targetSockets) {
        io.to(sid).emit('challenge-cancelled', { challengerId });
      }
    }
    console.log(`Challenge from ${challengerId} to ${challengeeId} cancelled`);
  });

  socket.on('challenge-accepted-busy', ({ challengerId, acceptorId, acceptorName, mode, boardTheme, logoMode, gameType }) => {
    const challengerSockets = userSockets[challengerId];
    if (challengerSockets) {
      for (const sid of challengerSockets) {
        io.to(sid).emit('ready-to-play', {
          acceptorId, acceptorName, mode,
          boardTheme: boardTheme || 'classic',
          logoMode: logoMode || 'off',
          gameType: gameType || 'chess',
          acceptorStatus: getUserStatus(acceptorId)
        });
      }
    }
    console.log(`${acceptorName} accepted busy challenge from ${challengerId}`);
  });

  socket.on('start-game', async ({ challengerId, challengeeId, mode, boardTheme, logoMode, gameType }) => {
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const internalHeaders = { 'Content-Type': 'application/json' };
      if (process.env.INTERNAL_API_SECRET) internalHeaders['x-internal-api-secret'] = process.env.INTERNAL_API_SECRET;

      const [white, black] = Math.random() < 0.5
        ? [challengerId, challengeeId]
        : [challengeeId, challengerId];

      const createResponse = await fetch(`${appUrl}/api/game`, {
        method: 'POST',
        headers: internalHeaders,
        body: JSON.stringify({
          player1Id: white, player2Id: black,
          mode: mode || 'normal',
          boardTheme: boardTheme || 'classic',
          logoMode: logoMode || 'off',
          gameType: gameType || 'chess',
        }),
      });

      if (!createResponse.ok) throw new Error('Failed to create game');
      const newGame = await createResponse.json();

      const idx = pendingChallenges.findIndex(c =>
        (c.challengerId === challengerId && c.challengeeId === challengeeId) ||
        (c.challengerId === challengeeId && c.challengeeId === challengerId)
      );
      if (idx !== -1) pendingChallenges.splice(idx, 1);

      [challengerId, challengeeId].forEach(userId => {
        const sockets = userSockets[userId];
        if (sockets) {
          for (const sid of sockets) {
            io.to(sid).emit('game-started', { gameId: newGame.id, gameType: gameType || 'chess' });
          }
        }
      });

      console.log(`Game ${newGame.id} created from start-game (${challengerId} vs ${challengeeId})`);
    } catch (error) {
      console.error('Error creating game from start-game:', error);
      socket.emit('challenge-failed', { message: 'Could not create the game. Please try again.' });
    }
  });

  socket.on('sendMessage', ({ roomId, message }) => {
    io.to(roomId).emit('newMessage', message);
  });

  socket.on('joinGameRoom', (gameId) => {
    socket.join(gameId);
    if (socket.userId) {
      userGameStatus[socket.userId] = 'in-game';
      notifyStatusChange(socket.userId);
    }
    console.log(`User ${socket.id} joined game room ${gameId}`);
  });

  socket.on('move-made', (data) => {
    // Broadcast board state to the specific game room, excluding the sender
    // IMPORTANT: emit boardState directly (not wrapped in an object) to stay
    // backward-compatible with the frontend listener in GameClient.tsx which
    // passes the received payload directly to createBoardFromState().
    socket.to(data.gameId).emit('update-board-state', data.boardState);

    // Emit signed package separately if available (Normal mode)
    if (data.signedPackage) {
        socket.to(data.gameId).emit('move-signed', data.signedPackage);
    }

    // Emit chain txid if available (Showcase mode)
    if (data.chainTxid) {
        socket.to(data.gameId).emit('move-on-chain', { txid: data.chainTxid, moveNum: data.signedPackage?.moveNum });
    }

    console.log(`Move made in game ${data.gameId}, broadcasting to room.`);
  });

  socket.on('new-game-created', () => {
    // Notify all clients to refresh their game lists
    io.emit('refresh-game-list');
    console.log('New game created, broadcasting refresh to all clients.');
  });

  socket.on('leave-game', ({ gameId }) => {
    if (socket.userId) {
        console.log(`User ${socket.userId} left game ${gameId}`);
        // Notify the other player in the room
        socket.to(gameId).emit('opponent-left', { leaverId: socket.userId });
        userGameStatus[socket.userId] = 'available';
        notifyStatusChange(socket.userId);
    }
  });

  socket.on('player-resigned', ({ gameId, resignerId }) => {
    console.log(`Player ${resignerId} resigned from game ${gameId}`);
    // Notify the opponent in the game room
    socket.to(gameId).emit('opponent-resigned');
  });

  socket.on('rematch-offer', ({ gameId, opponentId }) => {
    let sentDirect = false;
    if (opponentId && userSockets[opponentId] && userSockets[opponentId].size > 0) {
      for (const sid of userSockets[opponentId]) {
        io.to(sid).emit('rematch-offered', { gameId });
      }
      sentDirect = true;
      console.log(`Rematch offer sent to opponent ${opponentId} on ${userSockets[opponentId].size} socket(s)`);
    }
    // Always emit to the room as a backup (excluding sender)
    socket.to(gameId).emit('rematch-offered', { gameId });
    if (!sentDirect) {
      console.log(`Rematch offer sent to room ${gameId}`);
    } else {
      console.log(`Rematch offer also sent to room ${gameId} as backup`);
    }
  });

  socket.on('rematch-accept', async ({ gameId }) => {
    // To create a new game, we need the original player IDs.
    // This requires an API call to our own app to get the game details.
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL;
      const internalHeaders = { 'Content-Type': 'application/json' };
      if (process.env.INTERNAL_API_SECRET) internalHeaders['x-internal-api-secret'] = process.env.INTERNAL_API_SECRET;

      const response = await fetch(`${appUrl}/api/game/${gameId}`, { headers: internalHeaders });
      if (!response.ok) throw new Error('Failed to fetch original game data');

      const originalGame = await response.json();

      // Randomize colors for the rematch, carry over mode
      const [white, black] = Math.random() < 0.5
        ? [originalGame.player1Id, originalGame.player2Id]
        : [originalGame.player2Id, originalGame.player1Id];
      const newGameData = {
        player1Id: white,
        player2Id: black,
        mode: originalGame.mode || 'normal',
        boardTheme: originalGame.boardTheme || 'classic',
        logoMode: originalGame.logoMode || 'off',
        gameType: originalGame.gameType || 'chess',
      };
      const bodyString = JSON.stringify(newGameData);
      console.log('Rematch newGameData:', newGameData, bodyString);

      const createResponse = await fetch(`${appUrl}/api/game`, {
        method: 'POST',
        headers: internalHeaders,
        body: bodyString,
      });

      if (!createResponse.ok) throw new Error('Failed to create new game');
      
      const newGame = await createResponse.json();

      // Notify both players in the original game room about the new game
      io.to(gameId).emit('rematch-confirmed', { newGameId: newGame.id });

    } catch (error) {
      console.error('Error handling rematch acceptance:', error);
      // Optionally, notify clients of the failure
      io.to(gameId).emit('rematch-failed', { message: 'Could not create a new game.' });
    }
  });

  socket.on('new-user-created', () => {
    // Notify all clients to refresh their user lists
    io.emit('refresh-user-list');
    console.log('New user created, broadcasting refresh to all clients.');
  });

  socket.on('disconnect', () => {
    const { userId, roomId } = socket;
    if (userId && roomId && rooms[roomId]) {
      // Remove user from room
      rooms[roomId] = rooms[roomId].filter(user => user !== userId);
      
      console.log(`${userId} left room ${roomId}. Users: ${rooms[roomId].join(', ')}`);

      // Notify everyone in the room that a user has left
      io.to(roomId).emit('userLeft', { userId });
      
      // Send the updated user list to everyone remaining in the room
      io.to(roomId).emit('updateUserList', { users: rooms[roomId] });
    }
    // Add disconnect logic for user registration
    if (socket.userId && userSockets[socket.userId]) {
        userSockets[socket.userId].delete(socket.id);
        if (userSockets[socket.userId].size === 0) {
            delete userSockets[socket.userId];
        }
        console.log(`Socket ${socket.id} removed for user ${socket.userId}`);
    }
    if (socket.userId) {
      notifyStatusChange(socket.userId);
      if (userSockets[socket.userId] === undefined) {
        delete userGameStatus[socket.userId];
      }
    }
    console.log(`A user disconnected: ${socket.id}`);
  });

});

const PORT = 3002;
httpServer.listen(PORT, () => {
  console.log(`Socket.IO server listening on port ${PORT}`);

  // Trigger SubID pool replenishment on startup
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.INTERNAL_API_SECRET) headers['x-api-secret'] = process.env.INTERNAL_API_SECRET;
  fetch(`${appUrl}/api/pool`, { method: 'POST', headers })
    .then(res => res.json())
    .then(data => console.log('[SubID Pool] Startup replenishment:', data))
    .catch(err => console.log('[SubID Pool] Startup replenishment skipped (app may not be ready):', err.message));
});