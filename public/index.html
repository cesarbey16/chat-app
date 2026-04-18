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

  /* ODA OLUŞTUR */
  socket.on("createRoom", ({name, pass})=>{
    if(rooms[name]) return;

    rooms[name] = {
      pass: pass || "",
      users: [],
      streamer: null
    };

    socket.join(name);
    socket.room = name;

    rooms[name].users.push({
      id:socket.id,
      name:socket.username
    });

    io.to(name).emit("users",
      rooms[name].users.map(u=>u.name)
    );

    sendRooms();
  });

  /* ODAYA GİR */
  socket.on("joinRoom", ({room, username, pass})=>{
    const r = rooms[room];

    if(r && r.pass === pass){

      socket.join(room);
      socket.room = room;
      socket.username = username;

      r.users.push({id:socket.id, name:username});

      io.to(room).emit("users",
        r.users.map(u=>u.name)
      );

      if(r.streamer){
        socket.emit("watchStream", r.streamer);
      }

      sendRooms();
    }
  });

  /* ODA LİSTESİ */
  socket.on("getRooms", ()=>{
    sendRooms(socket);
  });

  /* CHAT */
  socket.on("chatMessage", msg=>{
    if(socket.room){
      io.to(socket.room).emit("message",{
        text:msg,
        user:socket.username
      });
    }
  });

  /* STREAM */
  socket.on("startStream", ()=>{
    if(socket.room){
      rooms[socket.room].streamer = socket.id;
      socket.to(socket.room).emit("newStreamer", socket.id);
    }
  });

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

  /* ÇIKIŞ */
  socket.on("disconnect", ()=>{
    if(socket.room && rooms[socket.room]){
      const r = rooms[socket.room];

      r.users = r.users.filter(u=>u.id !== socket.id);

      // 🔥 ODA BOŞSA SİL
      if(r.users.length === 0){
        delete rooms[socket.room];
      }else{
        io.to(socket.room).emit("users",
          r.users.map(u=>u.name)
        );
      }

      if(r.streamer === socket.id){
        r.streamer = null;
        io.to(socket.room).emit("streamEnded");
      }

      sendRooms();
    }
  });

  function sendRooms(target){
    const data = Object.keys(rooms).map(r=>({
      name:r,
      count:rooms[r].users.length,
      locked: !!rooms[r].pass
    }));

    if(target){
      target.emit("rooms", data);
    }else{
      io.emit("rooms", data);
    }
  }

});

http.listen(3000, ()=>console.log("Server çalışıyor"));
