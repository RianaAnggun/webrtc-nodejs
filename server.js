const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const port = 8080;

// Membaca sertifikat HTTPS
const options = {
    key: fs.readFileSync(path.join(__dirname, 'ssl', 'key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'ssl', 'cert.pem'))
};

// Menyediakan file HTML dan JavaScript dari folder public
app.use(express.static(path.join(__dirname, 'public')));

// Membuat server HTTPS dan Socket.IO
const server = https.createServer(options, app);
const io = new Server(server);

// Logika signaling
io.on('connection', (socket) => {
    console.log('User terhubung:', socket.id);

    
    // Meneruskan subtitle broadcaster kepada viewer
    socket.on('caption', (payload) => {
        if (
            !payload ||
            typeof payload.roomId !== 'string' ||
            typeof payload.text !== 'string'
        ) {
            return;
        }

        const roomId = payload.roomId.trim();
        const text = payload.text.trim();

        if (
            !roomId ||
            !text ||
            text.length > 1000 ||
            !socket.rooms.has(roomId)
        ) {
            return;
        }

        io.to(roomId).emit('caption', {
            text,
            isFinal: Boolean(payload.isFinal)
        });
    });


    // Broadcaster bergabung ke room
    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        console.log(`Broadcaster ${socket.id} bergabung ke room ${roomId}`);
    });

    // Viewer bergabung ke room
    socket.on('join-as-viewer', (roomId) => {
        socket.join(roomId);
        console.log(`Viewer ${socket.id} bergabung ke room ${roomId}`);

        socket.to(roomId).emit('viewer-joined', {
            viewerId: socket.id
        });
    });

    // Meneruskan offer dari broadcaster
    socket.on('offer', (payload) => {
        io.to(payload.target).emit('offer', {
            sdp: payload.sdp,
            broadcasterId: socket.id
        });
    });

    // Meneruskan answer dari viewer
    socket.on('answer', (payload) => {
        io.to(payload.target).emit('answer', {
            sdp: payload.sdp,
            viewerId: socket.id
        });
    });

    // Meneruskan ICE candidate
    socket.on('ice-candidate', (payload) => {
        socket.to(payload.roomId).emit('ice-candidate', {
            candidate: payload.candidate,
            senderId: socket.id
        });
    });

    // Ketika browser terputus
    socket.on('disconnect', () => {
        console.log('User terputus:', socket.id);
    });
});


 // Menjalankan server agar dapat diakses melalui jaringan lokal
server.listen(port, '0.0.0.0', () => {
    console.log(`Server HTTPS berjalan di https://localhost:${port}`);
    console.log(`Akses jaringan: https://10.100.30.95:${port}`);
});

