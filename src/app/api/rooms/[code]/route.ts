import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const { code } = params;

    // 查找房间
    const room = await db.room.findUnique({
      where: { code },
      include: {
        roomUsers: {
          include: {
            user: true,
          },
          orderBy: {
            joinedAt: 'asc',
          },
        },
        creator: true,
        transactions: {
          include: {
            fromUser: {
              include: {
                user: true,
              },
            },
            toUser: {
              include: {
                user: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
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

    return NextResponse.json({
      id: room.id,
      name: room.name,
      code: room.code,
      isActive: room.isActive,
      createdAt: room.createdAt,
      users: room.roomUsers.map(ru => ({
        id: ru.id,
        name: ru.user.name,
        score: ru.score,
        joinedAt: ru.joinedAt,
      })),
      creator: {
        id: room.creator.id,
        name: room.creator.name,
      },
      transactions: room.transactions.map(t => ({
        id: t.id,
        fromUser: {
          id: t.fromUser.id,
          name: t.fromUser.user.name,
          score: t.fromUser.score,
        },
        toUser: {
          id: t.toUser.id,
          name: t.toUser.user.name,
          score: t.toUser.score,
        },
        amount: t.amount,
        description: t.description,
        timestamp: t.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('获取房间信息失败:', error);
    return NextResponse.json(
      { error: '获取房间信息失败' },
      { status: 500 }
    );
  }
}