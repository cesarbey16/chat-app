// ============================================================================
// CHATPRO - ADVANCED BACKEND SERVER (server.js)
// ============================================================================

const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, {
  cors: { origin: "*" }
});

app.use(express.static("public"));

// Aktif odaların ve kullanıcıların durumunu tutan merkezi hafıza
let rooms = {};

io.on("connection", (socket) => {
  console.log(`⚡ Yeni Bağlantı: ${socket.id}`);

  // Kullanıcı ismini kaydet
  socket.on("setName", (name) => {
    socket.username = name || "Misafir_" + socket.id.substring(0, 4);
  });

  // 1. ODA OLUŞTURMA
  socket.on("createRoom", ({ name, pass }) => {
    if (!name) return;
    const roomName = name.trim();

    if (rooms[roomName]) {
      socket.emit("errorNotify", "Bu isimde bir oda zaten mevcut.");
      return;
    }

    // Gelişmiş oda yapısı
    rooms[roomName] = {
      pass: pass ? pass.trim() : "",
      owner: socket.id,
      ownerName: socket.username,
      users: [],
      streamer: null,
      streamerName: null
    };

    console.log(`🏠 Oda Oluşturuldu: ${roomName} (Kurucu: ${socket.username})`);
    
    // Oluşturan kişiyi odaya otomatik sok
    joinRoomLogic(socket, roomName, pass);
  });

  // 2. ODALARI LİSTELEME
  socket.on("getRooms", () => {
    sendRoomsList(socket);
  });

  // 3. ODAYA KATILMA
  socket.on("joinRoom", ({ room, username, pass }) => {
    if (username) socket.username = username.trim();
    joinRoomLogic(socket, room, pass);
  });

  // 4. CHAT SİSTEMİ (Çift mesaj ve yönlendirme düzeltildi)
  socket.on("chatMessage", (msg) => {
    if (!socket.room || !msg) return;
    const trimmedMsg = msg.trim();
    if (trimmedMsg === "") return;

    // Mesajı odadaki herkese gönderiyoruz, gönderenin id'sini de ekliyoruz ki frontend sağ/sol ayırsın
    io.to(socket.room).emit("message", {
      id: Math.random().toString(36).substring(2, 9),
      text: trimmedMsg,
      user: socket.username,
      senderId: socket.id,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  });

  // 5. WEBRTC SİNYALLEŞME & CANLI YAYIN ALTYAPISI
  socket.on("startStream", () => {
    if (!socket.room || !rooms[socket.room]) return;

    rooms[socket.room].streamer = socket.id;
    rooms[socket.room].streamerName = socket.username;

    console.log(`📺 Yayına Başladı: ${socket.username} (Oda: ${socket.room})`);

    // Odadaki diğer herkese yeni yayıncıyı bildir
    socket.to(socket.room).emit("newStreamer", {
      streamerId: socket.id,
      streamerName: socket.username
    });
  });

  // İzleyici yayını izlemek istediğinde yayıncıya talep gönderir
  socket.on("watchStream", (streamerId) => {
    io.to(streamerId).emit("viewerJoined", socket.id);
  });

  // WebRTC El Sıkışmaları (Signaling Peer-to-Peer)
  socket.on("offer", ({ to, offer }) => {
    io.to(to).emit("offer", { from: socket.id, offer });
  });

  socket.on("answer", ({ to, answer }) => {
    io.to(to).emit("answer", { from: socket.id, answer });
  });

  socket.on("candidate", ({ to, candidate }) => {
    io.to(to).emit("candidate", { from: socket.id, candidate });
  });

  // 6. BAĞLANTI KOPMA (DISCONNECT) YÖNETİMİ
  socket.on("disconnect", () => {
    console.log(`❌ Bağlantı Koptu: ${socket.id}`);
    
    if (socket.room && rooms[socket.room]) {
      const roomName = socket.room;
      const r = rooms[roomName];

      // Kullanıcıyı listeden çıkar
      r.users = r.users.filter(u => u.id !== socket.id);

      // Eğer yayıncı odadan çıktıysa yayını sonlandır
      if (r.streamer === socket.id) {
        r.streamer = null;
        r.streamerName = null;
        io.to(roomName).emit("streamEnded");
      }

      // Eğer odada kimse kalmadıysa odayı tamamen sil
      if (r.users.length === 0) {
        console.log(`🗑️ Oda Boşaldığı İçin Silindi: ${roomName}`);
        delete rooms[roomName];
      } else {
        // Eğer odayı kuran çıktıysa yeni bir admin ata
        if (r.owner === socket.id && r.users.length > 0) {
          r.owner = r.users[0].id;
          r.ownerName = r.users[0].name;
        }
        // Güncel kullanıcı listesini odaya duyur
        io.to(roomName).emit("users", {
          users: r.users,
          ownerId: r.owner
        });
      }

      sendRoomsList();
    }
  });

  // Odaya katılma ortak mantığı
  function joinRoomLogic(currentSocket, roomName, password) {
    const r = rooms[roomName];
    if (!r) {
      currentSocket.emit("errorNotify", "Oda bulunamadı.");
      return;
    }

    if (r.pass && r.pass !== password) {
      currentSocket.emit("errorNotify", "Hatalı oda şifresi!");
      return;
    }

    // Eğer kullanıcı zaten bir odadaysa önce oradan çıkar
    if (currentSocket.room) {
      currentSocket.leave(currentSocket.room);
    }

    currentSocket.join(roomName);
    currentSocket.room = roomName;

    // Kullanıcıyı odaya ekle
    r.users.push({ id: currentSocket.id, name: currentSocket.username });

    // Odadakilere güncel kullanıcıları ve oda sahibini at
    io.to(roomName).emit("users", {
      users: r.users,
      ownerId: r.owner
    });

    // Eğer odada aktif bir yayın varsa, yeni giren kişiye yayıncı bilgisini gönder (Sonradan girme fix!)
    if (r.streamer) {
      currentSocket.emit("watchStream", {
        streamerId: r.streamer,
        streamerName: r.streamerName
      });
    }

    // Global oda listesini güncelle
    sendRoomsList();
  }

  // Tüm sunucuya ya da hedef kişiye odaları gönderen fonksiyon
  function sendRoomsList(target) {
    const data = Object.keys(rooms).map(r => ({
      name: r,
      count: rooms[r].users.length,
      locked: rooms[r].pass !== "",
      hasStream: rooms[r].streamer !== null
    }));

    if (target) {
      target.emit("rooms", data);
    } else {
      io.emit("rooms", data);
    }
  }
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`🚀 ChatPro Sunucusu http://localhost:${PORT} adresinde aktif!`);
});
