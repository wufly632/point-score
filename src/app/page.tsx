'use client';

import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { QrCode, Users, Plus, LogIn, TrendingUp } from 'lucide-react';

interface Room {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  createdAt: string;
  users: Array<{
    id: string;
    name: string;
    score: number;
    joinedAt: string;
  }>;
  creator: {
    id: string;
    name: string;
  };
  transactions?: Array<{
    id: string;
    fromUser: {
      id: string;
      name: string;
      score: number;
    };
    toUser: {
      id: string;
      name: string;
      score: number;
    };
    amount: number;
    description: string;
    timestamp: string;
  }>;
}

interface User {
  id: string;
  name: string;
}

interface RoomUser {
  id: string;
  score: number;
}

interface ScoreUpdate {
  fromUser: {
    id: string;
    name: string;
    score: number;
  };
  toUser: {
    id: string;
    name: string;
    score: number;
  };
  amount: number;
  description: string;
  timestamp: string;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState('create');
  const [roomName, setRoomName] = useState('');
  const [userName, setUserName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentRoomUser, setCurrentRoomUser] = useState<RoomUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [socket, setSocket] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [recentUpdates, setRecentUpdates] = useState<ScoreUpdate[]>([]);
  const [borrowForm, setBorrowForm] = useState({
    fromUserId: '',
    amount: '',
    description: '',
  });
  const [createForm, setCreateForm] = useState({
    roomName: '',
    userName: '',
  });
  const [joinForm, setJoinForm] = useState({
    roomCode: '',
    userName: '',
  });
  const [justJoined, setJustJoined] = useState(false);

  // 保存状态到localStorage
  const saveToLocalStorage = (room: Room, user: User, roomUser: RoomUser) => {
    try {
      const sessionData = {
        room,
        user,
        roomUser,
        timestamp: Date.now(),
      };
      localStorage.setItem('pokerScoreSession', JSON.stringify(sessionData));
    } catch (error) {
      console.error('保存会话数据失败:', error);
    }
  };

  // 从localStorage恢复状态
  const loadFromLocalStorage = () => {
    try {
      const saved = localStorage.getItem('pokerScoreSession');
      if (saved) {
        const sessionData = JSON.parse(saved);
        // 检查数据是否过期（24小时）
        if (Date.now() - sessionData.timestamp < 24 * 60 * 60 * 1000) {
          return sessionData;
        } else {
          // 清除过期数据
          localStorage.removeItem('pokerScoreSession');
        }
      }
    } catch (error) {
      console.error('恢复会话数据失败:', error);
      localStorage.removeItem('pokerScoreSession');
    }
    return null;
  };

  // 清除localStorage数据
  const clearLocalStorage = () => {
    try {
      localStorage.removeItem('pokerScoreSession');
    } catch (error) {
      console.error('清除会话数据失败:', error);
    }
  };

  // 页面加载时恢复状态
  useEffect(() => {
    const sessionData = loadFromLocalStorage();
    if (sessionData) {
      // 恢复状态
      setCurrentRoom(sessionData.room);
      setCurrentUser(sessionData.user);
      setCurrentRoomUser(sessionData.roomUser);
      setActiveTab('room');
      
      // 验证房间是否仍然有效并获取最新数据
      const validateAndRefreshRoom = async () => {
        try {
          const response = await fetch(`/api/rooms/${sessionData.room.code}`);
          const roomData = await response.json();
          
          if (response.ok) {
            // 房间仍然有效，更新到最新状态
            setCurrentRoom(roomData);
            // 更新当前用户的积分
            const currentUserInRoom = roomData.users.find((u: any) => u.id === sessionData.roomUser.id);
            if (currentUserInRoom) {
              setCurrentRoomUser(prev => prev ? { ...prev, score: currentUserInRoom.score } : null);
            }
            // 设置历史交易记录
            if (roomData.transactions) {
              setRecentUpdates(roomData.transactions);
            }
            // 更新保存的数据
            saveToLocalStorage(roomData, sessionData.user, {
              ...sessionData.roomUser,
              score: currentUserInRoom?.score || sessionData.roomUser.score
            });
          } else {
            // 房间不存在或已关闭，清除保存的数据
            clearLocalStorage();
            setError('房间已关闭或不存在，请重新创建或加入房间');
            setActiveTab('create');
          }
        } catch (err) {
          console.error('验证房间状态失败:', err);
          // 保留本地状态，但显示连接问题
          setError('无法连接到服务器，显示的可能不是最新数据');
        }
      };

      validateAndRefreshRoom();
    }
  }, []);

