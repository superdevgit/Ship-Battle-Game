////////////////////////////////////////////////////////////////////////////////
//                            Pirate Ship Battles                             //
//                                                                            //
//                               Client - Game                                //
////////////////////////////////////////////////////////////////////////////////

var socket = io({transports: ['websocket'], upgrade: false});

var config = {
  type: Phaser.WEBGL,
  width: window.innerWidth,
  height: window.innerHeight,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: 0,
      debug: false
    }
  },
  backgroundColor: "#00BCD4",
  scene: [Login, Main]
};

var game = new Phaser.Game(config);
var mobileMode = false;

const HALF_FRAME = Math.PI/16;
const G_ACCEL = 9.8;

////////////////////////////////////////////////////////////////////////////////
