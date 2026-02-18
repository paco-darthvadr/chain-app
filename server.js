const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(mod => mod.default(...args));

const allowedOrigins = [
  'http://localhost:3000', // for local development
  'http://localhost:3001', // for Next.js on port 3001
  'http://ip:3000', // for your specific IP
  'http://ip:3001', // for your specific IP on port 3001
  'http://127.0.0.1:3000', // for localhost alternative
  'http://127.0.0.1:3001', // for localhost alternative on port 3001
  'https://dev.domain', // production frontend
  'https://socket.domain' // production socket
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
const userSockets = {}; // { [userId]: socketId }

io.on('connection', (socket) => {
  console.log(`A user connected: ${socket.id}`);
  console.log(`Total connections: ${Object.keys(io.sockets.sockets).length}`);

  socket.on('register-user', (userId) => {
    userSockets[userId] = socket.id;
    socket.userId = userId; // Store on the socket for easy lookup on disconnect
    console.log(`User ${userId} registered with socket ${socket.id}`);
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

  socket.on('challenge-user', ({ challengerId, challengerName, challengeeId }) => {
    console.log(`Challenge attempt: ${challengerName} (${challengerId}) challenging ${challengeeId}`);
    console.log('Available users:', Object.keys(userSockets));
    
    const challengeeSocketId = userSockets[challengeeId];
    if (challengeeSocketId) {
        console.log(`Sending challenge to ${challengeeId} at socket ${challengeeSocketId}`);
        io.to(challengeeSocketId).emit('new-challenge', {
            challengerId: challengerId,
            challengerName: challengerName
        });
    } else {
        console.log(`User ${challengeeId} not found in userSockets`);
        socket.emit('challenge-failed', { message: 'User is not online or available for challenges.' });
    }
  });

  socket.on('challenge-accepted', ({ challengerId, gameId }) => {
      const challengerSocketId = userSockets[challengerId];
      if (challengerSocketId) {
          io.to(challengerSocketId).emit('game-started', { gameId });
      }
  });

  socket.on('challenge-declined', ({ challengerId, declinerName }) => {
      const challengerSocketId = userSockets[challengerId];
      if (challengerSocketId) {
          io.to(challengerSocketId).emit('challenge-denied', { declinerName });
      }
  });

  socket.on('sendMessage', ({ roomId, message }) => {
    io.to(roomId).emit('newMessage', message);
  });

  socket.on('joinGameRoom', (gameId) => {
    socket.join(gameId);
    console.log(`User ${socket.id} joined game room ${gameId}`);
  });

  socket.on('move-made', (data) => {
    // Broadcast to the specific game room, excluding the sender
    socket.to(data.gameId).emit('update-board-state', data.boardState);
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
    }
  });

  socket.on('rematch-offer', ({ gameId, opponentId }) => {
    let sentDirect = false;
    if (opponentId && userSockets[opponentId]) {
      const opponentSocketId = userSockets[opponentId];
      io.to(opponentSocketId).emit('rematch-offered', { gameId });
      sentDirect = true;
      console.log(`Rematch offer sent directly to opponent ${opponentId} at socket ${opponentSocketId}`);
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
      const response = await fetch(`${appUrl}/api/game/${gameId}`);
      if (!response.ok) throw new Error('Failed to fetch original game data');
      
      const originalGame = await response.json();
      
      // Swap the players for the new game
      const newGameData = {
        whitePlayerId: originalGame.blackPlayerId,
        blackPlayerId: originalGame.whitePlayerId,
      };
      const bodyString = JSON.stringify(newGameData);
      console.log('Rematch newGameData:', newGameData, bodyString);

      const createResponse = await fetch(`${appUrl}/api/game`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    if (socket.userId && userSockets[socket.userId] === socket.id) {
        delete userSockets[socket.userId];
        console.log(`User ${socket.userId} unregistered.`);
    }
    console.log(`A user disconnected: ${socket.id}`);
  });

});

const PORT = 3002;
httpServer.listen(PORT, () => {
  console.log(`Socket.IO server listening on port ${PORT}`);
});
