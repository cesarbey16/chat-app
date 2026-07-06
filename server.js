// ============================================================================
// CHATPRO SERVER v2.0
// PART 1
// ============================================================================

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.static("public"));

const PORT = process.env.PORT || 3000;

// ============================================================================
// ROOM MEMORY
// ============================================================================

const rooms = {};

// ============================================================================
// ROOM HELPERS
// ============================================================================

function roomExists(name){

    return !!rooms[name];

}

function createRoom(name,password,ownerSocket){

    rooms[name]={

        name,

        password:password || "",

        ownerId:ownerSocket.id,

        ownerName:ownerSocket.username,

        streamer:null,

        streamerName:null,

        users:[],

        createdAt:Date.now()

    };

}

function deleteRoom(name){

    if(!rooms[name]) return;

    delete rooms[name];

    console.log("🗑 Room deleted:",name);

}

function getRoom(name){

    return rooms[name];

}

function sendRooms(){

    const list=Object.values(rooms).map(room=>({

        name:room.name,

        users:room.users.length,

        locked:room.password!=="",

        hasStream:room.streamer!==null,

        owner:room.ownerName

    }));

    io.emit("rooms",list);

}

function addUser(roomName,socket){

    const room=getRoom(roomName);

    if(!room) return;

    room.users=room.users.filter(u=>u.id!==socket.id);

    room.users.push({

        id:socket.id,

        name:socket.username,

        joined:Date.now()

    });

}

function removeUser(roomName,id){

    const room=getRoom(roomName);

    if(!room) return;

    room.users=room.users.filter(

        u=>u.id!==id

    );

}

function sendUsers(roomName){

    const room=getRoom(roomName);

    if(!room) return;

    io.to(roomName).emit("users",{

        users:room.users,

        ownerId:room.ownerId,

        streamerId:room.streamer

    });

}

// ============================================================================
// SOCKET CONNECTION
// ============================================================================

