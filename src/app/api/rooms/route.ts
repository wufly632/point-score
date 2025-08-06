import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';

export async function POST(request: NextRequest) {
  try {
    const { name, creatorName } = await request.json();

    if (!name || !creatorName) {
      return NextResponse.json(
        { error: '房间名称和创建者姓名不能为空' },
        { status: 400 }
      );
    }

    // 创建用户
    const user = await db.user.create({
      data: {
        email: `${nanoid()}@temp.com`, // 临时邮箱
        name: creatorName,
      },
    });

    // 生成房间码
    const roomCode = nanoid(8).toUpperCase();

    // 创建房间
    const room = await db.room.create({
      data: {
        name,
        code: roomCode,
        creatorId: user.id,
      },
    });

    // 创建房间用户
    const roomUser = await db.roomUser.create({
      data: {
        userId: user.id,
        roomId: room.id,
        score: 0,
      },
    });

    // 返回完整的房间数据结构
    const completeRoom = {
      id: room.id,
      name: room.name,
      code: room.code,
      isActive: room.isActive,
      createdAt: room.createdAt.toISOString(),
      users: [{
        id: roomUser.id,
        name: user.name,
        score: roomUser.score,
        joinedAt: roomUser.joinedAt.toISOString(),
      }],
      creator: {
        id: user.id,
        name: user.name,
      },
    };

    return NextResponse.json({
      room: completeRoom,
      user: {
        id: user.id,
        name: user.name,
      },
      roomUser: {
        id: roomUser.id,
        score: roomUser.score,
      },
    });
  } catch (error) {
    console.error('创建房间失败:', error);
    return NextResponse.json(
      { error: '创建房间失败' },
      { status: 500 }
    );
  }
}