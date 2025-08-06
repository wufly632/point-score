import { Server } from 'socket.io';

interface RoomUser {
  id: string;
  name: string;
  score: number;
}

interface ScoreUpdateData {
  roomId: string;
  fromUser: RoomUser;
  toUser: RoomUser;
  amount: number;
  description: string;
}

export const setupSocket = (io: Server) => {
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    // 加入房间
    socket.on('join-room', (roomId: string) => {
      socket.join(roomId);
      console.log(`Client ${socket.id} joined room ${roomId}`);
    });

    // 离开房间
    socket.on('leave-room', (roomId: string) => {
      socket.leave(roomId);
      console.log(`Client ${socket.id} left room ${roomId}`);
    });

    // 积分更新
    socket.on('score-update', (data: ScoreUpdateData) => {
      // 向房间内所有用户广播积分更新
      io.to(data.roomId).emit('score-updated', {
        fromUser: data.fromUser,
        toUser: data.toUser,
        amount: data.amount,
        description: data.description,
        timestamp: new Date().toISOString(),
      });
    });

    // 用户加入房间通知
    socket.on('user-joined', (data: { roomId: string; user: RoomUser }) => {
      socket.to(data.roomId).emit('user-joined-room', {
        user: data.user,
        timestamp: new Date().toISOString(),
      });
    });

    // Handle messages (保留原有的消息功能)
    socket.on('message', (msg: { text: string; senderId: string }) => {
      // Echo: broadcast message only the client who send the message
      socket.emit('message', {
        text: `Echo: ${msg.text}`,
        senderId: 'system',
        timestamp: new Date().toISOString(),
      });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });

    // Send welcome message
    socket.emit('message', {
      text: 'Welcome to WebSocket Score Server!',
      senderId: 'system',
      timestamp: new Date().toISOString(),
    });
  });
};