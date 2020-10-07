var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);

server.listen(3000);

// global variables for the Server
var rooms = [];
var playerSpawnPoints = [];

function create_UUID(){
  var dt = new Date().getTime();
  var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = (dt + Math.random()*16)%16 | 0;
      dt = Math.floor(dt/16);
      return (c=='x' ? r :(r&0x3|0x8)).toString(16);
  });
  return uuid;
}

app.get('/', function(req, res) {
  res.send('hey you got back get "/"');
});

io.on('connection', function(socket) {

  var currentPlayer = {};
  currentPlayer.name = 'unknown';

  socket.on('play', function(data) {
    console.log(currentPlayer.name+' recv: play: '+JSON.stringify(data));
    
    if (rooms.length == 0) {
      playerSpawnPoints = [];
      data.playerSpawnPoints.forEach(function(_playerSpawnPoint) {
        var playerSpawnPoint = {
          position: _playerSpawnPoint.position
        };
        playerSpawnPoints.push(playerSpawnPoint);
      });
    }

    roomFound = false;
    index = 0;
    for (var i = 0; i<rooms.length;i++) {
      if (rooms[i].roomID == data.roomID) {
        roomFound = true;
        index = i;
        break;
      }
    }

    if (!roomFound) {
      clients = [];
      currentPlayer = {
        name:data.name,
        roomID:create_UUID(),
        isOwner:data.isOwner,
        position: playerSpawnPoints[0].position
      };
      clients.push(currentPlayer)
      var currentRoom =  {
        roomID:currentPlayer.roomID,
        roomName:data.roomName,
        roomCapacity:data.capacity,
        roomOwner:data.name,
        noOfClients:clients.length,
        minigameSelected:data.minigameSelected,
        difficultySelected:data.difficultySelected,
        //more to be added like minigame selected
        clients:clients
      }
      rooms.push(currentRoom);
      socket.join(currentPlayer.roomID);
      console.log(currentPlayer.name+' emit: play: '+JSON.stringify(currentPlayer));
      socket.emit('play', currentPlayer);
    }

    else if (rooms[index].roomCapacity <= rooms[index].clients.length) {
      console.log("Room "+data.roomName+" is full");
      socket.emit('room is full', data);
    }

    else {
      currentPlayer = {
        name:data.name,
        roomID:data.roomID,
        isOwner:data.isOwner,
        position: playerSpawnPoints[rooms[index].clients.length].position
      };
      rooms[index].clients.push(currentPlayer);
      rooms[index].noOfClients += 1;
      // in your current game, tell you that you have joined
      console.log(currentPlayer.name+' emit: play: '+JSON.stringify(currentPlayer));
      socket.emit('play', currentPlayer);
      // in your current game, we need to tell the other player except you
      socket.broadcast.to(data.roomID).emit('other player connected', currentPlayer);
    }
  });

  // below function can combine with socket.on('play'); (can help me @kane)
  socket.on('player connect', function(data) {
    console.log(currentPlayer.name+ ' recv: player connect');
    for (var i = 0; i<rooms.length;i++) {
      if (rooms[i].roomID == data.roomID) {
        console.log()
        if (rooms[i].roomCapacity > rooms[i].clients.length) {
          for (var j = 0;j<rooms[i].clients.length;j++) {
            
            var playerConnected = {}
            playerConnected = {
              name:rooms[i].clients[j].name,
              roomID:rooms[i].clients[j].roomID,
              isOwner:rooms[i].clients[j].isOwner,
              position:rooms[i].clients[j].position

            };
            console.log(playerConnected);
            // in your current game, we need to tell u about the other player
            socket.join(data.roomID);
            socket.emit('other player connected', playerConnected);
            console.log(currentPlayer.name+' emit: other player connected: '+JSON.stringify(playerConnected));
          }
        }
        else {
          console.log("Room "+data.roomName + " is full");
          socket.emit('room is full', data);
        }
      }
    } 
  });

  socket.on('minigame start', function(data) {
    console.log('recv: minigame start '+JSON.stringify(data));
    socket.broadcast.to(currentPlayer.roomID).emit('minigame start', data);
  });
  
  socket.on('minigame connect', function(data) {
    console.log(currentPlayer.name+ ' recv: minigame connect');
    for (var i = 0; i<rooms.length;i++) {
      if (rooms[i].roomID == data.roomID) {
        console.log()
        for (var j = 0;j<rooms[i].clients.length;j++) {
          if (rooms[i].clients[j].name != data.name) {
            
            var playerConnected = {}
            playerConnected = {
              name:rooms[i].clients[j].name,
              roomID:rooms[i].clients[j].roomID,
              isOwner:rooms[i].clients[j].isOwner,
              position:rooms[i].clients[j].position

            };
            console.log(playerConnected);
            // in your current game, we need to tell u about the other player
            socket.emit('other player connected minigame', playerConnected);
            console.log(currentPlayer.name+' emit: other player connected minigame: '+JSON.stringify(playerConnected));
          }
        }
      }
    } 
  });

  socket.on('end turn', function(data) {
    console.log(currentPlayer.name+ ' recv: end turn');
    for (var i = 0; i<rooms.length;i++) {
      if (rooms[i].roomID == data.roomID) {
        console.log()
        for (var j = 0;j<rooms[i].clients.length;j++) {
          if (rooms[i].clients[j].name == data.name) {
            var index = 0;
            if (j < clients.length - 1) { index = j+1; }
            var playerConnected = {}
            playerConnected = {
              name:rooms[i].clients[index].name,
              roomID:rooms[i].clients[index].roomID,
              isOwner:rooms[i].clients[index].isOwner,
              position:rooms[i].clients[index].position

            };
            console.log(playerConnected);
          }
        }
      }
    }
    socket.broadcast.to(currentPlayer.roomID).emit('next player', playerConnected);
    console.log(currentPlayer.name+' emit: next player: '+JSON.stringify(playerConnected));
  });

  socket.on('player move', function(data) {
    console.log('recv: move '+JSON.stringify(data));
    currentPlayer.position = data.position;
    console.log(currentPlayer.name+' recv: player move '+currentPlayer.roomID);
    socket.broadcast.to(currentPlayer.roomID).emit('player move', currentPlayer);
  });

  socket.on('disconnect', function(reason) {
    console.log(currentPlayer.name+' recv: disconnect '+currentPlayer.name);
    socket.broadcast.to(currentPlayer.roomID).emit('other player disconnected', currentPlayer);
    console.log(currentPlayer.name+' bcst: other player disconnected '+JSON.stringify(currentPlayer));
    console.log("reason: " + reason);
    for (var i = 0; i<rooms.length;i++) {
      if (rooms[i].roomID == currentPlayer.roomID) {
        for (var j = 0;j<rooms[i].clients.length;j++) {
          if (rooms[i].clients[j].name == currentPlayer.name) {
            rooms[i].clients.splice(j,1);
            rooms[i].noOfClients -= 1;
          }
        }
        if (rooms[i].clients.length == 0) {
          rooms.splice(i,1);
        }
        else if (currentPlayer.isOwner) {
          rooms[i].clients[0].isOwner = true;
          rooms[i].roomOwner = rooms[i].clients[0].name;
          socket.broadcast.to(currentPlayer.roomID).emit('owner disconnected', rooms[i].clients[0]);
        }
      }
    }
    socket.leave(currentPlayer.roomID);
  });

  socket.on('get rooms', function() {
    var allRooms = []
    for (var i = 0; i<rooms.length;i++) {
      var room = {
        roomID:rooms[i].roomID,
        roomName:rooms[i].roomName,
        roomOwner:rooms[i].roomOwner,
        noOfClients:rooms[i].noOfClients,
        roomCapacity:rooms[i].roomCapacity,
        minigameSelected:rooms[i].minigameSelected,
        difficultySelected:rooms[i].difficultySelected
      };
      allRooms.push(room);
    }
    var roomsData = {
      rooms:allRooms
    };
    socket.emit('get rooms', roomsData);

  });

});

console.log('----server is running...');
