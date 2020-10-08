const app = require("express")();
const server = require("http").Server(app);
const io = require("socket.io")(server);
const onConnect = require("./onConnect");
const roomUtil = require("./roomUtil");
const minigame = require("./minigame");

server.listen(3000);

// global variables for the Server
const rooms = [];
let playerSpawnPoints = [];

app.get("/", (req, res) => {
  res.send('hey you got back get "/"');
});

io.on("connection", (socket) => {
  let currentPlayer = {};
  currentPlayer.name = "unknown";
  onConnect(socket, currentPlayer, playerSpawnPoints, rooms);
  minigame(socket, io, rooms, currentPlayer);
  roomUtil(socket, currentPlayer, rooms);
});

console.log("----server is running...");
