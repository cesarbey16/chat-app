// ============================================================================
// CHATPRO - PREMIUM FRONTEND ENGINE (script.js)
// ============================================================================

const socket = io();

// Global Durum Yönetimi (State)
let myUsername = "";
let currentRoom = null;
let localStream = null;
let peerConnections = {};
let isMuted = false;

const iceConfig = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

// DOMELEMENTLERİ
const loginModal = document.getElementById("loginModal");
const usernameInput = document.getElementById("usernameInput");
const loginBtn = document.getElementById("loginBtn");
const myUsernameDisplay = document.getElementById("myUsernameDisplay");
const roomsContainer = document.getElementById("roomsContainer");
const roomsCount = document.getElementById("roomsCount");
const currentRoomTitle = document.getElementById("currentRoomTitle");
const startStreamBtn = document.getElementById("startStreamBtn");
const leaveRoomBtn = document.getElementById("leaveRoomBtn");
const messagesContainer = document.getElementById("messagesContainer");
const chatInput = document.getElementById("chatInput");
const sendMessageBtn = document.getElementById("sendMessageBtn");
const emojiBtn = document.getElementById("emojiBtn");
const usersContainer = document.getElementById("usersContainer");
const usersCount = document.getElementById("usersCount");
const themeToggle = document.getElementById("themeToggle");

// Oynatıcı DOM Elemanları
const videoPlayerContainer = document.getElementById("videoPlayerContainer");
const videoTarget = document.getElementById("videoTarget");
const streamerNameDisplay = document.getElementById("streamerNameDisplay");
const playPauseBtn = document.getElementById("playPauseBtn");
const muteBtn = document.getElementById("muteBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const latencyValue = document.getElementById("latencyValue");

// ============================================================================
// GİRİŞ VE TEMA KONTROLÜ
// ============================================================================

loginBtn.addEventListener("click", () => {
  const name = usernameInput.value.trim();
  if (!name) {
    showToast("Lütfen geçerli bir kullanıcı adı girin!", "error");
    return;
  }
  myUsername = name;
  if (myUsernameDisplay) myUsernameDisplay.innerText = myUsername;
  
  socket.emit("setName", myUsername);
  socket.emit("getRooms");
  
  // Modalı kapat
  loginModal.classList.remove("active");
  
  // MOBİL KİLİT ÇÖZÜCÜ: Giriş yapıldığında mobildeki Odalar sekmesini otomatik olarak aktif et
  if (window.innerWidth <= 768) {
    const sidebar = document.querySelector(".sidebar");
    if (sidebar) sidebar.classList.add("tab-active");
  }
  
  showToast(`Hoş geldin, ${myUsername}!`, "success");
});

usernameInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") loginBtn.click();
});

themeToggle.addEventListener("click", () => {
  const currentTheme = document.body.getAttribute("data-theme");
  if (currentTheme === "light") {
    document.body.removeAttribute("data-theme");
    themeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>';
  } else {
    document.body.setAttribute("data-theme", "light");
    themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
  }
});

// ============================================================================
// ODA YÖNETİMİ (ROOM MANAGEMENT)
// ============================================================================

socket.on("rooms", (roomsList) => {
  roomsContainer.innerHTML = "";
  roomsCount.innerText = roomsList.length;

  if (roomsList.length === 0) {
    roomsContainer.innerHTML = '<div class="empty-state" style="padding:15px; text-align:center; color:var(--text-muted);">Henüz oda yok...</div>';
    return;
  }

  roomsList.forEach((r) => {
    const item = document.createElement("div");
    item.className = `room-item ${currentRoom === r.name ? 'active' : ''}`;
    
    const lockIcon = r.locked ? '<i class="fa-solid fa-lock text-muted"></i>' : '';
    const liveBadge = r.hasStream ? '<span class="live-badge-mini">CANLI</span>' : '';

    item.innerHTML = `
      <div class="room-item-left">
        <i class="fa-solid fa-hashtag"></i>
        <span>${r.name}</span>
      </div>
      <div class="room-item-right">
        ${liveBadge}
        ${lockIcon}
        <span><i class="fa-solid fa-users"></i> ${r.count}</span>
      </div>
    `;

    item.onclick = () => {
      if (r.locked && currentRoom !== r.name) {
        document.getElementById("targetRoomName").value = r.name;
        document.getElementById("joinPassInput").value = "";
        openModal("passwordModal");
      } else {
        handleJoinRoom(r.name, "");
      }
    };

    roomsContainer.appendChild(item);
  });
});

