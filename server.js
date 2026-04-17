let rooms = [];

io.on("connection", socket => {

  socket.on("createRoom", ({name, pass}) => {
    rooms.push({name, pass});
    io.emit("rooms", rooms);
  });

  socket.on("getRooms", ()=>{
    socket.emit("rooms", rooms);
  });

  socket.on("joinRoom", ({room, username, pass})=>{
    const r = rooms.find(x=>x.name===room);

    if(r && r.pass === pass){
      socket.join(room);
      socket.room = room;
      socket.username = username;
    }
  });

  socket.on("chatMessage", msg=>{
    io.to(socket.room).emit("message", {
      text: msg
    });
  });

});
