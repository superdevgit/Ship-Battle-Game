////////////////////////////////////////////////////////////////////////////////
//                            Pirate Ship Battles                             //
//                                                                            //
//                               Client - Main                                //
////////////////////////////////////////////////////////////////////////////////

let gameProperties = {
  gameWidth: 2000,
  gameHeight: 2000,
  inGame: false,
}

let background = [];
const BG_MARGIN = 700;
const TILE_H = 144;
const TILE_W = 328;
let countExplosion = 0;
let signalExplosion = 1;

////////////////////////////////////////////////////////////////////////////////
// Safe Zone Shader                                                           //
////////////////////////////////////////////////////////////////////////////////
var CustomPipeline2 = new Phaser.Class({
  Extends: Phaser.Renderer.WebGL.Pipelines.TextureTintPipeline,

  initialize:

  function CustomPipeline2 (game) {
    Phaser.Renderer.WebGL.Pipelines.TextureTintPipeline.call(this, {
      game: game,
      renderer: game.renderer,
      fragShader: `
      precision mediump float;

      uniform sampler2D uMainSampler;

      uniform vec2 viewport;
      uniform vec2 ellipse_pos;
      uniform vec2 ellipse_size;

      varying vec2 outTexCoord;
      varying vec4 outTint;

      void main() {
  	    vec2 pos = gl_FragCoord.xy;
        vec2 world_pos = vec2(viewport.x + pos.x, viewport.y - pos.y);
        float k = pow((world_pos.x-ellipse_pos.x)/ellipse_size.x, 2.0) + pow((world_pos.y-ellipse_pos.y)/ellipse_size.y, 2.0);
        gl_FragColor = texture2D(uMainSampler, outTexCoord);
        if (k > 1.0) {
          gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.216 * gl_FragColor.r + 0.7152 * gl_FragColor.g + 0.0722 * gl_FragColor.b), 1.0);
        }
       }
      `
    });
  }
});

////////////////////////////////////////////////////////////////////////////////
function onSocketConnected (data) {
  console.log("connected to server");
  if (!gameProperties.inGame) {
    socket.emit('new_player', {username: data.username});
    gameProperties.inGame = true;
  }
}

////////////////////////////////////////////////////////////////////////////////
function onRemovePlayer (data) {
	if (data.id in enemies) {
		var removePlayer = enemies[data.id];
		removePlayer.destroy();
		delete enemies[data.id];
		return;
	}
	if (data.id == socket.id) {
    resetObjects();
    this.disableInputs();
    game.scene.stop('Main');
		game.scene.start('Login');
		return;
	}
	console.log('Player not found: ', data.id);
}

////////////////////////////////////////////////////////////////////////////////
function resetObjects () {
  enemies = {};
  hud = null;
  player = null;
  boxList = {};
  bulletList = {};
  islandList = {};
  stoneList = {};
  background = [];
}

////////////////////////////////////////////////////////////////////////////////
/**
 * Process data received from the server
 * @param {{playerList: {}, bulletList: {}}} data
 */
function onUpdate (data) {
	for (const k in data.playerList) {
		if (k in enemies)
			enemies[k].update(data.playerList[k]);
		else if (player)
			player.update(data.playerList[k]);
	}
	for (const bk in data.bulletList) {
    if (bk in data.bulletList)
      bulletList[bk].update(data.bulletList[bk]);
  }
  scoreBoard = data.score_board;
}

////////////////////////////////////////////////////////////////////////////////
// Main                                                                       //
////////////////////////////////////////////////////////////////////////////////
class Main extends Phaser.Scene {
  constructor () {
    super({key: "Main"});
    // Everything here will execute just once per client session
    socket.on('enter_game', onSocketConnected);
    socket.on("create_player", createPlayer.bind(this));
    socket.on("new_enemyPlayer", createEnemy.bind(this));
    socket.on('remove_player', onRemovePlayer.bind(this));
    socket.on('item_remove', onItemRemove);
    socket.on('item_create', onCreateItem.bind(this));
    socket.on('stone_create', onCreateStone.bind(this));
    socket.on('island_create', onCreateIsland.bind(this));
    socket.on('bullet_remove', onBulletRemove);
    socket.on('bullet_create', onCreateBullet.bind(this));
    socket.on('enable_inputs', this.enableInputs.bind(this));
    socket.on('disable_inputs', this.disableInputs.bind(this));
    socket.on('update_game', onUpdate);

    this.customPipeline = null;
    this.player_life = 3; // Player life to make the screen blink when it takes damage.
    this.blink_timer = 2;
    this.mobileMode = (isTouchDevice() || mobilecheckbox.checked);
  }