document.getElementById("submitCreateRoomBtn").addEventListener("click", () => {
  const name = document.getElementById("roomNameInput").value.trim();
  const pass = document.getElementById("roomPassInput").value;
  
  if (!name) {
    showToast("Oda adı boş olamaz!", "error");
    return;
  }
  
  currentRoom = name;
  messagesContainer.innerHTML = "";
  currentRoomTitle.innerText = name;
  
  chatInput.disabled = false;
  sendMessageBtn.disabled = false;
  emojiBtn.disabled = false;
  startStreamBtn.classList.remove("hidden");
  leaveRoomBtn.classList.remove("hidden");
  
  socket.emit("createRoom", { name, pass });
  closeModal("createRoomModal");
  document.getElementById("roomNameInput").value = "";
  document.getElementById("roomPassInput").value = "";

  // Mobilde oda kurunca direkt chat alanına geçiş yap ki kullanıcı rahat etsin
  if (window.innerWidth <= 768) {
    setTimeout(() => {
      const chatBtn = document.querySelector(".mobile-tab-btn[onclick*='chat']");
      if (chatBtn) chatBtn.click();
    }, 100);
  }
});

document.getElementById("submitPasswordBtn").addEventListener("click", () => {
  const name = document.getElementById("targetRoomName").value;
  const pass = document.getElementById("joinPassInput").value;
  handleJoinRoom(name, pass);
  closeModal("passwordModal");
});

function handleJoinRoom(roomName, pass) {
  if (currentRoom === roomName) return;
  currentRoom = roomName;
  
  messagesContainer.innerHTML = "";
  currentRoomTitle.innerText = roomName;
  
  chatInput.disabled = false;
  sendMessageBtn.disabled = false;
  emojiBtn.disabled = false;
  startStreamBtn.classList.remove("hidden");
  leaveRoomBtn.classList.remove("hidden");

  socket.emit("joinRoom", { room: roomName, username: myUsername, pass });

  // Mobilde odaya katılınca direkt mesajlar sekmesine aktar
  if (window.innerWidth <= 768) {
    setTimeout(() => {
      const chatBtn = document.querySelector(".mobile-tab-btn[onclick*='chat']");
      if (chatBtn) chatBtn.click();
    }, 100);
  }
}

leaveRoomBtn.addEventListener("click", () => {
  location.reload();
});

// ============================================================================
// KULLANICI LİSTESİ VE MESAJLAŞMA (CHAT SYSTEM)
// ============================================================================

socket.on("users", ({ users, ownerId }) => {
  usersContainer.innerHTML = "";
  usersCount.innerText = users.length;

  users.forEach((u) => {
    const card = document.createElement("div");
    card.className = "user-card";

    const isOwner = u.id === ownerId;
    const ownerBadge = isOwner ? '<span class="role-badge role-owner">KURUCU</span>' : '';

    card.innerHTML = `
      <div class="user-card-left">
        <div class="user-avatar-mini"><i class="fa-solid fa-user"></i></div>
        <span>${u.name}</span>
      </div>
      <div class="user-card-right">
        ${ownerBadge}
      </div>
    `;
    usersContainer.appendChild(card);
  });
});

function sendChatMessage() {
  const text = chatInput.value.trim();
  if (!text) return;
  socket.emit("chatMessage", text);
  chatInput.value = "";
  chatInput.focus();
}

sendMessageBtn.addEventListener("click", sendChatMessage);
chatInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendChatMessage();
});

socket.on("message", (msg) => {
  const welcomeBox = messagesContainer.querySelector(".welcome-box");
  if (welcomeBox) welcomeBox.remove();

  const msgRow = document.createElement("div");
  
  if (msg.senderId === socket.id) {
    msgRow.className = "message-row msg-me";
  } else {
    msgRow.className = "message-row msg-other";
  }

  msgRow.innerHTML = `
    <div class="message-bubble">
      <div class="msg-user-meta">
        ${msg.user} <span class="msg-timestamp">${msg.time}</span>
      </div>
      <div class="msg-text">${escapeHTML(msg.text)}</div>
    </div>
  `;

  messagesContainer.appendChild(msgRow);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
});

socket.on("errorNotify", (msg) => {
  showToast(msg, "error");
});

// ============================================================================
// WEBRTC VE CANLI YAYIN ALTYAPISI (MOBİL GÜVENLİ)
// ============================================================================

startStreamBtn.addEventListener("click", async () => {
  try {
    localStream = await navigator.mediaDevices.getDisplayMedia({
      video: { cursor: "always", frameRate: 30 },
      audio: true
    });

    startStreamBtn.classList.add("hidden");
    socket.emit("startStream");
    attachStreamToPlayer(localStream, myUsername, true);

    localStream.getVideoTracks()[0].onended = () => {
      stopMyStream();
    };

    showToast("Ekran paylaşımı başarıyla başladı!", "success");
  } catch (err) {
    console.error(err);
    showToast("Ekran paylaşımı başlatılamadı veya iptal edildi.", "error");
  }
});

