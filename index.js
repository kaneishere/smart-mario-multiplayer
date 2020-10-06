const app = require("express")();
const server = require("http").Server(app);
const io = require("socket.io")(server);

server.listen(3000);

// global variables for the Server
const rooms = [];
let playerSpawnPoints = [];

function create_UUID() {
  let dt = new Date().getTime();
  const uuid = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (dt + Math.random() * 16) % 16 | 0;
    dt = Math.floor(dt / 16);
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
  return uuid;
}

app.get("/", (req, res) => {
  res.send('hey you got back get "/"');
});

io.on("connection", (socket) => {
  let currentPlayer = {};
  currentPlayer.name = "unknown";

  socket.on("play", (data) => {
    console.log(`${currentPlayer.name} recv: play: ${JSON.stringify(data)}`);

    if (rooms.length === 0) {
      playerSpawnPoints = [];
      data.playerSpawnPoints.forEach((_playerSpawnPoint) => {
        const playerSpawnPoint = {
          position: _playerSpawnPoint.position,
        };
        playerSpawnPoints.push(playerSpawnPoint);
      });
    }

    let roomFound = false;
    let index = 0;
    for (let i = 0; i < rooms.length; i++) {
      if (rooms[i].roomID === data.roomID) {
        roomFound = true;
        index = i;
        break;
      }
    }

    if (!roomFound) {
      clients = [];
      currentPlayer = {
        name: data.name,
        roomID: create_UUID(),
        isOwner: data.isOwner,
        position: playerSpawnPoints[0].position,
      };
      clients.push(currentPlayer);
      const currentRoom = {
        roomID: currentPlayer.roomID,
        roomName: data.roomName,
        roomCapacity: data.capacity,
        roomOwner: data.name,
        noOfClients: clients.length,
        minigameSelected: data.minigameSelected,
        difficultySelected: data.difficultySelected,
        // more to be added like minigame selected
        clients,
      };
      rooms.push(currentRoom);
      socket.join(currentPlayer.roomID);
      console.log(
        `${currentPlayer.name} emit: play: ${JSON.stringify(currentPlayer)}`,
      );
      socket.emit("play", currentPlayer);
    } else if (rooms[index].roomCapacity <= rooms[index].clients.length) {
      console.log(`Room ${data.roomName} is full`);
      socket.emit("room is full", data);
    } else {
      currentPlayer = {
        name: data.name,
        roomID: data.roomID,
        isOwner: data.isOwner,
        position: playerSpawnPoints[rooms[index].clients.length].position,
      };
      rooms[index].clients.push(currentPlayer);
      rooms[index].noOfClients += 1;
      // in your current game, tell you that you have joined
      console.log(
        `${currentPlayer.name} emit: play: ${JSON.stringify(currentPlayer)}`,
      );
      socket.emit("play", currentPlayer);
      // in your current game, we need to tell the other player except you
      socket.broadcast
        .to(data.roomID)
        .emit("other player connected", currentPlayer);
    }
  });

  socket.on("minigame initialization", (data) => {
    let clients = [];
    for (let i = 0; i < rooms.length; i++) {
      if (rooms[i].roomID === data.roomID) {
        clients = rooms[i].clients;
      }
    }
    io.in(data.roomID).emit("minigame initialization", { ...data, clients });
  });

  socket.on("roll dice", (data) => {
    const { roomID, number, username } = data;
    io.in(roomID).emit("roll dice", { number, username });
  });

  socket.on("answer question", (data) => {
    const { roomID, username } = data;
    io.in(roomID).emit("answer question", username);
  });

  socket.on("qn result", (data) => {
    const { roomID, score } = data;
    io.in(roomID).emit("qn result", { score });
  });

  socket.on("next player", (data) => {
    const { username, roomID } = data;
    let nextPlayerName = "";
    for (let i = 0; i < rooms.length; i++) {
      if (rooms[i].roomID === roomID) {
        for (let j = 0; j < rooms[j].clients.length; j++) {
          if (rooms[i].clients[j] === username) {
            const len = rooms[i].clients[j].length;
            nextPlayerName = rooms[i].clients[(j + 1) % len];
            break;
          }
        }
        break;
      }
    }
    socket.broadcast.to(roomID).emit("next player", nextPlayerName);
  });

  socket.on("end game", (data) => {
    const { roomID } = data;
    io.broadcast.emit(roomID).emit("end game");
  });

  // below function can combine with socket.on('play'); (can help me @kane)
  socket.on("player connect", (data) => {
    console.log(`${currentPlayer.name} recv: player connect`);
    for (let i = 0; i < rooms.length; i++) {
      if (rooms[i].roomID === data.roomID) {
        console.log();
        if (rooms[i].roomCapacity > rooms[i].clients.length) {
          for (let j = 0; j < rooms[i].clients.length; j++) {
            let playerConnected = {};
            playerConnected = {
              name: rooms[i].clients[j].name,
              roomID: rooms[i].clients[j].roomID,
              isOwner: rooms[i].clients[j].isOwner,
              position: rooms[i].clients[j].position,
            };
            console.log(playerConnected);
            // in your current game, we need to tell u about the other player
            socket.join(data.roomID);
            socket.emit("other player connected", playerConnected);
            console.log(
              `${
                currentPlayer.name
              } emit: other player connected: ${JSON.stringify(
                playerConnected,
              )}`,
            );
          }
        } else {
          console.log(`Room ${data.roomName} is full`);
          socket.emit("room is full", data);
        }
      }
    }
  });

  socket.on("player move", (data) => {
    console.log(`recv: move ${JSON.stringify(data)}`);
    currentPlayer.position = data.position;
    console.log(
      `${currentPlayer.name} recv: player move ${currentPlayer.roomID}`,
    );
    socket.broadcast
      .to(currentPlayer.roomID)
      .emit("player move", currentPlayer);
  });

  socket.on("disconnect", () => {
    console.log(`${currentPlayer.name} recv: disconnect ${currentPlayer.name}`);
    socket.broadcast
      .to(currentPlayer.roomID)
      .emit("other player disconnected", currentPlayer);
    console.log(
      `${currentPlayer.name} bcst: other player disconnected ${JSON.stringify(
        currentPlayer,
      )}`,
    );

    for (let i = 0; i < rooms.length; i++) {
      if (rooms[i].roomID === currentPlayer.roomID) {
        for (let j = 0; j < rooms[i].clients.length; j++) {
          if (rooms[i].clients[j].name === currentPlayer.name) {
            rooms[i].clients.splice(j, 1);
            rooms[i].noOfClients -= 1;
          }
        }
        if (rooms[i].clients.length === 0) {
          rooms.splice(i, 1);
        } else if (currentPlayer.isOwner) {
          rooms[i].clients[0].isOwner = true;
          rooms[i].roomOwner = rooms[i].clients[0].name;
          socket.broadcast
            .to(currentPlayer.roomID)
            .emit("owner disconnected", rooms[i].clients[0]);
        }
      }
    }
    socket.leave(currentPlayer.roomID);
  });

  socket.on("get rooms", () => {
    const allRooms = [];
    for (let i = 0; i < rooms.length; i++) {
      const room = {
        roomID: rooms[i].roomID,
        roomName: rooms[i].roomName,
        roomOwner: rooms[i].roomOwner,
        noOfClients: rooms[i].noOfClients,
        roomCapacity: rooms[i].roomCapacity,
        minigameSelected: rooms[i].minigameSelected,
        difficultySelected: rooms[i].difficultySelected,
      };
      allRooms.push(room);
    }
    const roomsData = {
      rooms: allRooms,
    };
    socket.emit("get rooms", roomsData);
  });
});

console.log("----server is running...");