  //////////////////////////////////////////////////////////////////////////////
  preload () {
    this.load.spritesheet("ship", "client/assets/ship.png", {frameWidth: 112, frameHeight: 96});
    this.load.spritesheet("bullet_fill", "client/assets/bullet_fill_anim.png", {frameWidth: 24, frameHeight: 24});
    this.load.image("ship_up", "client/assets/up_ship.png");
    this.load.image("bullet", "client/assets/cannon_ball.png");
    this.load.image("big_bullet", "client/assets/big_bullet.png");
    this.load.image("heart", "client/assets/heart.png");
    this.load.image("bullet_shadow", "client/assets/bullet_shadow.png");
    this.load.image("barrel", "client/assets/barrel.png");
    this.load.image("island", "client/assets/island.png");
    this.load.image("stone", "client/assets/stone.png");
    this.load.image("enemy", "client/assets/enemy.png");
    this.load.atlas('ocean', 'client/assets/Animations/ocean.png', 'client/assets/Animations/ocean.json');
    this.load.image('base_controller', 'client/assets/base_controller.png');
    this.load.image('top_controller', 'client/assets/top_controller.png');
    this.load.image('shot_controller', 'client/assets/shot_controller.png');
    this.load.image('explosion', 'client/assets/explosion.png');
  }