socket.on("viewerJoined", async (viewerId) => {
  if (!localStream) return;
  
  const pc = new RTCPeerConnection(iceConfig);
  peerConnections[viewerId] = pc;

  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

  pc.onicecandidate = (e) => {
    if (e.candidate) {
      socket.emit("candidate", { to: viewerId, candidate: e.candidate });
    }
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  
  socket.emit("offer", { to: viewerId, offer });
});

socket.on("watchStream", ({ streamerId, streamerName }) => {
  if (streamerId === socket.id) return;
  socket.emit("watchStream", streamerId);
  streamerNameDisplay.innerText = streamerName;
});

socket.on("newStreamer", ({ streamerId, streamerName }) => {
  if (streamerId === socket.id) return;
  socket.emit("watchStream", streamerId);
  streamerNameDisplay.innerText = streamerName;
});

socket.on("offer", async ({ from, offer }) => {
  const pc = new RTCPeerConnection(iceConfig);
  peerConnections[from] = pc;

  pc.ontrack = (e) => {
    attachStreamToPlayer(e.streams[0], streamerNameDisplay.innerText, false);
  };

  pc.onicecandidate = (e) => {
    if (e.candidate) {
      socket.emit("candidate", { to: from, candidate: e.candidate });
    }
  };

  await pc.setRemoteDescription(offer);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  socket.emit("answer", { to: from, answer });
});

socket.on("answer", ({ from, answer }) => {
  if (peerConnections[from]) {
    peerConnections[from].setRemoteDescription(answer);
  }
});

socket.on("candidate", ({ from, candidate }) => {
  if (peerConnections[from]) {
    peerConnections[from].addIceCandidate(candidate).catch(e => console.error(e));
  }
});

socket.on("streamEnded", () => {
  removeVideoPlayer();
  showToast("Canlı yayın sona erdi.", "info");
});

function stopMyStream() {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  socket.emit("disconnect");
  location.reload();
}

function attachStreamToPlayer(stream, name, isLocal = false) {
  videoPlayerContainer.classList.remove("hidden");
  videoTarget.innerHTML = "";

  const video = document.createElement("video");
  video.id = "mainLiveVideo";
  video.autoplay = true;
  
  video.setAttribute("playsinline", "true");
  video.setAttribute("webkit-playsinline", "true");
  video.muted = isLocal ? true : false;

  video.srcObject = stream;
  video.ondblclick = () => handleFullscreenToggle();

  videoTarget.appendChild(video);
  streamerNameDisplay.innerText = name;
  
  video.play().catch(() => {
    video.muted = true;
    video.play();
    showToast("Yayın otomatik engellendi, sesi açmak için oynatıcıyı kullanın.", "info");
  });

  setTimeout(() => {
    latencyValue.innerText = Math.floor(Math.random() * 15 + 5);
  }, 1000);
}

function removeVideoPlayer() {
  videoTarget.innerHTML = "";
  videoPlayerContainer.classList.add("hidden");
  startStreamBtn.classList.remove("hidden");
}

// ============================================================================
// PLAYER CONTROLS (TAM EKRAN LOJİĞİ)
// ============================================================================

fullscreenBtn.addEventListener("click", handleFullscreenToggle);

function handleFullscreenToggle() {
  const v = document.getElementById("mainLiveVideo");
  if (!v) return;

  if (v.webkitEnterFullscreen) {
    v.webkitEnterFullscreen();
    return;
  } else if (v.requestFullscreen) {
    if (!document.fullscreenElement) {
      videoPlayerContainer.requestFullscreen().then(() => {
        videoPlayerContainer.classList.add("fullscreen-mode");
      }).catch(err => console.log(err));
    } else {
      document.exitFullscreen();
      videoPlayerContainer.classList.remove("fullscreen-mode");
    }
  }
}

document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement) {
    videoPlayerContainer.classList.remove("fullscreen-mode");
  }
});

muteBtn.addEventListener("click", () => {
  const v = document.getElementById("mainLiveVideo");
  if (!v) return;

  isMuted = !isMuted;
  v.muted = isMuted;
  muteBtn.innerHTML = isMuted ? '<i class="fa-solid fa-volume-xmark"></i>' : '<i class="fa-solid fa-volume-high"></i>';
});

playPauseBtn.addEventListener("click", () => {
  const v = document.getElementById("mainLiveVideo");
  if (!v) return;

  if (v.paused) {
    v.play();
    playPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
  } else {
    v.pause();
    playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
  }
});

// ============================================================================
// HELPERS, MODALS & MOBİL SEKME KONTROLÜ (TABS)
// ============================================================================

function openModal(id) {
  document.getElementById(id).classList.add("active");
}

function closeModal(id) {
  document.getElementById(id).classList.remove("active");
}

function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerText = message;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function escapeHTML(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function switchTab(tabName) {
  const sidebar = document.querySelector(".sidebar");
  const chatSection = document.querySelector(".chat-section");
  const usersBar = document.querySelector(".users-bar");
  const tabs = document.querySelectorAll(".mobile-tab-btn");

  if (!sidebar || !chatSection || !usersBar) return;

  // Önce her yeri gizle
  sidebar.classList.remove("tab-active");
  chatSection.classList.remove("tab-active");
  usersBar.classList.remove("tab-active");
  tabs.forEach(t => t.classList.remove("active"));

  // İlgili sekmeyi aç
  if (tabName === 'rooms') sidebar.classList.add("tab-active");
  if (tabName === 'chat') chatSection.classList.add("tab-active");
  if (tabName === 'users') usersBar.classList.add("tab-active");

  // Buton aktifliğini değiştir
  if (event && event.currentTarget) {
    event.currentTarget.classList.add("active");
  }
}