  // WebSocket连接管理
  useEffect(() => {
    if (currentRoom) {
      const socketInstance = io({
        path: '/api/socketio',
      });

      setSocket(socketInstance);

      socketInstance.on('connect', () => {
        setIsConnected(true);
        // 加入房间
        socketInstance.emit('join-room', currentRoom.id);
        
        // 如果是刚刚加入的用户，通知其他用户
        if (justJoined && currentUser && currentRoomUser) {
          socketInstance.emit('user-joined', {
            roomId: currentRoom.id,
            user: {
              id: currentUser.id,
              name: currentUser.name,
              score: currentRoomUser.score
            }
          });
          setJustJoined(false);
        }
      });

      socketInstance.on('disconnect', () => {
        setIsConnected(false);
      });

      socketInstance.on('score-updated', (update: ScoreUpdate) => {
        console.log('收到积分更新事件:', update);
        
        // 添加到最近更新列表
        setRecentUpdates(prev => [update, ...prev.slice(0, 9)]); // 保留最近10条
        
        // 刷新房间信息
        fetchRoomInfo();
      });

      socketInstance.on('user-joined-room', () => {
        // 新用户加入时刷新房间信息
        fetchRoomInfo();
      });

      return () => {
        if (currentRoom) {
          socketInstance.emit('leave-room', currentRoom.id);
        }
        socketInstance.disconnect();
      };
    }
  }, [currentRoom, justJoined, currentUser, currentRoomUser]);

  const fetchRoomInfo = async () => {
    if (!currentRoom) return;
    
    try {
      const response = await fetch(`/api/rooms/${currentRoom.code}`);
      const roomData = await response.json();
      
      if (response.ok) {
        setCurrentRoom(roomData);
        // 更新当前用户的积分
        const currentUserInRoom = roomData.users.find((u: any) => u.id === currentRoomUser?.id);
        if (currentUserInRoom) {
          setCurrentRoomUser(prev => prev ? { ...prev, score: currentUserInRoom.score } : null);
        }
        // 设置历史交易记录
        if (roomData.transactions) {
          setRecentUpdates(roomData.transactions);
        }
      }
    } catch (err) {
      console.error('获取房间信息失败:', err);
    }
  };

  const createRoom = async () => {
    const { roomName, userName } = createForm;

    if (!roomName.trim() || !userName.trim()) {
      setError('房间名称和您的姓名不能为空');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: roomName.trim(),
          creatorName: userName.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '创建房间失败');
      }

      setCurrentRoom(data.room);
      setCurrentUser(data.user);
      setCurrentRoomUser(data.roomUser);
      setCreateForm({ roomName: '', userName: '' });
      setActiveTab('room');
      
      // 保存到localStorage
      saveToLocalStorage(data.room, data.user, data.roomUser);
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建房间失败');
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async () => {
    const { roomCode, userName } = joinForm;

    if (!roomCode.trim() || !userName.trim()) {
      setError('房间码和您的姓名不能为空');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomCode: roomCode.trim().toUpperCase(),
          userName: userName.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '加入房间失败');
      }

      // 获取完整的房间信息
      const roomResponse = await fetch(`/api/rooms/${data.room.code}`);
      const roomData = await roomResponse.json();

      if (!roomResponse.ok) {
        throw new Error(roomData.error || '获取房间信息失败');
      }

      setCurrentRoom(roomData);
      setCurrentUser(data.user);
      setCurrentRoomUser(data.roomUser);
      setJoinForm({ roomCode: '', userName: '' });
      setActiveTab('room');
      setJustJoined(true); // 标记为刚刚加入的用户
      
