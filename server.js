const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

app.use(express.static("public"));

let rooms = {};

io.on("connection", socket => {

  socket.on("setName", name=>{
    socket.username = name;
  });

  socket.on("createRoom", ({name, pass})=>{
    if(rooms[name]) return;

    rooms[name] = {
      pass: pass || "",
      users: [],
      streamer: null
    };

    socket.join(name);
    socket.room = name;

    rooms[name].users.push(socket.id);

    updateRooms();
  });

  socket.on("joinRoom", ({room, username, pass})=>{
    const r = rooms[room];
    if(r && r.pass === pass){

      socket.join(room);
      socket.room = room;
      socket.username = username;

      r.users.push(socket.id);

      // 🔥 Eğer yayın varsa yeni gelene söyle
      if(r.streamer){
        socket.emit("watchStream", r.streamer);
      }

      updateRooms();
    }
  });

  /* STREAM BAŞLAT */
  socket.on("startStream", ()=>{
    if(socket.room){
      rooms[socket.room].streamer = socket.id;

      // herkese bildir
      socket.to(socket.room).emit("newStreamer", socket.id);
    }
  });

  /* VIEWER → STREAMER */
  socket.on("watchStream", (streamerId)=>{
    io.to(streamerId).emit("viewerJoined", socket.id);
  });

  /* WEBRTC */
  socket.on("offer", ({to, offer})=>{
    io.to(to).emit("offer",{from:socket.id, offer});
  });

  socket.on("answer", ({to, answer})=>{
    io.to(to).emit("answer",{from:socket.id, answer});
  });

  socket.on("candidate", ({to, candidate})=>{
    io.to(to).emit("candidate",{from:socket.id, candidate});
  });

  socket.on("disconnect", ()=>{
    if(socket.room && rooms[socket.room]){
      const r = rooms[socket.room];

      r.users = r.users.filter(id=>id!==socket.id);

      if(r.streamer === socket.id){
        r.streamer = null;
        io.to(socket.room).emit("streamEnded");
      }

      updateRooms();
    }
  });

  function updateRooms(){
    io.emit("rooms", Object.keys(rooms).map(r=>({
      name:r,
      count:rooms[r].users.length
    })));
  }

});

http.listen(3000, ()=>console.log("Server çalışıyor"));
