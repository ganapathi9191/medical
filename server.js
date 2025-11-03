import express from 'express';
import http from 'http';
import cors from 'cors';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import connectDatabase from './db/connectDatabase.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fileUpload from 'express-fileupload';
import { Server } from 'socket.io';

import UserRoutes from './Routes/userRoutes.js';
import ServiceRoutes from './Routes/ServiceRoutes.js';
import CategoryRoutes from './Routes/categoryRoutes.js';
import pharmacyRoutes from './Routes/pharmacyRoutes.js';
import adminRoutes from './Routes/adminRoutes.js';
import vendorRoutes from './Routes/vendorRoutes.js';
import riderRoutes from './Routes/riderRoutes.js';
import Chat from './Models/Chat.js';

dotenv.config();

const app = express();

// __dirname workaround
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// CORS
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://31.97.206.144:8021', "http://31.97.206.144:8033", "https://medical-delete-url.vercel.app"],
  credentials: true
}));

app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// File upload
app.use(fileUpload({ useTempFiles: true, tempFileDir: '/tmp/' }));

// DB connect
connectDatabase();

// Create server & socket
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // change as needed
    methods: ["GET", "POST"]
  }
});

// Attach io to app
app.set("io", io);

// ✅ Routes
app.use('/api/users', UserRoutes);
app.use('/api/service', ServiceRoutes);
app.use('/api/category', CategoryRoutes);
app.use('/api/pharmacy', pharmacyRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/vendor', vendorRoutes);
app.use('/api/rider', riderRoutes);

io.on('connection', (socket) => {
  console.log(`🟢 Socket connected: ${socket.id}`);

  socket.on('joinRoom', ({ userId, riderId }) => {
    const roomId = `${userId}_${riderId}`;
    socket.join(roomId);
    console.log(`✅ Socket ${socket.id} joined room: ${roomId}`);
  });

  socket.on('leaveRoom', ({ userId, riderId }) => {
    const roomId = `${userId}_${riderId}`;
    socket.leave(roomId);
    console.log(`❌ Socket ${socket.id} left room: ${roomId}`);
  });

  socket.on('sendMessage', async ({ userId, riderId, message, senderType }) => {
    try {
      console.log('📩 sendMessage event received:', { userId, riderId, message, senderType });

      const newMessage = new Chat({
        riderId,
        userId,
        message,
        senderType,
        timestamp: new Date(),
      });

      const savedMessage = await newMessage.save();
      console.log('💾 Message saved in DB:', savedMessage);

      const roomId = `${userId}_${riderId}`;
      io.to(roomId).emit('receiveMessage', savedMessage);
      console.log(`📤 Message emitted to room: ${roomId}`);
    } catch (error) {
      console.error('❗ Error in sendMessage:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔴 Socket disconnected: ${socket.id}`);
  });
});


// Start server
const PORT = process.env.PORT || 7021;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