      // 保存到localStorage
      saveToLocalStorage(roomData, data.user, data.roomUser);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加入房间失败');
    } finally {
      setLoading(false);
    }
  };

  const copyRoomCode = () => {
    if (currentRoom?.code) {
      navigator.clipboard.writeText(currentRoom.code);
    }
  };

  const leaveRoom = () => {
    // 清除状态
    setCurrentRoom(null);
    setCurrentUser(null);
    setCurrentRoomUser(null);
    setRecentUpdates([]);
    setJustJoined(false);
    setError('');
    setSuccess('');
    
    // 清除localStorage
    clearLocalStorage();
    
    // 切换到创建房间页面
    setActiveTab('create');
  };

  const handleBorrowScore = async () => {
    if (!currentRoom || !currentRoomUser) return;

    const { fromUserId, amount, description } = borrowForm;

    if (!fromUserId) {
      setError('请选择要借积分的成员');
      return;
    }

    if (!amount || parseInt(amount) <= 0) {
      setError('请输入有效的借积分数量');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/rooms/${currentRoom.code}/borrow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fromUserId, // 借出方
          toUserId: currentRoomUser.id, // 借入方（当前用户）
          amount: parseInt(amount),
          description: description.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '借积分失败');
      }

      // 刷新房间信息
      const roomResponse = await fetch(`/api/rooms/${currentRoom.code}`);
      const roomData = await roomResponse.json();

      if (!roomResponse.ok) {
        throw new Error(roomData.error || '获取房间信息失败');
      }

      setCurrentRoom(roomData);
      setCurrentRoomUser(prev => prev ? { ...prev, score: data.toUser.score } : null);

      // 清空表单
      setBorrowForm({
        fromUserId: '',
        amount: '',
        description: '',
      });

      // 显示成功消息
      setSuccess('借积分成功！');
      
      // 3秒后清除成功消息
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '借积分失败');
    } finally {
      setLoading(false);
    }
  };

  const handleBorrowFormChange = (field: string, value: string) => {
    setBorrowForm(prev => ({ ...prev, [field]: value }));
  };

  const handleCreateFormChange = (field: string, value: string) => {
    setCreateForm(prev => ({ ...prev, [field]: value }));
  };

  const handleJoinFormChange = (field: string, value: string) => {
    setJoinForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">积分借还系统</h1>
          <p className="text-gray-600">创建房间，邀请朋友，轻松管理积分借还</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="create">创建房间</TabsTrigger>
            <TabsTrigger value="join">加入房间</TabsTrigger>
            <TabsTrigger value="room" disabled={!currentRoom}>房间</TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  创建新房间
                </CardTitle>
                <CardDescription>
                  创建一个新的积分房间，邀请朋友加入
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="roomName">房间名称</Label>
                  <Input
                    id="roomName"
                    placeholder="输入房间名称"
                    value={createForm.roomName}
                    onChange={(e) => handleCreateFormChange('roomName', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="creatorName">您的姓名</Label>
                  <Input
                    id="creatorName"
                    placeholder="输入您的姓名"
                    value={createForm.userName}
                    onChange={(e) => handleCreateFormChange('userName', e.target.value)}
                  />
                </div>
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <Button 
                  onClick={createRoom} 
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? '创建中...' : '创建房间'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="join" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LogIn className="h-5 w-5" />
                  加入房间
                </CardTitle>
                <CardDescription>
                  输入房间码加入已有的积分房间
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="roomCode">房间码</Label>
                  <Input
                    id="roomCode"
                    placeholder="输入8位房间码"
                    value={joinForm.roomCode}
                    onChange={(e) => handleJoinFormChange('roomCode', e.target.value.toUpperCase())}
                    maxLength={8}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="userName">您的姓名</Label>
                  <Input
                    id="userName"
                    placeholder="输入您的姓名"
                    value={joinForm.userName}
                    onChange={(e) => handleJoinFormChange('userName', e.target.value)}
                  />
                </div>
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <Button 
                  onClick={joinRoom} 
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? '加入中...' : '加入房间'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="room" className="space-y-4">
            {currentRoom && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        {currentRoom.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {currentRoom.users.length} 人
                        </Badge>
                        <span className={`text-sm px-2 py-1 rounded ${isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {isConnected ? '实时同步' : '连接断开'}
                        </span>
                      </div>
                    </CardTitle>
                    <CardDescription>
                      房间创建者：{currentRoom.creator.name}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <QrCode className="h-5 w-5" />
                        <span className="font-mono text-lg font-bold">
                          {currentRoom.code}
                        </span>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={copyRoomCode}
                      >
                        复制房间码
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={leaveRoom}
                      >
                        退出房间
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>房间成员</CardTitle>
                      <CardDescription>
                        当前房间中的所有成员及其积分
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {currentRoom.users.map((user) => (
                          <div 
                            key={user.id} 
                            className="flex items-center justify-between p-3 border rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                <span className="text-sm font-medium text-blue-600">
                                  {user.name.charAt(0)}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium">{user.name}</p>
                                <p className="text-sm text-gray-500">
                                  {user.id === currentRoomUser?.id ? '您' : ''}
                                </p>
                              </div>
                            </div>
                            <Badge 
                              variant={user.score >= 0 ? "default" : "destructive"}
                              className="text-lg px-3 py-1"
                            >
                              {user.score > 0 ? '+' : ''}{user.score}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        最近更新
                      </CardTitle>
                      <CardDescription>
                        实时的积分交易记录
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-96 w-full">
                        <div className="space-y-3">
                          {recentUpdates.length === 0 ? (
                            <p className="text-center text-gray-500 py-8">
                              暂无积分交易记录
                            </p>
                          ) : (
                            recentUpdates.map((update, index) => (
                              <div key={index} className="p-3 border rounded-lg bg-gray-50">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium text-blue-600">
                                    {update.fromUser.name} → {update.toUser.name}
                                  </span>
                                  <Badge variant="outline" className="text-xs">
                                    {update.amount} 积分
                                  </Badge>
                                </div>
                                <p className="text-sm text-gray-600 mb-1">
                                  {update.description}
                                </p>
                                <p className="text-xs text-gray-400">
                                  {new Date(update.timestamp).toLocaleTimeString()}
                                </p>
                              </div>
                            ))
                          )}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>借积分</CardTitle>
                    <CardDescription>
                      向其他成员借积分或借出积分
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {error && (
                        <Alert variant="destructive">
                          <AlertDescription>{error}</AlertDescription>
                        </Alert>
                      )}
                      
                      {success && (
                        <Alert className="border-green-200 bg-green-50 text-green-800">
                          <AlertDescription>{success}</AlertDescription>
                        </Alert>
                      )}
                      
                      <div className="space-y-2">
                        <Label htmlFor="borrowFrom">向谁借积分</Label>
                        <Select 
                          value={borrowForm.fromUserId} 
                          onValueChange={(value) => handleBorrowFormChange('fromUserId', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="选择成员" />
                          </SelectTrigger>
                          <SelectContent>
                            {currentRoom.users
                              .filter(user => user.id !== currentRoomUser?.id)
                              .map(user => (
                                <SelectItem key={user.id} value={user.id}>
                                  {user.name} (当前积分: {user.score})
                                </SelectItem>
                              ))
                            }
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="borrowAmount">借积分数量</Label>
                        <Input
                          id="borrowAmount"
                          type="number"
                          placeholder="输入借积分数量"
                          min="1"
                          value={borrowForm.amount}
                          onChange={(e) => handleBorrowFormChange('amount', e.target.value)}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="borrowDescription">备注 (可选)</Label>
                        <Input
                          id="borrowDescription"
                          placeholder="输入借积分原因"
                          value={borrowForm.description}
                          onChange={(e) => handleBorrowFormChange('description', e.target.value)}
                        />
                      </div>
                      
                      <Button 
                        onClick={handleBorrowScore}
                        disabled={loading || !isConnected}
                        className="w-full"
                      >
                        {loading ? '处理中...' : '确认借积分'}
                      </Button>
                      {!isConnected && (
                        <p className="text-sm text-red-600 text-center">
                          WebSocket连接断开，请刷新页面重试
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}