io.on("connection",(socket)=>{

    console.log("⚡ Connected:",socket.id);

    socket.username="Misafir_"+socket.id.substring(0,4);

    socket.room=null;

// ============================================================================
// USER NAME
// ============================================================================

socket.on("setName",(name)=>{

    if(!name) return;

    socket.username=name.trim();

});

// ============================================================================
// CREATE ROOM
// ============================================================================

socket.on("createRoom",({name,password})=>{

    if(!name) return;

    name=name.trim();

    if(roomExists(name)){

        socket.emit(

            "errorNotify",

            "Bu oda zaten var."

        );

        return;

    }

    createRoom(

        name,

        password,

        socket

    );

    joinRoom(

        socket,

        name,

        password

    );

});
// ============================================================================
// JOIN ROOM
// ============================================================================

function joinRoom(socket, roomName, password = "") {

    const room = getRoom(roomName);

    if (!room) {
        socket.emit("errorNotify", "Oda bulunamadı.");
        return;
    }

    if (room.password !== "" && room.password !== password) {
        socket.emit("errorNotify", "Oda şifresi yanlış.");
        return;
    }

    // Eski odadan çık
    if (socket.room && rooms[socket.room]) {

        leaveRoom(socket);

    }

    socket.join(roomName);

    socket.room = roomName;

    addUser(roomName, socket);

    sendUsers(roomName);

    sendRooms();

    console.log(
        "✅",
        socket.username,
        "katıldı ->",
        roomName
    );

    // Sonradan girenler yayını görebilsin

    if (room.streamer) {

        socket.emit("watchStream", {

            streamerId: room.streamer,

            streamerName: room.streamerName

        });

        io.to(room.streamer).emit(

            "viewerJoined",

            socket.id

        );

    }

}

// ============================================================================
// LEAVE ROOM
// ============================================================================

function leaveRoom(socket) {

    if (!socket.room) return;

    const roomName = socket.room;

    const room = rooms[roomName];

    if (!room) {

        socket.room = null;

        return;

    }

    removeUser(

        roomName,

        socket.id

    );

    socket.leave(roomName);

    // Yayıncı çıktıysa

    if (room.streamer === socket.id) {

        room.streamer = null;

        room.streamerName = null;

        io.to(roomName).emit("streamEnded");

        io.to(roomName).emit("closePeer");

    }

    // Oda sahibi çıktıysa

    if (room.ownerId === socket.id) {

        if (room.users.length > 0) {

            room.ownerId = room.users[0].id;

            room.ownerName = room.users[0].name;

            io.to(roomName).emit("newOwner", {

                id: room.ownerId,

                name: room.ownerName

            });

        }

    }

    // Oda boşaldıysa sil

    if (room.users.length === 0) {

        deleteRoom(roomName);

    } else {

        sendUsers(roomName);

    }

    sendRooms();

    socket.room = null;

}

// ============================================================================
// JOIN ROOM EVENT
// ============================================================================

socket.on("joinRoom", ({ room, username, password }) => {

    if (username) {

        socket.username = username.trim();

    }

    joinRoom(

        socket,

        room,

        password

    );

});
// ============================================================================
// CHAT
// ============================================================================

socket.on("chatMessage",(msg)=>{

    if(!socket.room) return;

    if(typeof msg!=="string") return;

    msg=msg.trim();

    if(msg.length===0) return;

    io.to(socket.room).emit("message",{

        id:Date.now()+"_"+Math.random(),

        user:socket.username,

        senderId:socket.id,

        text:msg,

        time:new Date().toLocaleTimeString("tr-TR",{

            hour:"2-digit",
            minute:"2-digit"

        })

    });

});

// ============================================================================
// START STREAM
// ============================================================================

socket.on("startStream",()=>{

    if(!socket.room) return;

    const room=getRoom(socket.room);

    if(!room) return;

    room.streamer=socket.id;

    room.streamerName=socket.username;

    room.streamTime=Date.now();

    socket.to(socket.room).emit("newStreamer",{

        streamerId:socket.id,

        streamerName:socket.username

    });

    sendRooms();

    console.log("📺 Stream başladı:",socket.username);

});

// ============================================================================
// STOP STREAM
// ============================================================================

socket.on("stopStream",()=>{

    if(!socket.room) return;

    const room=getRoom(socket.room);

    if(!room) return;

    if(room.streamer!==socket.id) return;

    room.streamer=null;

    room.streamerName=null;

    room.streamTime=null;

    io.to(socket.room).emit("streamEnded");

    io.to(socket.room).emit("closePeer");

    sendRooms();

});

// ============================================================================
// WATCH STREAM
// ============================================================================

socket.on("watchStream",(streamerId)=>{

    if(!streamerId) return;

    if(streamerId===socket.id) return;

    io.to(streamerId).emit(

        "viewerJoined",

        socket.id

    );

});

// ============================================================================
// OFFER
// ============================================================================

socket.on("offer",({to,offer})=>{

    if(!to) return;

    io.to(to).emit("offer",{

        from:socket.id,

        offer

    });

});

// ============================================================================
// ANSWER
// ============================================================================

socket.on("answer",({to,answer})=>{

    if(!to) return;

    io.to(to).emit("answer",{

        from:socket.id,

        answer

    });

});

// ============================================================================
// ICE
// ============================================================================

socket.on("candidate",({to,candidate})=>{

    if(!to) return;

    io.to(to).emit("candidate",{

        from:socket.id,

        candidate

    });

});
  // ============================================================================
// DISCONNECT
// ============================================================================

socket.on("disconnect", () => {

    console.log("❌ Disconnect:", socket.username);

    leaveRoom(socket);

});

// ============================================================================
// PING
// ============================================================================

socket.on("pingServer", () => {

    socket.emit("pongServer", Date.now());

});

// ============================================================================
// SERVER INFO
// ============================================================================

socket.on("getServerInfo", () => {

    socket.emit("serverInfo", {

        rooms: Object.keys(rooms).length,

        users: Object.values(rooms).reduce(
            (a, r) => a + r.users.length,
            0
        ),

        uptime: process.uptime()

    });

});

// ============================================================================
// FORCE ROOM UPDATE
// ============================================================================

socket.on("refreshRooms", () => {

    sendRooms();

});

// ============================================================================
// FORCE USER UPDATE
// ============================================================================

socket.on("refreshUsers", () => {

    if (!socket.room) return;

    sendUsers(socket.room);

});

// ============================================================================
// END CONNECTION
// ============================================================================

});

// ============================================================================
// AUTO CLEANUP
// ============================================================================

setInterval(() => {

    Object.keys(rooms).forEach(roomName => {

        const room = rooms[roomName];

        if (!room) return;

        room.users = room.users.filter(u => {

            return io.sockets.sockets.has(u.id);

        });

        if (room.users.length === 0) {

            console.log("🗑 Auto delete:", roomName);

            delete rooms[roomName];

        }

    });

    sendRooms();

}, 30000);

// ============================================================================
// ERROR HANDLER
// ============================================================================

process.on("uncaughtException", err => {

    console.error("UNCAUGHT:", err);

});

process.on("unhandledRejection", err => {

    console.error("PROMISE:", err);

});

// ============================================================================
// START SERVER
// ============================================================================

server.listen(PORT, () => {

    console.log("");
    console.log("======================================");
    console.log("🚀 ChatPro Server Started");
    console.log("🌐 http://localhost:" + PORT);
    console.log("======================================");
    console.log("");

});
