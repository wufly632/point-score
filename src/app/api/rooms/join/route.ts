import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';

export async function POST(request: NextRequest) {
  try {
    const { roomCode, userName } = await request.json();

    if (!roomCode || !userName) {
      return NextResponse.json(
        { error: '房间码和用户名不能为空' },
        { status: 400 }
      );
    }

    // 查找房间并包含用户信息
    const room = await db.room.findUnique({
      where: { code: roomCode },
      include: {
        roomUsers: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!room) {
      return NextResponse.json(
        { error: '房间不存在' },
        { status: 404 }
      );
    }

    if (!room.isActive) {
      return NextResponse.json(
        { error: '房间已关闭' },
        { status: 400 }
      );
    }

    // 检查房间中是否已经有同名用户
    const existingRoomUser = room.roomUsers.find(
      roomUser => roomUser.user.name === userName
    );

    let user, roomUser;

    if (existingRoomUser) {
      // 如果用户已存在，直接使用现有用户数据
      user = existingRoomUser.user;
      roomUser = existingRoomUser;
    } else {
      // 创建新用户
      user = await db.user.create({
        data: {
          email: `${nanoid()}@temp.com`, // 临时邮箱
          name: userName,
        },
      });

      // 创建房间用户
      roomUser = await db.roomUser.create({
        data: {
          userId: user.id,
          roomId: room.id,
          score: 0,
        },
      });
    }

    return NextResponse.json({
      room: {
        id: room.id,
        name: room.name,
        code: room.code,
      },
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
    console.error('加入房间失败:', error);
    return NextResponse.json(
      { error: '加入房间失败' },
      { status: 500 }
    );
  }
}