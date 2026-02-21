const WebSocket = require('ws');
const http = require('http');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

let rooms = {};

wss.on('connection', (ws) => {
    console.log('新连接');
    
    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data);
            console.log('收到:', msg.type);
            
            if (msg.type === 'create') {
                let roomId;
                do {
                    roomId = Math.random().toString(36).substr(2, 6).toUpperCase();
                } while (rooms[roomId]);
                
                rooms[roomId] = { host: ws, client: null };
                ws.roomId = roomId;
                ws.isHost = true;
                ws.send(JSON.stringify({ type: 'created', roomId }));
                console.log('创建房间:', roomId);
            }
            
            else if (msg.type === 'join') {
                const room = rooms[msg.roomId];
                if (!room) {
                    ws.send(JSON.stringify({ type: 'error', message: '房间不存在' }));
                    return;
                }
                if (room.client) {
                    ws.send(JSON.stringify({ type: 'error', message: '房间已满' }));
                    return;
                }
                
                room.client = ws;
                ws.roomId = msg.roomId;
                ws.isHost = false;
                
                // ========== 修复这里 ==========
                // 给房主发送 start（player 1）
                room.host.send(JSON.stringify({ type: 'start', player: 1 }));
                // 给加入者发送 start（player 2）
                ws.send(JSON.stringify({ type: 'start', player: 2 }));
                
                console.log('游戏开始:', msg.roomId);
            }
            
            else if (msg.type === 'move') {
                const room = rooms[ws.roomId];
                if (!room) return;
                
                // 转发移动给另一方
                const target = ws.isHost ? room.client : room.host;
                if (target && target.readyState === WebSocket.OPEN) {
                    target.send(JSON.stringify({
                        type: 'move',
                        x: msg.x,
                        y: msg.y,
                        player: msg.player
                    }));
                }
            }
        } catch (e) {
            console.error('错误:', e);
        }
    });
    
    ws.on('close', () => {
        console.log('断开连接');
        if (ws.roomId && rooms[ws.roomId]) {
            const room = rooms[ws.roomId];
            const other = ws.isHost ? room.client : room.host;
            if (other && other.readyState === WebSocket.OPEN) {
                other.send(JSON.stringify({ type: 'disconnected' }));
            }
            delete rooms[ws.roomId];
        }
    });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => {
    console.log('服务器运行在端口:', PORT);
});