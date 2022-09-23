////////////////////////////////////////////////////////////////////////////////
//                            Pirate Ship Battles                             //
//                                                                            //
//                               Server - Room                                //
////////////////////////////////////////////////////////////////////////////////

const express = require('express');
const unique = require('node-uuid');
const SAT = require('sat');
const Player = require('./objects/player.js');
const Box = require('./objects/box.js');
const DeathCircle = require('./objects/death_circle.js');

let app = express();
let serv = require('http').Server(app);

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});
app.use('/client', express.static(__dirname + '/client'));

serv.listen({
  host: '0.0.0.0',
  port: 2000,
  exclusive: true
});

console.log("Server started.");

const UPDATE_TIME = 0.06; // sec
const BULLET_LIFETIME = 1000; // ms

setInterval(updateGame, 1000 * UPDATE_TIME);

////////////////////////////////////////////////////////////////////////////////
// Room                                                                       //
////////////////////////////////////////////////////////////////////////////////
module.exports = class Room {
  constructor (type, max_players, canvasHeight=2000, canvasWidth=2000, delta=1, mod=120) {
    // List of players in the game
    this.playerList = {};
    /** @type Bullet{}*/
    this.bulletList = {};
    // boxes object list
    this.boxList = {};
    // The max number of pickable boxes in the game
    this.boxesMax = 15;
    // Size of the boxes list
    this.numOfBoxes = 0;
    // Game height
    this.canvasHeight = canvasHeight;
    // Game width
    this.canvasWidth = canvasWidth;
    // Advances by one each game update cycle (related to player invulnerability)
    this.delta = delta;
    // Arbitrary integer variable, used to define invulnerability time
    this.mod = mod;
    // Game type: Battle Royale or Score Match
    this.type = type;
    //score board here.
    this.circle = new DeathCircle(1000, 1000, 1000);
  }

  //////////////////////////////////////////////////////////////////////////////
  updateGame () {
    // Update players
    for (let k in this.playerList) {
      if (!(k in this.playerList))
        continue;
      let p = this.playerList[k];
      p.updatePos(UPDATE_TIME);

      if (p.inputs.shootLeft && !p.leftHoldStart && p.canShoot(false))
        p.leftHoldStart = Date.now();
      if (p.inputs.shootRight && !p.rightHoldStart && p.canShoot(true))
        p.rightHoldStart = Date.now();

      if (!p.inputs.shootLeft && p.leftHoldStart) {
        let newBullets = p.tryToShoot(false);
        for (const b of newBullets) {
          this.bulletList[b.id] = b;
          io.in('game').emit("bullet_create", b);
        }
        p.leftHoldStart = 0;
      }
      if (!p.inputs.shootRight && p.rightHoldStart) {
        let newBullets = p.tryToShoot(true);
        for (const b of newBullets) {
          this.bulletList[b.id] = b;
          io.in('game').emit("bullet_create", b);
        }
        p.rightHoldStart = 0;
      }
      //checking if outside safe-zone
      if (!circle.in_circle(p)) {
        p.takeDamage(this.delta, this.mod);
        if (p.life <= 0) {
          playerKilled(p);
        }
      }
    }

    // Update bullets
    for (const kb in this.bulletList) {
        if (!(kb in this.bulletList))
          continue;
        let bullet = this.bulletList[kb];
        bullet.updatePos(UPDATE_TIME);

        //if (Date.now() > bullet.timeCreated + BULLET_LIFETIME) {
        if (bullet.z <= 0) {
          delete this.bulletList[bullet.id];
          io.in('game').emit('bullet_remove', bullet);
        }
    }

    // Do collisions
    for (const k1 in this.playerList) {
      let p1 = this.playerList[k1];
      for (const k2 in this.playerList) {
        p2 = this.playerList[k2];
        if (p2.id < p1.id)
          collidePlayers(p1, p2);
      }
      for (const kb in this.boxList)
        collidePlayerAndBox(p1, this.boxList[kb]);

      for (const kb in this.bulletList)
        collidePlayerAndBullet(p1, this.bulletList[kb]);
    }

    io.in('game').emit("update_game", {playerList: this.playerList, bulletList: this.bulletList});
  }

  //////////////////////////////////////////////////////////////////////////////
  // Create the pickable boxes there are missing at the game
  function addBox () {
    let n = game.boxesMax - game.numOfBoxes;
    for (let i = 0; i < n; i++) {
      let boxentity = new Box(game.canvasWidth, game.canvasHeight, 'box');
        game.boxList[boxentity.id] = boxentity;
        io.in('game').emit("item_create", boxentity);
        game.numOfBoxes++;
    }
  }

  //////////////////////////////////////////////////////////////////////////////
  // Called after the player entered its name
  function onEntername (data) {
    console.log(`Received joinning request from ${this.id}, size: ${data.config.width}:${data.config.height}`);
    if (data.username.length > 0 && data.username.length < 15)
      this.emit('join_game', {username: data.username, id: this.id});
    else if (data.username.length <= 0)
      this.emit('throw_error', {message: "Name can't be null"});
    else if (data.username.length >= 15)
      this.emit('throw_error', {message: "Name is too long"});
  }

  //////////////////////////////////////////////////////////////////////////////
  function distSq (p1, p2) {
    let xdiff = p1.x - p2.x;
    let ydiff = p1.y - p2.y;
    return xdiff*xdiff + ydiff*ydiff;
  }

  //////////////////////////////////////////////////////////////////////////////
  function mapFloatToInt (v, fmin, fmax, imin, imax) {
    return Math.floor((v - fmin)*(imax - imin)/(fmax - fmin) + imin);
  }

  //////////////////////////////////////////////////////////////////////////////
  function colliding (newPlayer) {
    let minDist = 130*130;
    for (const k in game.playerList) {
      if (distSq(newPlayer, game.playerList[k]) < minDist)
        return true;
    }
    return false;
  }

  //////////////////////////////////////////////////////////////////////////////
  // Called when a new player connects to the server
  function onNewPlayer (data) {
    if (this.id in game.playerList) {
      console.log(`Player with id ${this.id} already exists`);
      return;
    }
    let newPlayer = new Player(mapFloatToInt(Math.random(), 0, 1, 250, game.canvasWidth - 250),
                               mapFloatToInt(Math.random(), 0, 1, 250, game.canvasHeight - 250),
                               Math.PI / 2, this.id, data.username);

    while (colliding(newPlayer) && !circle.in_circle(newPlayer)) {
      newPlayer.setPos(mapFloatToInt(Math.random(), 0, 1, 250, game.canvasWidth - 250),
                       mapFloatToInt(Math.random(), 0, 1, 250, gane.canvasHeight - 250));
    }
    console.log("Created new player with id " + this.id);

    this.emit('create_player', data);

    let current_info = {
      id: newPlayer.id,
      x: newPlayer.x,
      y: newPlayer.y,
      angle: newPlayer.angle,
      username: newPlayer.username,
      anchored_timer: newPlayer.anchored_timer
    };

    for (let k in game.playerList) {
      existingPlayer = game.playerList[k];
      let player_info = {
        id: existingPlayer.id,
        username: existingPlayer.username,
        x: existingPlayer.x,
        y: existingPlayer.y,
        angle: existingPlayer.angle,
      };
      this.emit("new_enemyPlayer", player_info);
    }

    game.playerList[this.id] = newPlayer;

    for (let k in game.boxList)
      this.emit('item_create', game.boxList[k]);

    for (let k in game.bulletList)
      this.emit('bullet_create', game.bulletList[k]);

    //send message to every connected client except the sender
    this.broadcast.emit('new_enemyPlayer', current_info);
  }

  //////////////////////////////////////////////////////////////////////////////
  // Called when someone fired an input
  function onInputFired (data) {
    let movePlayer = game.playerList[this.id];

    if (!(this.id in game.playerList) || game.playerList[this.id].dead)
      return;

    movePlayer.inputs.up = data.up;
    movePlayer.inputs.left = data.left;
    movePlayer.inputs.right = data.right;
    movePlayer.inputs.shootLeft = data.shootLeft;
    movePlayer.inputs.shootRight = data.shootRight;
  }

  //////////////////////////////////////////////////////////////////////////////
  // Called to verify if two players collide
  function collidePlayers (p1, p2) {
    if (!(p2.id in game.playerList) || !(p1.id in game.playerList)
        || p1.dead || p2.dead)
      return;
    if (SAT.testPolygonPolygon(p1.poly, p2.poly)) {
      if (SAT.testPolygonPolygon(p1.prowLine, p2.poly)) {
        if (SAT.testPolygonPolygon(p1.poly, p2.prowLine)) {
          playerKilled(p1);
          playerKilled(p2);
        } else {
          playerKilled(p2);
        }
      } else if (SAT.testPolygonPolygon(p1.poly, p2.prowLine)) {
        playerKilled(p1);
      } else if (SAT.testPolygonPolygon(p1.middleLine, p2.poly)) {
        if (SAT.testPolygonPolygon(p1.poly, p2.middleLine)) {
          playerKilled(p1);
          playerKilled(p2);
        }
        else {
          playerKilled(p2);
        }
      } else if (SAT.testPolygonPolygon(p1.poly, p2.middleLine)) {
        playerKilled(p1);
      } else {
        console.log("Could not threat the collision D:");
      }
    }
  }

  //////////////////////////////////////////////////////////////////////////////
  // Called to verify if an item is picked
  function collidePlayerAndBox (p1, bx) {
      if (!(p1.id in game.playerList) || !(bx.id in game.boxList))
        return;

      if (SAT.testPolygonCircle(p1.poly, bx.poly)) {
        p1.bullets += bx.bullets;

        console.log(`Box with ${bx.bullets} bullets picked`);
        delete game.boxList[bx.id];
        game.numOfBoxes--;

        io.in('game').emit('item_remove', bx);

        addBox();
      }
  }

  //////////////////////////////////////////////////////////////////////////////
  // Called to verify if a bullet collide with a player
  function collidePlayerAndBullet (p1, bullet) {
      if (!(p1.id in game.playerList) || !(bullet.id in game.bulletList) || bullet.creator == p1.id)
        return;

      if (SAT.testPolygonCircle(p1.poly, bullet.poly)) {
        delete game.bulletList[bullet.id];
        io.in('game').emit('bullet_remove', bullet);
        console.log(`Bullet hit ${p1.username}`);
        p1.life--;
        if (p1.life <= 0)
          playerKilled(p1);
      }
  }

  //////////////////////////////////////////////////////////////////////////////
  // Called when a someone dies
  function playerKilled (player) {
    console.log(`${player.username} died!`);
    if (player.id in game.playerList) {
      console.log(`${player.username} was removed`);
      delete game.playerList[player.id];
      io.in('game').emit('remove_player', player);
      io.sockets.sockets[player.id].leave('game');
      io.sockets.sockets[player.id].join('login');
    }

    player.dead = true;
  }

  //////////////////////////////////////////////////////////////////////////////
  // Called when a client disconnects to tell the  clients,  except  sender,  to
  // remove the disconnected player
  function onClientDisconnect () {
    console.log('disconnect');
    if (this.id in game.playerList)
      delete game.playerList[this.id];

    console.log("removing player " + this.id);

    this.broadcast.emit('remove_player', {id: this.id});
  }

  //////////////////////////////////////////////////////////////////////////////

  let io = require('socket.io')(serv,{});

  io.sockets.on('connection', function(socket) {
    console.log("socket connected");
    socket.join('login');
    socket.on('enter_name', onEntername);
    socket.on('logged_in', function(data) {
      this.emit('enter_game', {username: data.username});
      socket.leave('login');
      socket.join('game');
    });
    socket.on('disconnect', onClientDisconnect);
    socket.on("new_player", onNewPlayer);
    socket.on("input_fired", onInputFired);
  });

  // Prepare the boxes
  addBox();
}

//////////////////////////////////////////////////////////////////////////////