  //////////////////////////////////////////////////////////////////////////////
  create (username) {
    let camera = this.cameras.main;

    console.log("client started");

    socket.emit('logged_in', {username: username});
    this.player_life = 3;
    this.blink_timer = 2;

    // Set camera limits
    camera.setBounds(0, 0, gameProperties.gameWidth, gameProperties.gameHeight);

    // Rectangle that bounds the camera
    this.screenRect = {
      x: camera.width/2,
      y: camera.height/2,
      w: gameProperties.gameWidth - camera.width,
      h: gameProperties.gameHeight - camera.height
    };

    // Get listeners for keys
    this.key_W = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.key_A = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.key_S = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.key_D = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.key_J = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.J);
    this.key_K = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.K);

    // Add second pointer for mobile
    if (mobileMode)
      this.input.addPointer(1);

    // Create background animation
    let frameNames = this.anims.generateFrameNames('ocean', {
      start: 1, end: 21, zeroPad: 2,
      prefix: 'ocean', suffix: '.png'
    });
    this.anims.create({key: 'ocean', frames: frameNames, frameRate: 10, repeat: -1});

    // Create background tiles
    this.heightTiles = Math.ceil((camera.height + 2*BG_MARGIN)/TILE_H);
    this.widthTiles = Math.ceil((camera.width + 2*BG_MARGIN)/TILE_W);
    for (let i = 0; i < this.widthTiles; i++) {
      for (let j = 0; j < this.heightTiles; j++) {
        let tmp = this.add.sprite(TILE_W*i, TILE_H*j, 'ocean');
        tmp.anims.play('ocean');
        background.push(tmp);
      }
    }

    let safe_zone = this.add.graphics();
    let color = 0xff0000;
    let thickness = 4;
    let alpha = 1;
    let smoothness = 64;
    safe_zone.lineStyle(thickness, color, alpha);
    let a = new Phaser.Geom.Point(1000, toIsometric(1000));
    safe_zone.strokeEllipse(a.x, a.y, 1000*2, toIsometric(1000)*2, smoothness);

    // Add Safe Zone shader to the game camera
    if (this.customPipeline == null) {
      this.customPipeline = this.game.renderer.addPipeline('Custom', new CustomPipeline2(this.game));
    }
    this.cameras.main.setRenderToTexture(this.customPipeline);
    this.customPipeline.setFloat2('viewport', camera.midPoint.x - camera.width/2, camera.midPoint.y - camera.height/2);
    this.customPipeline.setFloat2('ellipse_pos', 1000, toIsometric(1000));
    this.customPipeline.setFloat2('ellipse_size', 1000, toIsometric(1000));

    // Mini Map
    if (!this.mobileMode) {
      this.minimap = this.cameras.add(camera.width-200, 0, 200, 200).setZoom(0.2).setName('mini');
      this.minimap.setBackgroundColor(0x000000);
      this.minimap.scrollX = 0;
      this.minimap.scrollY = 0;
      var border = new Phaser.Geom.Rectangle(camera.width-201, 0, 201, 201);
      var border_graphics = this.add.graphics({ fillStyle: { color: 0x000000 } });
      border_graphics.fillRectShape(border);
      border_graphics.setScrollFactor(0);
    }
    this.explosion = this.add.sprite(100, 100, 'explosion').setDepth(5100);
  }

  //////////////////////////////////////////////////////////////////////////////
  update (dt) {
    if (gameProperties.inGame) {
      this.customPipeline.setFloat2('viewport', this.cameras.main.midPoint.x - this.cameras.main.width/2, this.cameras.main.midPoint.y + this.cameras.main.height/2);

      if (hud) {
        // Update inputs
        if (!this.mobileMode) {
          this.minimap.ignore(hud.getGameObjects());
        }
        let jsFeat = hud.getJSFeatures();
        let data = {
          up: (this.key_W.isDown || jsFeat[0]),
          left: (this.key_A.isDown || jsFeat[1]),
          right: (this.key_D.isDown || jsFeat[2]),
          shootLeft: (this.key_J.isDown || jsFeat[3]),
          shootRight: (this.key_K.isDown || jsFeat[4])
        }
        socket.emit('input_fired', data);
      }

      // Update some objects
      for (const k in enemies) {
        enemies[k].updatePredictive(dt);
      }
      if (player) {
        player.updatePredictive(dt);
        hud.update();
      }
    }
    if (player) {
      // Scroll camera to player's position (Phaser is a little buggy when doing this)
      this.cameras.main.setScroll(player.body.x, player.body.y);

      // Wrap background tiles
      let cameraPos = clampRect(player.body.x, player.body.y, this.screenRect);
      let cameraCornerX = cameraPos[0] - this.cameras.main.width/2 - BG_MARGIN;
      let cameraCornerY = cameraPos[1] - this.cameras.main.height/2 - BG_MARGIN;
      for (let tile of background) {
        if (tile.x < cameraCornerX - TILE_W)
          tile.x += this.widthTiles*TILE_W;
        else if (tile.x > cameraCornerX + this.widthTiles*TILE_W)
          tile.x -= this.widthTiles*TILE_W;
        else if (tile.y < cameraCornerY - TILE_H)
          tile.y += this.heightTiles*TILE_H;
        else if (tile.y > cameraCornerY + this.heightTiles*TILE_H)
          tile.y -= this.heightTiles*TILE_H;
      }

      // Make screen blink if player takes damage
      if (player.life < this.player_life) {
        if (this.blink_timer > 0) {
          this.blink_timer -= 0.05;
          this.explosion.x = player.body.x;
          this.explosion.y = player.body.y;
          if (signalExplosion == 1) {
            countExplosion += 0.05;
          } else {
            countExplosion -= 0.05;
          }
          if (countExplosion > 1) {
            signalExplosion = -1;
          } else if (countExplosion < 0) {
            signalExplosion = 1;
          }
          this.explosion.alpha = countExplosion;
          //this.customPipeline.setInt1('is_blinking', 1);
        }
        else {
          //this.customPipeline.setInt1('is_blinking', 0);
          this.blink_timer = 2;
          this.player_life = player.life;
        }
      }

      // Mini Map
      if (!this.mobileMode) {
        this.minimap.scrollX = player.body.x;
        this.minimap.scrollY = player.body.y;
      }
    }
  }

  //////////////////////////////////////////////////////////////////////////////
  enableInputs () {
    this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.J);
    this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.K);
  }

  disableInputs () {
    if (player) {
      player.inputs.up = false;
    }
    this.input.keyboard.removeKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.input.keyboard.removeKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.input.keyboard.removeKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.input.keyboard.removeKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.input.keyboard.removeKey(Phaser.Input.Keyboard.KeyCodes.J);
    this.input.keyboard.removeKey(Phaser.Input.Keyboard.KeyCodes.K);
  }
}

////////////////////////////////////////////////////////////////////////////////
