const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*" }
});

app.use(express.static(__dirname));

// 部屋のデータを管理するオブジェクト
const rooms = {};

io.on('connection', (socket) => {
    console.log('ユーザーが接続しました:', socket.id);

    // 1. 部屋を作成する（ホスト）
    socket.on('createRoom', () => {
        // 6桁のランダムな部屋IDを生成（重複しないようにチェック）
        let roomId;
        do {
            roomId = Math.floor(100000 + Math.random() * 900000).toString();
        } while (rooms[roomId]);

        rooms[roomId] = {
            host: socket.id,
            guest: null
        };

        socket.join(roomId);
        socket.roomId = roomId;
        socket.isHost = true;

        // ホストに部屋IDを通知
        socket.emit('roomCreated', roomId);
        console.log(`部屋が作成されました: ${roomId}`);
    });

    // 2. 部屋に参加する（ゲスト）
    socket.on('joinRoom', (roomId) => {
        const room = rooms[roomId];
        if (!room) {
            socket.emit('joinError', '部屋が見つかりません。');
            return;
        }
        if (room.guest) {
            socket.emit('joinError', 'この部屋は満員です。');
            return;
        }

        room.guest = socket.id;
        socket.join(roomId);
        socket.roomId = roomId;
        socket.isHost = false;

        // ホストとゲスト両方に接続完了を通知
        io.to(roomId).emit('peerConnected');
        console.log(`ゲストが部屋に参加しました: ${roomId}`);
    });

    // 3. ホストからゲストへのゲームデータ同期の転送
    socket.on('syncData', (data) => {
        if (socket.roomId && socket.isHost) {
            // ホスト以外の全員（＝ゲスト）に送る
            socket.to(socket.roomId).emit('sync', data);
        }
    });

    // 4. ゲストからホストへのキー入力の転送
    socket.on('inputData', (data) => {
        if (socket.roomId && !socket.isHost) {
            // ゲスト以外の全員（＝ホスト）に送る
            socket.to(socket.roomId).emit('keys', data);
        }
    });

    // 5. ホストからのステージ選択イベントの転送
    socket.on('stageSelectData', (data) => {
        if (socket.roomId && socket.isHost) {
            io.to(socket.roomId).emit('stageSelect', data);
        }
    });

    // 切断時の処理
    socket.on('disconnect', () => {
        console.log('ユーザーが切断しました:', socket.id);
        if (socket.roomId && rooms[socket.roomId]) {
            io.to(socket.roomId).emit('peerDisconnected');
            delete rooms[socket.roomId]; // 部屋を解散
        }
    });
});

const PORT = 3000;
http.listen(PORT, () => {
    console.log(`サーバーが起動しました！ URL: http://localhost:${PORT}`);
});