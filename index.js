const app = require("express")();
const server = require("http").Server(app);
const io = require("socket.io")(server);

server.listen(3000);

// global variables for the Server
const rooms = [];
let playerSpawnPoints = [];

app.get("/", (req, res) => {
  res.send("hey you got back get \"/\"");
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
      if (rooms[i].name === data.roomName) {
        roomFound = true;
        index = i;
        break;
      }
    }

    if (!roomFound) {
      const clients = [];
      currentPlayer = {
        name: data.name,
        roomName: data.roomName,
        isOwner: data.isOwner,
        position: playerSpawnPoints[0].position,
      };
      clients.push(currentPlayer);
      const currentRoom = {
        name: data.roomName,
        capacity: data.capacity,
        noOfClients: clients.length,
        // more to be added like minigame selected
        clients,
      };
      rooms.push(currentRoom);
      socket.join(data.roomName);

      // To insert socket.Emit('updateRooms', rooms (without clients))
      // under socket.On where new player joins or player leaves
      socket.emit("updateRooms", rooms);

      //
      console.log(
        `${currentPlayer.name} emit: play: ${JSON.stringify(currentPlayer)}`,
      );
      socket.emit("play", currentPlayer);
    } else if (rooms[index].capacity <= rooms[index].clients.length) {
      console.log(`Room ${data.roomName} is full`);
      socket.emit("roomsFull");
    } else {
      currentPlayer = {
        name: data.name,
        roomName: data.roomName,
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
        .to(data.roomName)
        .emit("other player connected", currentPlayer);
    }
  });

  // To also insert socket.On('getRooms') no input data
  socket.on("getRooms", () => {
    const toSend = rooms.map(({ name, capacity, noOfClients }) => ({
      name,
      capacity,
      noOfClients,
    }));
    console.log(toSend);
    socket.emit("getRooms", toSend);
  });

  // below function can combine with socket.on('play'); (can help me @kane)
  socket.on("player connect", (data) => {
    console.log(`${currentPlayer.name} recv: player connect`);
    for (let i = 0; i < rooms.length; i++) {
      console.log(`rooms length: ${rooms.length}`);
      console.log(
        `rooms[i]${rooms[i].name} ${rooms[i].clients} ${rooms[i].capacity} ${rooms[i].clients.length}`,
      );
      if (rooms[i].name === data.roomName) {
        console.log();
        if (rooms[i].capacity > rooms[i].clients.length) {
          for (let j = 0; j < rooms[i].clients.length; j++) {
            console.log(
              `client${j}: ${rooms[i].clients[j].name} ${rooms[i].clients[j].roomName}`,
            );
            let playerConnected = {};

            playerConnected = {
              name: rooms[i].clients[j].name,
              roomName: rooms[i].clients[j].roomName,
              isOwner: rooms[i].clients[j].isOwner,
              position: rooms[i].clients[j].position,
            };
            console.log(playerConnected);
            // in your current game, we need to tell u about the other player
            socket.join(data.roomName);
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
        }
      }
    }
  });

  socket.on("player move", (data) => {
    console.log(`recv: move ${JSON.stringify(data)}`);
    currentPlayer.position = data.position;
    console.log(
      `${currentPlayer.name} recv: player move ${currentPlayer.roomName}`,
    );
    socket.broadcast
      .to(currentPlayer.roomName)
      .emit("player move", currentPlayer);
  });

  socket.on("disconnect", () => {
    console.log(`${currentPlayer.name} recv: disconnect ${currentPlayer.name}`);
    socket.broadcast
      .to(currentPlayer.roomName)
      .emit("other player disconnected", currentPlayer);
    console.log(
      `${currentPlayer.name} bcst: other player disconnected ${JSON.stringify(
        currentPlayer,
      )}`,
    );

    for (let i = 0; i < rooms.length; i++) {
      if (rooms[i].name === currentPlayer.roomName) {
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
          socket.broadcast
            .to(currentPlayer.roomName)
            .emit("owner disconnected", rooms[i].clients[0]);
        }
      }
    }
    socket.leave(currentPlayer.roomName);
  });
});

console.log("----server is running...");
