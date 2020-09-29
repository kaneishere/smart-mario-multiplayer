const { stringify } = require("querystring");

// const app = require("express")();
const PORT = 3000;
const server = require("http").createServer();
const io = require("socket.io").listen(PORT);

// front end
// client
// {
//   "username": String,
//   "isRoomOwner": Boolean,
//   "roomId": Number,
//   "position": JSON,
// }

// position
// {
//   "positions": Array<Float>
// }

// room
// {
//   "roomId": Number,
//   "capacity": Number,
//   "owner": String,
//   "clients": Array<String>
// }

// global variables for the Server
let playerSpawnPoints = [];
const clients = {};
const rooms = {};

// app.get("/", (req, res) => {
//   res.send('hey you got back get "/"');
// });

io.on("connection", (socket) => {
  console.log("connected");
  // let currentPlayer = {};
  // currentPlayer.name = "unknown";

  socket.on("player connect", (client) => {
    console.log(client);
    if (!(client.username in clients)) {
      clients[client.username] = { ...client };
    }
    console.log(clients);

    // for (let i = 0; i < clients.length; i++) {
    //   const playerConnected = {
    //     name: clients[i].name,
    //     position: clients[i].position,
    //   };
    //   // in your current game, we need to tell u about the other player
    //   socket.emit("other player connected", playerConnected);
    //   console.log(
    //     `${currentPlayer.name} emit: other player connected: ${JSON.stringify(
    //       playerConnected,
    //     )}`,
    //   );
    // }
    io.emit("new player connected", client);
  });

  socket.on("play", (data) => {
    console.log(`${currentPlayer.name} recv: play: ${JSON.stringify(data)}`);
    // if this is the first person to join the room
    if (clients.length === 0) {
      playerSpawnPoints = [];
      data.playerSpawnPoints.forEach((_playerSpawnPoint) => {
        const playerSpawnPoint = {
          position: _playerSpawnPoint.position,
        };
        playerSpawnPoints.push(playerSpawnPoint);
      });
    }
    const randomSpawnPoint =
      playerSpawnPoints[Math.floor(Math.random() * playerSpawnPoints.length)];
    const currentPlayer = {
      name: data.name,
      position: randomSpawnPoint.position,
    };
    clients.push(currentPlayer);

    clients[data.name].console // in your current game, tell you that you have joined
      .log(
        `${currentPlayer.name} emit: play: ${JSON.stringify(currentPlayer)}`,
      );
    socket.emit("play", currentPlayer);
    // in your current game, we need to tell the other player except you
    socket.broadcast.emit("other player connected", currentPlayer);
  });

  socket.on("player move", (data) => {
    console.log(data);
    console.log(`recv: move ${JSON.stringify(data)}`);
    clients[data.name].position = data.position;
    socket.broadcast.emit("player move", clients[data.username]);
  });

  socket.on("disconnect", () => {
    console.log(`${currentPlayer.name} recv: disconnect ${currentPlayer.name}`);
    socket.broadcast.emit("other player disconnected", currentPlayer);
    console.log(
      `${currentPlayer.name} bcst: other player disconnected ${JSON.stringify(
        currentPlayer,
      )}`,
    );
    for (let i = 0; i < clients.length; i++) {
      if (clients[i].name === currentPlayer.name) {
        clients.splice(i, 1);
      }
    }
  });
});

console.log(server);
console.log(io.origins());

console.log("----server is running...");
