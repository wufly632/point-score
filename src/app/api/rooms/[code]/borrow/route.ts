import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Server } from 'socket.io';

export async function POST(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const { code } = params;
    const { fromUserId, toUserId, amount, description } = await request.json();

    if (!fromUserId || !toUserId || !amount) {
      return NextResponse.json(
        { error: '借出方、借入方和金额不能为空' },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: '借积分金额必须大于0' },
        { status: 400 }
      );
    }

    // 查找房间
    const room = await db.room.findUnique({
      where: { code },
    });

    if (!room) {
      return NextResponse.json(
        { error: '房间不存在' },
        { status: 404 }
      );
    }

    // 验证用户是否在房间中
    const fromRoomUser = await db.roomUser.findUnique({
      where: { id: fromUserId },
      include: { 
        room: true,
        user: true,
      },
    });

    const toRoomUser = await db.roomUser.findUnique({
      where: { id: toUserId },
      include: { 
        room: true,
        user: true,
      },
    });

    if (!fromRoomUser || !toRoomUser) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      );
    }

    if (fromRoomUser.roomId !== room.id || toRoomUser.roomId !== room.id) {
      return NextResponse.json(
        { error: '用户不在该房间中' },
        { status: 400 }
      );
    }

    // 使用事务来确保数据一致性
    const result = await db.$transaction(async (tx) => {
      // 更新借出方积分
      const updatedFromUser = await tx.roomUser.update({
        where: { id: fromUserId },
        data: { score: { decrement: amount } },
      });

      // 更新借入方积分
      const updatedToUser = await tx.roomUser.update({
        where: { id: toUserId },
        data: { score: { increment: amount } },
      });

      // 创建交易记录
      const transaction = await tx.scoreTransaction.create({
        data: {
          roomId: room.id,
          fromUserId,
          toUserId,
          amount,
          description: description || `${fromRoomUser.user.name} 向 ${toRoomUser.user.name} 借了 ${amount} 积分`,
        },
      });

      return {
        fromUser: updatedFromUser,
        toUser: updatedToUser,
        transaction,
      };
    });

    // 获取全局的socket.io实例（如果存在）
    const globalIo = (global as any).io as Server | undefined;
    
    if (globalIo) {
      console.log(`发送WebSocket事件到房间 ${room.id}:`, {
        fromUser: fromRoomUser.user.name,
        toUser: toRoomUser.user.name,
        amount: result.transaction.amount,
      });
      
      // 发送WebSocket消息通知房间内所有用户
      globalIo.to(room.id).emit('score-updated', {
        fromUser: {
          id: result.fromUser.id,
          name: fromRoomUser.user.name,
          score: result.fromUser.score,
        },
        toUser: {
          id: result.toUser.id,
          name: toRoomUser.user.name,
          score: result.toUser.score,
        },
        amount: result.transaction.amount,
        description: result.transaction.description,
        timestamp: new Date().toISOString(),
      });
    } else {
      console.log('警告: Socket.IO实例不可用，无法发送WebSocket事件');
    }

    return NextResponse.json({
      message: '借积分成功',
      fromUser: {
        id: result.fromUser.id,
        score: result.fromUser.score,
      },
      toUser: {
        id: result.toUser.id,
        score: result.toUser.score,
      },
      transaction: {
        id: result.transaction.id,
        amount: result.transaction.amount,
        description: result.transaction.description,
        createdAt: result.transaction.createdAt,
      },
    });
  } catch (error) {
    console.error('借积分失败:', error);
    return NextResponse.json(
      { error: '借积分失败' },
      { status: 500 }
    );
  }
}