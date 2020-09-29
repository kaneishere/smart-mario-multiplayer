const app = require("express")();
const server = require("http").Server(app);
const io = require("socket.io")(server);

server.listen(3000);

// global variables for the Server
let playerSpawnPoints = [];
const clients = [];

app.get("/", (req, res) => {
  res.send("hey you got back get \"/\"");
});

io.on("connection", function (socket) {
  let currentPlayer = {};
  currentPlayer.name = "unknown";

  socket.on("player connect", function () {
    console.log(currentPlayer.name + " recv: player connect");
    for (let i = 0; i < clients.length; i++) {
      const playerConnected = {
        name: clients[i].name,
        position: clients[i].position,
      };
      // in your current game, we need to tell u about the other player
      socket.emit("other player connected", playerConnected);
      console.log(
        currentPlayer.name
          + " emit: other player connected: "
          + JSON.stringify(playerConnected),
      );
    }
  });

  socket.on("play", function (data) {
    console.log(currentPlayer.name + " recv: play: " + JSON.stringify(data));
    //if this is the first person to join the room
    if (clients.length == 0) {
      playerSpawnPoints = [];
      data.playerSpawnPoints.forEach(function (_playerSpawnPoint) {
        const playerSpawnPoint = {
          position: _playerSpawnPoint.position,
        };
        playerSpawnPoints.push(playerSpawnPoint);
      });
    }
    const randomSpawnPoint =      playerSpawnPoints[Math.floor(Math.random() * playerSpawnPoints.length)];
    currentPlayer = {
      name: data.name,
      position: randomSpawnPoint.position,
    };
    clients.push(currentPlayer);
    // in your current game, tell you that you have joined
    console.log(
      currentPlayer.name + " emit: play: " + JSON.stringify(currentPlayer),
    );
    socket.emit("play", currentPlayer);
    // in your current game, we need to tell the other player except you
    socket.broadcast.emit("other player connected", currentPlayer);
  });

  socket.on("player move", function (data) {
    console.log("recv: move " + JSON.stringify(data));
    currentPlayer.position = data.position;
    socket.broadcast.emit("player move", currentPlayer);
  });

  socket.on("disconnect", function () {
    console.log(currentPlayer.name + " recv: disconnect " + currentPlayer.name);
    socket.broadcast.emit("other player disconnected", currentPlayer);
    console.log(
      currentPlayer.name
        + " bcst: other player disconnected "
        + JSON.stringify(currentPlayer),
    );
    for (let i = 0; i < clients.length; i++) {
      if (clients[i].name == currentPlayer.name) {
        clients.splice(i, 1);
      }
    }
  });
});

console.log("----server is running...");
