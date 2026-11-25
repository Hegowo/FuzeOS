
// Copyright 2012 Shaun Williams
//
//  This program is free software: you can redistribute it and/or modify
//  it under the terms of the GNU General Public License Version 3 as 
//  published by the Free Software Foundation.
//
//  This program is distributed in the hope that it will be useful,
//  but WITHOUT ANY WARRANTY; without even the implied warranty of
//  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//  GNU General Public License for more details.

// ==========================================================================
// PAC-MAN
// an accurate remake of the original arcade game

// Based on original works by Namco, GCC, and Midway.
// Research by Jamey Pittman and Bart Grantham
// Developed by Shaun Williams, Mason Borda

// ==========================================================================

(function(){
//  Apparently, the mutable, non-standard __proto__ property creates a lot of complexity for JS optimizers,
//   so it may be phased out in future JS versions.  It's not even supported in Internet Explorer.
//
//  Object.create does everything that I would use a mutable __proto__ for, but this isn't implemented everywhere yet.
// 
//  So instead of the following:
//
//      var obj = {
//          __proto__: parentObj,
//          hello: function() { return "world"; },
//      };
//
//  You can use this:
//
//      var obj = newChildObject(parentObj, {
//          hello: function() { return "world"; },
//      };

var newChildObject = function(parentObj, newObj) {

    // equivalent to: var resultObj = { __proto__: parentObj };
    var x = function(){};
    x.prototype = parentObj;
    var resultObj = new x();

    // store new members in resultObj
    if (newObj) {
        var hasProp = {}.hasOwnProperty;
        for (var name in newObj) {
            if (hasProp.call(newObj, name)) {
                resultObj[name] = newObj[name];
            }
        }
    }

    return resultObj;
};

var DEBUG = false;
/* Sound handlers added by Dr James Freeman who was sad such a great reverse was a silent movie  */

var audio = new preloadAudio();

function elementTrack(url, volume) {
    var audio = new Audio(url);
    if (volume) audio.volume = volume;
    audio.load();
    var looping = false;
    this.play = function(noResetTime) {
        playSound(noResetTime);
    };
    this.startLoop = function(noResetTime) {
        if (looping) return;
        audio.addEventListener('ended', audioLoop);
        audioLoop(noResetTime);
        looping = true;
    };
    this.stopLoop = function(noResetTime) {
        try{ audio.removeEventListener('ended', audioLoop) } catch (e) {};
        audio.pause();
        if (!noResetTime) audio.currentTime = 0;
        looping = false;
    };
    this.isPlaying = function() {
        return !audio.paused;
    };
    this.isPaused = function() {
        return audio.paused;
    }; 
    this.stop = this.stopLoop;

    function audioLoop(noResetTime) {
        playSound(noResetTime);
    }
    function playSound(noResetTime) {
        // for really rapid sound repeat set noResetTime
        if(!audio.paused) {
            audio.pause();
            if (!noResetTime ) audio.currentTime = 0;
        }
        try{
            var playPromise = audio.play();
            if(playPromise) {
                playPromise.then(function(){}).catch(function(err){});
            }
        } 
        catch(err){ console.error(err) }
    }
}


var contexteAudio = window.AudioContext ? new AudioContext({ latencyHint: 'interactive' }) : null;

if (contexteAudio) {
    var reveillerAudio = function() {
        if (contexteAudio.state == 'suspended') contexteAudio.resume();
    };
    window.addEventListener('keydown', reveillerAudio);
    window.addEventListener('mousedown', reveillerAudio);
    window.addEventListener('touchstart', reveillerAudio);
}

function audioTrack(url, volume) {
    if (!contexteAudio) {
        elementTrack.call(this, url, volume);
        return;
    }
    var tampon = null;
    var secours = null;
    var source = null;
    var debut = 0;
    var decalage = 0;
    var looping = false;
    var attente = null;
    var gain = contexteAudio.createGain();
    gain.gain.value = volume || 1;
    gain.connect(contexteAudio.destination);

    fetch((window.sonsIntegres && sonsIntegres[url]) || url)
        .then(function(reponse) { return reponse.arrayBuffer(); })
        .then(function(donnees) { return contexteAudio.decodeAudioData(donnees); })
        .then(function(decode) {
            tampon = decode;
            if (attente) lancer(attente.boucle, attente.noResetTime);
            attente = null;
        })
        .catch(function() {
            secours = new elementTrack(url, volume);
            if (attente) attente.boucle ? secours.startLoop(attente.noResetTime) : secours.play(attente.noResetTime);
            attente = null;
        });

    function arreter(noResetTime) {
        if (source) {
            if (noResetTime) decalage = (contexteAudio.currentTime - debut) % tampon.duration;
            source.onended = null;
            try { source.stop(); } catch (e) {}
            source = null;
        }
        if (!noResetTime) decalage = 0;
    }

    function lancer(boucle, noResetTime) {
        if (!tampon) {
            attente = { boucle: boucle, noResetTime: noResetTime };
            return;
        }
        if (source && noResetTime && !boucle) return;
        arreter(noResetTime);
        var depart = noResetTime ? decalage : 0;
        source = contexteAudio.createBufferSource();
        source.buffer = tampon;
        source.loop = boucle;
        source.connect(gain);
        source.onended = function() { source = null; };
        debut = contexteAudio.currentTime - depart;
        source.start(0, depart);
    }

    this.play = function(noResetTime) {
        if (secours) return secours.play(noResetTime);
        lancer(false, noResetTime);
    };
    this.startLoop = function(noResetTime) {
        if (secours) return secours.startLoop(noResetTime);
        if (looping) return;
        looping = true;
        lancer(true, noResetTime);
    };
    this.stopLoop = function(noResetTime) {
        if (secours) return secours.stopLoop(noResetTime);
        attente = null;
        looping = false;
        if (tampon) arreter(noResetTime);
    };
    this.isPlaying = function() {
        if (secours) return secours.isPlaying();
        return !!source;
    };
    this.isPaused = function() {
        if (secours) return secours.isPaused();
        return !source;
    };
    this.stop = this.stopLoop;
}


function preloadAudio() {

    this.credit            = new audioTrack('sounds/credit.mp3');
    this.coffeeBreakMusic  = new audioTrack('sounds/coffee-break-music.mp3');
    this.die               = new audioTrack('sounds/miss.mp3');
    this.ghostReturnToHome = new audioTrack('sounds/ghost-return-to-home.mp3');
    this.eatingGhost       = new audioTrack('sounds/eating-ghost.mp3');
    this.ghostTurnToBlue   = new audioTrack('sounds/ghost-turn-to-blue.mp3', 0.5);
    this.eatingFruit       = new audioTrack('sounds/eating-fruit.mp3');
    this.ghostSpurtMove1   = new audioTrack('sounds/ghost-spurt-move-1.mp3');
    this.ghostSpurtMove2   = new audioTrack('sounds/ghost-spurt-move-2.mp3');
    this.ghostSpurtMove3   = new audioTrack('sounds/ghost-spurt-move-3.mp3');
    this.ghostSpurtMove4   = new audioTrack('sounds/ghost-spurt-move-4.mp3');
    this.ghostNormalMove   = new audioTrack('sounds/ghost-normal-move.mp3');
    this.extend            = new audioTrack('sounds/extend.mp3');
    this.eating            = new audioTrack('sounds/eating.mp3', 0.5);
    this.startMusic        = new audioTrack('sounds/start-music.mp3');

    this.ghostReset = function(noResetTime) {
        for (var s in this) {
            if (s == 'silence' || s == 'ghostReset' ) return;
            if (s.match(/^ghost/)) this[s].stopLoop(noResetTime);
        }
    };

    this.silence = function(noResetTime) {
        for (var s in this) {
            if (s == 'silence' || s == 'ghostReset' ) return;
            this[s].stopLoop(noResetTime);
        }
    }
}

var getRandomColor = function() {
    return '#'+('00000'+(Math.random()*(1<<24)|0).toString(16)).slice(-6);
};

var getRandomInt = function(min,max) {
    return Math.floor(Math.random() * (max-min+1)) + min;
};

//////////////////////////////////////////////////////////////////////////////////////
// Game

// game modes
var GAME_PACMAN = 0;
var GAME_MSPACMAN = 1;
var GAME_COOKIE = 2;
var GAME_OTTO = 3;

var practiceMode = false;
var turboMode = false;

// current game mode
var gameMode = GAME_PACMAN;
var getGameName = (function(){

    var names = ["FUZE VS AYWEN", "MS PAC-MAN", "COOKIE-MAN","CRAZY OTTO"];
    
    return function(mode) {
        if (mode == undefined) {
            mode = gameMode;
        }
        return names[mode];
    };
})();

var getGameDescription = (function(){

    var desc = [
        [
            "ORIGINAL ARCADE:",
            "NAMCO (C) 1980",
            "",
            "REVERSE-ENGINEERING:",
            "JAMEY PITTMAN",
            "",
            "REMAKE:",
            "SHAUN WILLIAMS",
        ],
        [
            "ORIGINAL ARCADE ADDON:",
            "MIDWAY/GCC (C) 1981",
            "",
            "REVERSE-ENGINEERING:",
            "BART GRANTHAM",
            "",
            "REMAKE:",
            "SHAUN WILLIAMS",
        ],
        [
            "A NEW PAC-MAN GAME",
            "WITH RANDOM MAZES:",
            "SHAUN WILLIAMS (C) 2012",
            "",
            "COOKIE MONSTER DESIGN:",
            "JIM HENSON",
            "",
            "PAC-MAN CROSSOVER CONCEPT:",
            "TANG YONGFA",
        ],
        [
            "THE UNRELEASED",
            "MS. PAC-MAN PROTOTYPE:",
            "GCC (C) 1981",
            "",
            "SPRITES REFERENCED FROM",
            "STEVE GOLSON'S",
            "CAX 2012 PRESENTATION",
            "",
            "REMAKE:",
            "SHAUN WILLIAMS",
        ],
    ];
    
    return function(mode) {
        if (mode == undefined) {
            mode = gameMode;
        }
        return desc[mode];
    };
})();

var getGhostNames = function(mode) {
    if (mode == undefined) {
        mode = gameMode;
    }
    if (mode == GAME_OTTO) {
        return ["plato","darwin","freud","newton"];
    }
    else if (mode == GAME_MSPACMAN) {
        return ["blinky","pinky","inky","sue"];
    }
    else if (mode == GAME_PACMAN) {
        return ["blinky","pinky","inky","clyde"];
    }
    else if (mode == GAME_COOKIE) {
        return ["elmo","piggy","rosita","zoe"];
    }
};

var getGhostDrawFunc = function(mode) {
    if (mode == undefined) {
        mode = gameMode;
    }
    if (mode == GAME_OTTO) {
        return atlas.drawMonsterSprite;
    }
    else if (mode == GAME_COOKIE) {
        return atlas.drawMuppetSprite;
    }
    else {
        return atlas.drawGhostSprite;
    }
};

var getPlayerDrawFunc = function(mode) {
    if (mode == undefined) {
        mode = gameMode;
    }
    if (mode == GAME_OTTO) {
        return atlas.drawOttoSprite;
    }
    else if (mode == GAME_PACMAN) {
        return atlas.drawPacmanSprite;
    }
    else if (mode == GAME_MSPACMAN) {
        return atlas.drawMsPacmanSprite;
    }
    else if (mode == GAME_COOKIE) {
        //return atlas.drawCookiemanSprite;
        return drawCookiemanSprite;
    }
};


// for clearing, backing up, and restoring cheat states (before and after cutscenes presently)
var clearCheats, backupCheats, restoreCheats;
(function(){
    clearCheats = function() {
        pacman.invincible = false;
        pacman.ai = false;
        for (i=0; i<5; i++) {
            actors[i].isDrawPath = false;
            actors[i].isDrawTarget = false;
        }
        executive.setUpdatesPerSecond(60);
    };

    var i, invincible, ai, isDrawPath, isDrawTarget;
    isDrawPath = {};
    isDrawTarget = {};
    backupCheats = function() {
        invincible = pacman.invincible;
        ai = pacman.ai;
        for (i=0; i<5; i++) {
            isDrawPath[i] = actors[i].isDrawPath;
            isDrawTarget[i] = actors[i].isDrawTarget;
        }
    };
    restoreCheats = function() {
        pacman.invincible = invincible;
        pacman.ai = ai;
        for (i=0; i<5; i++) {
            actors[i].isDrawPath = isDrawPath[i];
            actors[i].isDrawTarget = isDrawTarget[i];
        }
    };
})();

// current level, lives, and score
var level = 1;
var extraLives = 0;

// VCR functions

var savedLevel = {};
var savedExtraLives = {};
var savedHighScore = {};
var savedScore = {};
var savedState = {};

var saveGame = function(t) {
    savedLevel[t] = level;
    savedExtraLives[t] = extraLives;
    savedHighScore[t] = getHighScore();
    savedScore[t] = getScore();
    savedState[t] = state;
};
var loadGame = function(t) {
    level = savedLevel[t];
    if (extraLives != savedExtraLives[t]) {
        extraLives = savedExtraLives[t];
        renderer.drawMap();
    }
    setHighScore(savedHighScore[t]);
    setScore(savedScore[t]);
    state = savedState[t];
};

/// SCORING
// (manages scores and high scores for each game type)

var scores = [
    0,0, // pacman
    0,0, // mspac
    0,0, // cookie
    0,0, // otto
    0 ];
var highScores = [
    10000,10000, // pacman
    10000,10000, // mspac
    10000,10000, // cookie
    10000,10000, // otto
    ];

var getScoreIndex = function() {
    if (practiceMode) {
        return 8;
    }
    return gameMode*2 + (turboMode ? 1 : 0);
};

// handle a score increment
var addScore = function(p) {

    // get current scores
    var score = getScore();

    // handle extra life at 10000 points
    if (score < 10000 && score+p >= 10000) {
        extraLives++;
        renderer.drawMap();
    }

    score += p;
    setScore(score);

    if (!practiceMode) {
        if (score > getHighScore()) {
            setHighScore(score);
        }
    }
};

var getScore = function() {
    return scores[getScoreIndex()];
};
var setScore = function(score) {
    scores[getScoreIndex()] = score;
};

var getHighScore = function() {
    return highScores[getScoreIndex()];
};
var setHighScore = function(highScore) {
    highScores[getScoreIndex()] = highScore;
    saveHighScores();
};
// High Score Persistence

var loadHighScores = function() {
    var hs;
    var hslen;
    var i;
    if (localStorage && localStorage.highScores) {
        hs = JSON.parse(localStorage.highScores);
        hslen = hs.length;
        for (i=0; i<hslen; i++) {
            highScores[i] = Math.max(highScores[i],hs[i]);
        }
    }
};
var saveHighScores = function() {
    if (localStorage) {
        localStorage.highScores = JSON.stringify(highScores);
    }
};
//////////////////////////////////////////////////////////////////////////////////////
// Directions
// (variables and utility functions for representing actor heading direction)

// direction enums (in counter-clockwise order)
// NOTE: changing the order of these enums may effect the enums.
//       I've tried abstracting away the uses by creating functions to rotate them.
// NOTE: This order determines tie-breakers in the shortest distance turn logic.
//       (i.e. higher priority turns have lower enum values)
var DIR_UP = 0;
var DIR_LEFT = 1;
var DIR_DOWN = 2;
var DIR_RIGHT = 3;

var getClockwiseAngleFromTop = function(dirEnum) {
    return -dirEnum*Math.PI/2;
};

var rotateLeft = function(dirEnum) {
    return (dirEnum+1)%4;
};

var rotateRight = function(dirEnum) {
    return (dirEnum+3)%4;
};

var rotateAboutFace = function(dirEnum) {
    return (dirEnum+2)%4;
};

// get direction enum from a direction vector
var getEnumFromDir = function(dir) {
    if (dir.x==-1) return DIR_LEFT;
    if (dir.x==1) return DIR_RIGHT;
    if (dir.y==-1) return DIR_UP;
    if (dir.y==1) return DIR_DOWN;
};

// set direction vector from a direction enum
var setDirFromEnum = function(dir,dirEnum) {
    if (dirEnum == DIR_UP)         { dir.x = 0; dir.y =-1; }
    else if (dirEnum == DIR_RIGHT)  { dir.x =1; dir.y = 0; }
    else if (dirEnum == DIR_DOWN)  { dir.x = 0; dir.y = 1; }
    else if (dirEnum == DIR_LEFT) { dir.x = -1; dir.y = 0; }
};

// return the direction of the open, surrounding tile closest to our target
var getTurnClosestToTarget = function(tile,targetTile,openTiles) {

    var dx,dy,dist;                      // variables used for euclidean distance
    var minDist = Infinity;              // variable used for finding minimum distance path
    var dir = {};
    var dirEnum = 0;
    var i;
    for (i=0; i<4; i++) {
        if (openTiles[i]) {
            setDirFromEnum(dir,i);
            dx = dir.x + tile.x - targetTile.x;
            dy = dir.y + tile.y - targetTile.y;
            dist = dx*dx+dy*dy;
            if (dist < minDist) {
                minDist = dist;
                dirEnum = i;
            }
        }
    }
    return dirEnum;
};

// retrieve four surrounding tiles and indicate whether they are open
var getOpenTiles = function(tile,dirEnum) {

    // get open passages
    var openTiles = {};
    openTiles[DIR_UP] =    map.isFloorTile(tile.x, tile.y-1);
    openTiles[DIR_RIGHT] = map.isFloorTile(tile.x+1, tile.y);
    openTiles[DIR_DOWN] =  map.isFloorTile(tile.x, tile.y+1);
    openTiles[DIR_LEFT] =  map.isFloorTile(tile.x-1, tile.y);

    var numOpenTiles = 0;
    var i;
    if (dirEnum != undefined) {

        // count number of open tiles
        for (i=0; i<4; i++)
            if (openTiles[i])
                numOpenTiles++;

        // By design, no mazes should have dead ends,
        // but allow player to turn around if and only if it's necessary.
        // Only close the passage behind the player if there are other openings.
        var oppDirEnum = rotateAboutFace(dirEnum); // current opposite direction enum
        if (numOpenTiles > 1)
            openTiles[oppDirEnum] = false;
    }

    return openTiles;
};

// returns if the given tile coordinate plus the given direction vector has a walkable floor tile
var isNextTileFloor = function(tile,dir) {
    return map.isFloorTile(tile.x+dir.x,tile.y+dir.y);
};

//////////////////////////////////////////////////////////////////////////////////////
// Map
// (an ascii map of tiles representing a level maze)

// size of a square tile in pixels
var tileSize = 8;

// the center pixel of a tile
var midTile = {x:3, y:4};

// constructor
var Map = function(numCols, numRows, tiles) {

    // sizes
    this.numCols = numCols;
    this.numRows = numRows;
    this.numTiles = numCols*numRows;
    this.widthPixels = numCols*tileSize;
    this.heightPixels = numRows*tileSize;

    // ascii map
    this.tiles = tiles;

    // ghost home location
    this.doorTile = {x:13, y:14};
    this.doorPixel = {
        x:(this.doorTile.x+1)*tileSize-1, 
        y:this.doorTile.y*tileSize + midTile.y
    };
    this.homeTopPixel = 17*tileSize;
    this.homeBottomPixel = 18*tileSize;

    this.timeEaten = {};

    this.resetCurrent();
    this.parseDots();
    this.parseTunnels();
    this.parseWalls();
};

Map.prototype.save = function(t) {
};

Map.prototype.eraseFuture = function(t) {
    // current state at t.
    // erase all states after t.
    var i;
    for (i=0; i<this.numTiles; i++) {
        if (t <= this.timeEaten[i]) {
            delete this.timeEaten[i];
        }
    }
};

Map.prototype.load = function(t,abs_t) {
    var firstTile,curTile;
    var refresh = function(i) {
        var x,y;
        x = i%this.numCols;
        y = Math.floor(i/this.numCols);
        renderer.refreshPellet(x,y);
    };
    var i;
    for (i=0; i<this.numTiles; i++) {
        firstTile = this.startTiles[i];
        if (firstTile == '.' || firstTile == 'o') {
            if (abs_t <= this.timeEaten[i]) { // dot should be present
                if (this.currentTiles[i] != firstTile) {
                    this.dotsEaten--;
                    this.currentTiles[i] = firstTile;
                    refresh.call(this,i);
                }
            }
            else if (abs_t > this.timeEaten[i]) { // dot should be missing
                if (this.currentTiles[i] != ' ') {
                    this.dotsEaten++;
                    this.currentTiles[i] = ' ';
                    refresh.call(this,i);
                }
            }
        }
    }
};

Map.prototype.resetTimeEaten = function()
{
    this.startTiles = this.currentTiles.slice(0);
    this.timeEaten = {};
};

// reset current tiles
Map.prototype.resetCurrent = function() {
    this.currentTiles = this.tiles.split(""); // create a mutable list copy of an immutable string
    this.dotsEaten = 0;
};

// This is a procedural way to generate original-looking maps from a simple ascii tile
// map without a spritesheet.
Map.prototype.parseWalls = function() {

    var that = this;

    // creates a list of drawable canvas paths to render the map walls
    this.paths = [];

    // a map of wall tiles that already belong to a built path
    var visited = {};

    // we extend the x range to suggest the continuation of the tunnels
    var toIndex = function(x,y) {
        if (x>=-2 && x<that.numCols+2 && y>=0 && y<that.numRows)
            return (x+2)+y*(that.numCols+4);
    };

    // a map of which wall tiles that are not completely surrounded by other wall tiles
    var edges = {};
    var i=0,x,y;
    for (y=0;y<this.numRows;y++) {
        for (x=-2;x<this.numCols+2;x++,i++) {
            if (this.getTile(x,y) == '|' &&
                (this.getTile(x-1,y) != '|' ||
                this.getTile(x+1,y) != '|' ||
                this.getTile(x,y-1) != '|' ||
                this.getTile(x,y+1) != '|' ||
                this.getTile(x-1,y-1) != '|' ||
                this.getTile(x-1,y+1) != '|' ||
                this.getTile(x+1,y-1) != '|' ||
                this.getTile(x+1,y+1) != '|')) {
                edges[i] = true;
            }
        }
    }

    // walks along edge wall tiles starting at the given index to build a canvas path
    var makePath = function(tx,ty) {

        // get initial direction
        var dir = {};
        var dirEnum;
        if (toIndex(tx+1,ty) in edges)
            dirEnum = DIR_RIGHT;
        else if (toIndex(tx, ty+1) in edges)
            dirEnum = DIR_DOWN;
        else
            throw "tile shouldn't be 1x1 at "+tx+","+ty;
        setDirFromEnum(dir,dirEnum);

        // increment to next tile
        tx += dir.x;
        ty += dir.y;

        // backup initial location and direction
        var init_tx = tx;
        var init_ty = ty;
        var init_dirEnum = dirEnum;

        var path = [];
        var pad; // (persists for each call to getStartPoint)
        var point;
        var lastPoint;

        var turn,turnAround;

        /*

           We employ the 'right-hand rule' by keeping our right hand in contact
           with the wall to outline an individual wall piece.

           Since we parse the tiles in row major order, we will always start
           walking along the wall at the leftmost tile of its topmost row.  We
           then proceed walking to the right.  

           When facing the direction of the walk at each tile, the outline will
           hug the left side of the tile unless there is a walkable tile to the
           left.  In that case, there will be a padding distance applied.
           
        */
        var getStartPoint = function(tx,ty,dirEnum) {
            var dir = {};
            setDirFromEnum(dir, dirEnum);
            if (!(toIndex(tx+dir.y,ty-dir.x) in edges))
                pad = that.isFloorTile(tx+dir.y,ty-dir.x) ? 5 : 0;
            var px = -tileSize/2+pad;
            var py = tileSize/2;
            var a = getClockwiseAngleFromTop(dirEnum);
            var c = Math.cos(a);
            var s = Math.sin(a);
            return {
                // the first expression is the rotated point centered at origin
                // the second expression is to translate it to the tile
                x:(px*c - py*s) + (tx+0.5)*tileSize,
                y:(px*s + py*c) + (ty+0.5)*tileSize,
            };
        };
        while (true) {
            
            visited[toIndex(tx,ty)] = true;

            // determine start point
            point = getStartPoint(tx,ty,dirEnum);

            if (turn) {
                // if we're turning into this tile, create a control point for the curve
                //
                // >---+  <- control point
                //     |
                //     V
                lastPoint = path[path.length-1];
                if (dir.x == 0) {
                    point.cx = point.x;
                    point.cy = lastPoint.y;
                }
                else {
                    point.cx = lastPoint.x;
                    point.cy = point.y;
                }
            }

            // update direction
            turn = false;
            turnAround = false;
            if (toIndex(tx+dir.y, ty-dir.x) in edges) { // turn left
                dirEnum = rotateLeft(dirEnum);
                turn = true;
            }
            else if (toIndex(tx+dir.x, ty+dir.y) in edges) { // continue straight
            }
            else if (toIndex(tx-dir.y, ty+dir.x) in edges) { // turn right
                dirEnum = rotateRight(dirEnum);
                turn = true;
            }
            else { // turn around
                dirEnum = rotateAboutFace(dirEnum);
                turnAround = true;
            }
            setDirFromEnum(dir,dirEnum);

            // commit path point
            path.push(point);

            // special case for turning around (have to connect more dots manually)
            if (turnAround) {
                path.push(getStartPoint(tx-dir.x, ty-dir.y, rotateAboutFace(dirEnum)));
                path.push(getStartPoint(tx, ty, dirEnum));
            }

            // advance to the next wall
            tx += dir.x;
            ty += dir.y;

            // exit at full cycle
            if (tx==init_tx && ty==init_ty && dirEnum == init_dirEnum) {
                that.paths.push(path);
                break;
            }
        }
    };

    // iterate through all edges, making a new path after hitting an unvisited wall edge
    i=0;
    for (y=0;y<this.numRows;y++)
        for (x=-2;x<this.numCols+2;x++,i++)
            if (i in edges && !(i in visited)) {
                visited[i] = true;
                makePath(x,y);
            }
};

// count pellets and store energizer locations
Map.prototype.parseDots = function() {

    this.numDots = 0;
    this.numEnergizers = 0;
    this.energizers = [];

    var x,y;
    var i = 0;
    var tile;
    for (y=0; y<this.numRows; y++) for (x=0; x<this.numCols; x++) {
        tile = this.tiles[i];
        if (tile == '.') {
            this.numDots++;
        }
        else if (tile == 'o') {
            this.numDots++;
            this.numEnergizers++;
            this.energizers.push({'x':x,'y':y});
        }
        i++;
    }
};

// get remaining dots left
Map.prototype.dotsLeft = function() {
    return this.numDots - this.dotsEaten;
};

// determine if all dots have been eaten
Map.prototype.allDotsEaten = function() {
    return this.dotsLeft() == 0;
};

// create a record of tunnel locations
Map.prototype.parseTunnels = (function(){
    
    // starting from x,y and increment x by dx...
    // determine where the tunnel entrance begins
    var getTunnelEntrance = function(x,y,dx) {
        while (!this.isFloorTile(x,y-1) && !this.isFloorTile(x,y+1) && this.isFloorTile(x,y))
            x += dx;
        return x;
    };

    // the number of margin tiles outside of the map on one side of a tunnel
    // There are (2*marginTiles) tiles outside of the map per tunnel.
    var marginTiles = 2;

    return function() {
        this.tunnelRows = {};
        var y;
        var i;
        var left,right;
        for (y=0;y<this.numRows;y++)
            // a map row is a tunnel if opposite ends are both walkable tiles
            if (this.isFloorTile(0,y) && this.isFloorTile(this.numCols-1,y))
                this.tunnelRows[y] = {
                    'leftEntrance': getTunnelEntrance.call(this,0,y,1),
                    'rightEntrance':getTunnelEntrance.call(this,this.numCols-1,y,-1),
                    'leftExit': -marginTiles*tileSize,
                    'rightExit': (this.numCols+marginTiles)*tileSize-1,
                };
    };
})();

// teleport actor to other side of tunnel if necessary
Map.prototype.teleport = function(actor){
    var i;
    var t = this.tunnelRows[actor.tile.y];
    if (t) {
        if (actor.pixel.x < t.leftExit)       actor.pixel.x = t.rightExit;
        else if (actor.pixel.x > t.rightExit) actor.pixel.x = t.leftExit;
    }
};

Map.prototype.posToIndex = function(x,y) {
    if (x>=0 && x<this.numCols && y>=0 && y<this.numRows) 
        return x+y*this.numCols;
};

// define which tiles are inside the tunnel
Map.prototype.isTunnelTile = function(x,y) {
    var tunnel = this.tunnelRows[y];
    return tunnel && (x < tunnel.leftEntrance || x > tunnel.rightEntrance);
};

// retrieves tile character at given coordinate
// extended to include offscreen tunnel space
Map.prototype.getTile = function(x,y) {
    if (x>=0 && x<this.numCols && y>=0 && y<this.numRows) 
        return this.currentTiles[this.posToIndex(x,y)];
    if ((x<0 || x>=this.numCols) && (this.isTunnelTile(x,y-1) || this.isTunnelTile(x,y+1)))
        return '|';
    if (this.isTunnelTile(x,y))
        return ' ';
};

// determines if the given character is a walkable floor tile
Map.prototype.isFloorTileChar = function(tile) {
    return tile==' ' || tile=='.' || tile=='o';
};

// determines if the given tile coordinate has a walkable floor tile
Map.prototype.isFloorTile = function(x,y) {
    return this.isFloorTileChar(this.getTile(x,y));
};

// mark the dot at the given coordinate eaten
Map.prototype.onDotEat = function(x,y) {
    this.dotsEaten++;
    var i = this.posToIndex(x,y);
    this.currentTiles[i] = ' ';
    this.timeEaten[i] = vcr.getTime();
    renderer.erasePellet(x,y);
};
// source: http://mjijackson.com/2008/02/rgb-to-hsl-and-rgb-to-hsv-color-model-conversion-algorithms-in-javascript

/**
 * Converts an RGB color value to HSL. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes r, g, and b are contained in the set [0, 255] and
 * returns h, s, and l in the set [0, 1].
 *
 * @param   Number  r       The red color value
 * @param   Number  g       The green color value
 * @param   Number  b       The blue color value
 * @return  Array           The HSL representation
 */
function rgbToHsl(r, g, b){
    r /= 255, g /= 255, b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, l = (max + min) / 2;

    if(max == min){
        h = s = 0; // achromatic
    }else{
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch(max){
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return [h, s, l];
}

/**
 * Converts an HSL color value to RGB. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes h, s, and l are contained in the set [0, 1] and
 * returns r, g, and b in the set [0, 255].
 *
 * @param   Number  h       The hue
 * @param   Number  s       The saturation
 * @param   Number  l       The lightness
 * @return  Array           The RGB representation
 */
function hslToRgb(h, s, l){
    var r, g, b;

    if(s == 0){
        r = g = b = l; // achromatic
    }else{
        function hue2rgb(p, q, t){
            if(t < 0) t += 1;
            if(t > 1) t -= 1;
            if(t < 1/6) return p + (q - p) * 6 * t;
            if(t < 1/2) return q;
            if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        }

        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }

    r *= 255;
    g *= 255;
    b *= 255;

    return [r,g,b];
}

/**
 * Converts an RGB color value to HSV. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSV_color_space.
 * Assumes r, g, and b are contained in the set [0, 255] and
 * returns h, s, and v in the set [0, 1].
 *
 * @param   Number  r       The red color value
 * @param   Number  g       The green color value
 * @param   Number  b       The blue color value
 * @return  Array           The HSV representation
 */
function rgbToHsv(r, g, b){
    r = r/255, g = g/255, b = b/255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, v = max;

    var d = max - min;
    s = max == 0 ? 0 : d / max;

    if(max == min){
        h = 0; // achromatic
    }else{
        switch(max){
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return [h, s, v];
}

/**
 * Converts an HSV color value to RGB. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSV_color_space.
 * Assumes h, s, and v are contained in the set [0, 1] and
 * returns r, g, and b in the set [0, 255].
 *
 * @param   Number  h       The hue
 * @param   Number  s       The saturation
 * @param   Number  v       The value
 * @return  Array           The RGB representation
 */
function hsvToRgb(h, s, v){
    var r, g, b;

    var i = Math.floor(h * 6);
    var f = h * 6 - i;
    var p = v * (1 - s);
    var q = v * (1 - f * s);
    var t = v * (1 - (1 - f) * s);

    switch(i % 6){
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }

    r *= 255;
    g *= 255;
    b *= 255;

    return [r,g,b];
}

function rgbString(rgb) {
    var r = Math.floor(rgb[0]);
    var g = Math.floor(rgb[1]);
    var b = Math.floor(rgb[2]);
    return 'rgb('+r+','+g+','+b+')';
}
var mapgen = (function(){

    var shuffle = function(list) {
        var len = list.length;
        var i,j;
        var temp;
        for (i=0; i<len; i++) {
            j = getRandomInt(0,len-1);
            temp = list[i];
            list[i] = list[j];
            list[j] = temp;
        }
    };

    var randomElement = function(list) {
        var len = list.length;
        if (len > 0) {
            return list[getRandomInt(0,len-1)];
        }
    };

    var UP = 0;
    var RIGHT = 1;
    var DOWN = 2;
    var LEFT = 3;

    var cells = [];
    var tallRows = [];
    var narrowCols = [];

    var rows = 9;
    var cols = 5;

    var reset = function() {
        var i;
        var c;

        // initialize cells
        for (i=0; i<rows*cols; i++) {
            cells[i] = {
                x: i%cols,
                y: Math.floor(i/cols),
                filled: false,
                connect: [false, false, false, false],
                next: [],
                no: undefined,
                group: undefined,
            };
        }

        // allow each cell to refer to surround cells by direction
        for (i=0; i<rows*cols; i++) {
            var c = cells[i];
            if (c.x > 0)
                c.next[LEFT] = cells[i-1];
            if (c.x < cols - 1)
                c.next[RIGHT] = cells[i+1];
            if (c.y > 0)
                c.next[UP] = cells[i-cols];
            if (c.y < rows - 1)
                c.next[DOWN] = cells[i+cols];
        }

        // define the ghost home square

        i = 3*cols;
        c = cells[i];
        c.filled=true;
        c.connect[LEFT] = c.connect[RIGHT] = c.connect[DOWN] = true;

        i++;
        c = cells[i];
        c.filled=true;
        c.connect[LEFT] = c.connect[DOWN] = true;

        i+=cols-1;
        c = cells[i];
        c.filled=true;
        c.connect[LEFT] = c.connect[UP] = c.connect[RIGHT] = true;

        i++;
        c = cells[i];
        c.filled=true;
        c.connect[UP] = c.connect[LEFT] = true;
    };

    var genRandom = function() {

        var getLeftMostEmptyCells = function() {
            var x;
            var leftCells = [];
            for (x=0; x<cols; x++) {
                for (y=0; y<rows; y++) {
                    var c = cells[x+y*cols];
                    if (!c.filled) {
                        leftCells.push(c);
                    }
                }

                if (leftCells.length > 0) {
                    break;
                }
            }
            return leftCells;
        };
        var isOpenCell = function(cell,i,prevDir,size) {

            // prevent wall from going through starting position
            if (cell.y == 6 && cell.x == 0 && i == DOWN ||
                cell.y == 7 && cell.x == 0 && i == UP) {
                return false;
            }

            // prevent long straight pieces of length 3
            if (size == 2 && (i==prevDir || rotateAboutFace(i)==prevDir)) {
                return false;
            }

            // examine an adjacent empty cell
            if (cell.next[i] && !cell.next[i].filled) {
                
                // only open if the cell to the left of it is filled
                if (cell.next[i].next[LEFT] && !cell.next[i].next[LEFT].filled) {
                }
                else {
                    return true;
                }
            }

            return false;
        };
        var getOpenCells = function(cell,prevDir,size) {
            var openCells = [];
            var numOpenCells = 0;
            for (i=0; i<4; i++) {
                if (isOpenCell(cell,i,prevDir,size)) {
                    openCells.push(i);
                    numOpenCells++;
                }
            }
            return { openCells: openCells, numOpenCells: numOpenCells };
        };
        var connectCell = function(cell,dir) {
            cell.connect[dir] = true;
            cell.next[dir].connect[rotateAboutFace(dir)] = true;
            if (cell.x == 0 && dir == RIGHT) {
                cell.connect[LEFT] = true;
            }
        };

        var gen = function() {
        
            var cell;      // cell at the center of growth (open cells are chosen around this cell)
            var newCell;   // most recent cell filled
            var firstCell; // the starting cell of the current group

            var openCells;    // list of open cells around the center cell
            var numOpenCells; // size of openCells

            var dir; // the most recent direction of growth relative to the center cell
            var i;   // loop control variable used for iterating directions

            var numFilled = 0;  // current count of total cells filled
            var numGroups;      // current count of cell groups created
            var size;           // current number of cells in the current group
            var probStopGrowingAtSize = [ // probability of stopping growth at sizes...
                    0,     // size 0
                    0,     // size 1
                    0.10,  // size 2
                    0.5,   // size 3
                    0.75,  // size 4
                    1];    // size 5

            // A single cell group of size 1 is allowed at each row at y=0 and y=rows-1,
            // so keep count of those created.
            var singleCount = {};
            singleCount[0] = singleCount[rows-1] = 0;
            var probTopAndBotSingleCellJoin = 0.35;

            // A count and limit of the number long pieces (i.e. an "L" of size 4 or "T" of size 5)
            var longPieces = 0;
            var maxLongPieces = 1;
            var probExtendAtSize2 = 1;
            var probExtendAtSize3or4 = 0.5;

            var fillCell = function(cell) {
                cell.filled = true;
                cell.no = numFilled++;
                cell.group = numGroups;
            };

            for (numGroups=0; ; numGroups++) {

                // find all the leftmost empty cells
                openCells = getLeftMostEmptyCells();

                // stop add pieces if there are no more empty cells.
                numOpenCells = openCells.length;
                if (numOpenCells == 0) {
                    break;
                }

                // choose the center cell to be a random open cell, and fill it.
                firstCell = cell = openCells[getRandomInt(0,numOpenCells-1)];
                fillCell(cell);

                // randomly allow one single-cell piece on the top or bottom of the map.
                if (cell.x < cols-1 && (cell.y in singleCount) && Math.random() <= probTopAndBotSingleCellJoin) {
                    if (singleCount[cell.y] == 0) {
                        cell.connect[cell.y == 0 ? UP : DOWN] = true;
                        singleCount[cell.y]++;
                        continue;
                    }
                }

                // number of cells in this contiguous group
                size = 1;

                if (cell.x == cols-1) {
                    // if the first cell is at the right edge, then don't grow it.
                    cell.connect[RIGHT] = true;
                    cell.isRaiseHeightCandidate = true;
                }
                else {
                    // only allow the piece to grow to 5 cells at most.
                    while (size < 5) {

                        var stop = false;

                        if (size == 2) {
                            // With a horizontal 2-cell group, try to turn it into a 4-cell "L" group.
                            // This is done here because this case cannot be reached when a piece has already grown to size 3.
                            var c = firstCell;
                            if (c.x > 0 && c.connect[RIGHT] && c.next[RIGHT] && c.next[RIGHT].next[RIGHT]) {
                                if (longPieces < maxLongPieces && Math.random() <= probExtendAtSize2) {

                                    c = c.next[RIGHT].next[RIGHT];
                                    var dirs = {};
                                    if (isOpenCell(c,UP)) {
                                        dirs[UP] = true;
                                    }
                                    if (isOpenCell(c,DOWN)) {
                                        dirs[DOWN] = true;
                                    }

                                    if (dirs[UP] && dirs[DOWN]) {
                                        i = [UP,DOWN][getRandomInt(0,1)];
                                    }
                                    else if (dirs[UP]) {
                                        i = UP;
                                    }
                                    else if (dirs[DOWN]) {
                                        i = DOWN;
                                    }
                                    else {
                                        i = undefined;
                                    }

                                    if (i != undefined) {
                                        connectCell(c,LEFT);
                                        fillCell(c);
                                        connectCell(c,i);
                                        fillCell(c.next[i]);
                                        longPieces++;
                                        size+=2;
                                        stop = true;
                                    }
                                }
                            }
                        }

                        if (!stop) {
                            // find available open adjacent cells.
                            var result = getOpenCells(cell,dir,size);
                            openCells = result['openCells'];
                            numOpenCells = result['numOpenCells'];

                            // if no open cells found from center point, then use the last cell as the new center
                            // but only do this if we are of length 2 to prevent numerous short pieces.
                            // then recalculate the open adjacent cells.
                            if (numOpenCells == 0 && size == 2) {
                                cell = newCell;
                                result = getOpenCells(cell,dir,size);
                                openCells = result['openCells'];
                                numOpenCells = result['numOpenCells'];
                            }

                            // no more adjacent cells, so stop growing this piece.
                            if (numOpenCells == 0) {
                                stop = true;
                            }
                            else {
                                // choose a random valid direction to grow.
                                dir = openCells[getRandomInt(0,numOpenCells-1)];
                                newCell = cell.next[dir];

                                // connect the cell to the new cell.
                                connectCell(cell,dir);

                                // fill the cell
                                fillCell(newCell);

                                // increase the size count of this piece.
                                size++;

                                // don't let center pieces grow past 3 cells
                                if (firstCell.x == 0 && size == 3) {
                                    stop = true;
                                }

                                // Use a probability to determine when to stop growing the piece.
                                if (Math.random() <= probStopGrowingAtSize[size]) {
                                    stop = true;
                                }
                            }
                        }

                        // Close the piece.
                        if (stop) {

                            if (size == 1) {
                                // This is provably impossible because this loop is never entered with size==1.
                            }
                            else if (size == 2) {

                                // With a vertical 2-cell group, attach to the right wall if adjacent.
                                var c = firstCell;
                                if (c.x == cols-1) {

                                    // select the top cell
                                    if (c.connect[UP]) {
                                        c = c.next[UP];
                                    }
                                    c.connect[RIGHT] = c.next[DOWN].connect[RIGHT] = true;
                                }
                                
                            }
                            else if (size == 3 || size == 4) {

                                // Try to extend group to have a long leg
                                if (longPieces < maxLongPieces && firstCell.x > 0 && Math.random() <= probExtendAtSize3or4) {
                                    var dirs = [];
                                    var dirsLength = 0;
                                    for (i=0; i<4; i++) {
                                        if (cell.connect[i] && isOpenCell(cell.next[i],i)) {
                                            dirs.push(i);
                                            dirsLength++;
                                        }
                                    }
                                    if (dirsLength > 0) {
                                        i = dirs[getRandomInt(0,dirsLength-1)];
                                        c = cell.next[i];
                                        connectCell(c,i);
                                        fillCell(c.next[i]);
                                        longPieces++;
                                    }
                                }
                            }

                            break;
                        }
                    }
                }
            }
            setResizeCandidates();
        };


        var setResizeCandidates = function() {
            var i;
            var c,q,c2,q2;
            var x,y;
            for (i=0; i<rows*cols; i++) {
                c = cells[i];
                x = i % cols;
                y = Math.floor(i/cols);

                // determine if it has flexible height

                //
                // |_|
                //
                // or
                //  _
                // | |
                //
                q = c.connect;
                if ((c.x == 0 || !q[LEFT]) &&
                    (c.x == cols-1 || !q[RIGHT]) &&
                    q[UP] != q[DOWN]) {
                    c.isRaiseHeightCandidate = true;
                }

                //  _ _
                // |_ _|
                //
                c2 = c.next[RIGHT];
                if (c2 != undefined) {
                    q2 = c2.connect;
                    if (((c.x == 0 || !q[LEFT]) && !q[UP] && !q[DOWN]) &&
                        ((c2.x == cols-1 || !q2[RIGHT]) && !q2[UP] && !q2[DOWN])
                        ) {
                        c.isRaiseHeightCandidate = c2.isRaiseHeightCandidate = true;
                    }
                }

                // determine if it has flexible width

                // if cell is on the right edge with an opening to the right
                if (c.x == cols-1 && q[RIGHT]) {
                    c.isShrinkWidthCandidate = true;
                }

                //  _
                // |_
                // 
                // or
                //  _
                //  _|
                //
                if ((c.y == 0 || !q[UP]) &&
                    (c.y == rows-1 || !q[DOWN]) &&
                    q[LEFT] != q[RIGHT]) {
                    c.isShrinkWidthCandidate = true;
                }

            }
        };

        // Identify if a cell is the center of a cross.
        var cellIsCrossCenter = function(c) {
            return c.connect[UP] && c.connect[RIGHT] && c.connect[DOWN] && c.connect[LEFT];
        };

        var chooseNarrowCols = function() {

            var canShrinkWidth = function(x,y) {

                // Can cause no more tight turns.
                if (y==rows-1) {
                    return true;
                }

                // get the right-hand-side bound
                var x0;
                var c,c2;
                for (x0=x; x0<cols; x0++) {
                    c = cells[x0+y*cols];
                    c2 = c.next[DOWN]
                    if ((!c.connect[RIGHT] || cellIsCrossCenter(c)) &&
                        (!c2.connect[RIGHT] || cellIsCrossCenter(c2))) {
                        break;
                    }
                }

                // build candidate list
                var candidates = [];
                var numCandidates = 0;
                for (; c2; c2=c2.next[LEFT]) {
                    if (c2.isShrinkWidthCandidate) {
                        candidates.push(c2);
                        numCandidates++;
                    }

                    // cannot proceed further without causing irreconcilable tight turns
                    if ((!c2.connect[LEFT] || cellIsCrossCenter(c2)) &&
                        (!c2.next[UP].connect[LEFT] || cellIsCrossCenter(c2.next[UP]))) {
                        break;
                    }
                }
                shuffle(candidates);

                var i;
                for (i=0; i<numCandidates; i++) {
                    c2 = candidates[i];
                    if (canShrinkWidth(c2.x,c2.y)) {
                        c2.shrinkWidth = true;
                        narrowCols[c2.y] = c2.x;
                        return true;
                    }
                }

                return false;
            };

            var x;
            var c;
            for (x=cols-1; x>=0; x--) {
                c = cells[x];
                if (c.isShrinkWidthCandidate && canShrinkWidth(x,0)) {
                    c.shrinkWidth = true;
                    narrowCols[c.y] = c.x;
                    return true;
                }
            }

            return false;
        };

        var chooseTallRows = function() {

            var canRaiseHeight = function(x,y) {

                // Can cause no more tight turns.
                if (x==cols-1) {
                    return true;
                }

                // find the first cell below that will create too tight a turn on the right
                var y0;
                var c;
                var c2;
                for (y0=y; y0>=0; y0--) {
                    c = cells[x+y0*cols];
                    c2 = c.next[RIGHT]
                    if ((!c.connect[UP] || cellIsCrossCenter(c)) && 
                        (!c2.connect[UP] || cellIsCrossCenter(c2))) {
                        break;
                    }
                }

                // Proceed from the right cell upwards, looking for a cell that can be raised.
                var candidates = [];
                var numCandidates = 0;
                for (; c2; c2=c2.next[DOWN]) {
                    if (c2.isRaiseHeightCandidate) {
                        candidates.push(c2);
                        numCandidates++;
                    }

                    // cannot proceed further without causing irreconcilable tight turns
                    if ((!c2.connect[DOWN] || cellIsCrossCenter(c2)) &&
                        (!c2.next[LEFT].connect[DOWN] || cellIsCrossCenter(c2.next[LEFT]))) {
                        break;
                    }
                }
                shuffle(candidates);

                var i;
                for (i=0; i<numCandidates; i++) {
                    c2 = candidates[i];
                    if (canRaiseHeight(c2.x,c2.y)) {
                        c2.raiseHeight = true;
                        tallRows[c2.x] = c2.y;
                        return true;
                    }
                }

                return false;
            };

            // From the top left, examine cells below until hitting top of ghost house.
            // A raisable cell must be found before the ghost house.
            var y;
            var c;
            for (y=0; y<3; y++) {
                c = cells[y*cols];
                if (c.isRaiseHeightCandidate && canRaiseHeight(0,y)) {
                    c.raiseHeight = true;
                    tallRows[c.x] = c.y;
                    return true;
                }
            }

            return false;
        };

        // This is a function to detect impurities in the map that have no heuristic implemented to avoid it yet in gen().
        var isDesirable = function() {

            // ensure a solid top right corner
            var c = cells[4];
            if (c.connect[UP] || c.connect[RIGHT]) {
                return false;
            }

            // ensure a solid bottom right corner
            c = cells[rows*cols-1];
            if (c.connect[DOWN] || c.connect[RIGHT]) {
                return false;
            }

            // ensure there are no two stacked/side-by-side 2-cell pieces.
            var isHori = function(x,y) {
                var q1 = cells[x+y*cols].connect;
                var q2 = cells[x+1+y*cols].connect;
                return !q1[UP] && !q1[DOWN] && (x==0 || !q1[LEFT]) && q1[RIGHT] && 
                       !q2[UP] && !q2[DOWN] && q2[LEFT] && !q2[RIGHT];
            };
            var isVert = function(x,y) {
                var q1 = cells[x+y*cols].connect;
                var q2 = cells[x+(y+1)*cols].connect;
                if (x==cols-1) {
                    // special case (we can consider two single cells as vertical at the right edge)
                    return !q1[LEFT] && !q1[UP] && !q1[DOWN] &&
                           !q2[LEFT] && !q2[UP] && !q2[DOWN];
                }
                return !q1[LEFT] && !q1[RIGHT] && !q1[UP] && q1[DOWN] && 
                       !q2[LEFT] && !q2[RIGHT] && q2[UP] && !q2[DOWN];
            };
            var x,y;
            var g;
            for (y=0; y<rows-1; y++) {
                for (x=0; x<cols-1; x++) {
                    if (isHori(x,y) && isHori(x,y+1) ||
                        isVert(x,y) && isVert(x+1,y)) {

                        // don't allow them in the middle because they'll be two large when reflected.
                        if (x==0) {
                            return false;
                        }

                        // Join the four cells to create a square.
                        cells[x+y*cols].connect[DOWN] = true;
                        cells[x+y*cols].connect[RIGHT] = true;
                        g = cells[x+y*cols].group;

                        cells[x+1+y*cols].connect[DOWN] = true;
                        cells[x+1+y*cols].connect[LEFT] = true;
                        cells[x+1+y*cols].group = g;

                        cells[x+(y+1)*cols].connect[UP] = true;
                        cells[x+(y+1)*cols].connect[RIGHT] = true;
                        cells[x+(y+1)*cols].group = g;

                        cells[x+1+(y+1)*cols].connect[UP] = true;
                        cells[x+1+(y+1)*cols].connect[LEFT] = true;
                        cells[x+1+(y+1)*cols].group = g;
                    }
                }
            }

            if (!chooseTallRows()) {
                return false;
            }

            if (!chooseNarrowCols()) {
                return false;
            }

            return true;
        };

        // set the final position and size of each cell when upscaling the simple model to actual size
        var setUpScaleCoords = function() {
            var i,c;
            for (i=0; i<rows*cols; i++) {
                c = cells[i];
                c.final_x = c.x*3;
                if (narrowCols[c.y] < c.x) {
                    c.final_x--;
                }
                c.final_y = c.y*3;
                if (tallRows[c.x] < c.y) {
                    c.final_y++;
                }
                c.final_w = c.shrinkWidth ? 2 : 3;
                c.final_h = c.raiseHeight ? 4 : 3;
            }
        };

        var reassignGroup = function(oldg,newg) {
            var i;
            var c;
            for (i=0; i<rows*cols; i++) {
                c = cells[i];
                if (c.group == oldg) {
                    c.group = newg;
                }
            }
        };

        var createTunnels = function() {

            // declare candidates
            var singleDeadEndCells = [];
            var topSingleDeadEndCells = [];
            var botSingleDeadEndCells = [];

            var voidTunnelCells = [];
            var topVoidTunnelCells = [];
            var botVoidTunnelCells = [];

            var edgeTunnelCells = [];
            var topEdgeTunnelCells = [];
            var botEdgeTunnelCells = [];

            var doubleDeadEndCells = [];

            var numTunnelsCreated = 0;

            // prepare candidates
            var y;
            var c;
            var upDead;
            var downDead;
            for (y=0; y<rows; y++) {
                c = cells[cols-1+y*cols];
                if (c.connect[UP]) {
                    continue;
                }
                if (c.y > 1 && c.y < rows-2) {
                    c.isEdgeTunnelCandidate = true;
                    edgeTunnelCells.push(c);
                    if (c.y <= 2) {
                        topEdgeTunnelCells.push(c);
                    }
                    else if (c.y >= 5) {
                        botEdgeTunnelCells.push(c);
                    }
                }
                upDead = (!c.next[UP] || c.next[UP].connect[RIGHT]);
                downDead = (!c.next[DOWN] || c.next[DOWN].connect[RIGHT]);
                if (c.connect[RIGHT]) {
                    if (upDead) {
                        c.isVoidTunnelCandidate = true;
                        voidTunnelCells.push(c);
                        if (c.y <= 2) {
                            topVoidTunnelCells.push(c);
                        }
                        else if (c.y >= 6) {
                            botVoidTunnelCells.push(c);
                        }
                    }
                }
                else {
                    if (c.connect[DOWN]) {
                        continue;
                    }
                    if (upDead != downDead) {
                        if (!c.raiseHeight && y < rows-1 && !c.next[LEFT].connect[LEFT]) {
                            singleDeadEndCells.push(c);
                            c.isSingleDeadEndCandidate = true;
                            c.singleDeadEndDir = upDead ? UP : DOWN;
                            var offset = upDead ? 1 : 0;
                            if (c.y <= 1+offset) {
                                topSingleDeadEndCells.push(c);
                            }
                            else if (c.y >= 5+offset) {
                                botSingleDeadEndCells.push(c);
                            }
                        }
                    }
                    else if (upDead && downDead) {
                        if (y > 0 && y < rows-1) {
                            if (c.next[LEFT].connect[UP] && c.next[LEFT].connect[DOWN]) {
                                c.isDoubleDeadEndCandidate = true;
                                if (c.y >= 2 && c.y <= 5) {
                                    doubleDeadEndCells.push(c);
                                }
                            }
                        }
                    }
                }
            }

            // choose tunnels from candidates
            var numTunnelsDesired = Math.random() <= 0.45 ? 2 : 1;
            var c;
            var selectSingleDeadEnd = function(c) {
                c.connect[RIGHT] = true;
                if (c.singleDeadEndDir == UP) {
                    c.topTunnel = true;
                }
                else {
                    c.next[DOWN].topTunnel = true;
                }
            };
            if (numTunnelsDesired == 1) {
                if (c = randomElement(voidTunnelCells)) {
                    c.topTunnel = true;
                }
                else if (c = randomElement(singleDeadEndCells)) {
                    selectSingleDeadEnd(c);
                }
                else if (c = randomElement(edgeTunnelCells)) {
                    c.topTunnel = true;
                }
                else {
                    return false;
                }
            }
            else if (numTunnelsDesired == 2) {
                if (c = randomElement(doubleDeadEndCells)) {
                    c.connect[RIGHT] = true;
                    c.topTunnel = true;
                    c.next[DOWN].topTunnel = true;
                }
                else {
                    numTunnelsCreated = 1;
                    if (c = randomElement(topVoidTunnelCells)) {
                        c.topTunnel = true;
                    }
                    else if (c = randomElement(topSingleDeadEndCells)) {
                        selectSingleDeadEnd(c);
                    }
                    else if (c = randomElement(topEdgeTunnelCells)) {
                        c.topTunnel = true;
                    }
                    else {
                        // could not find a top tunnel opening
                        numTunnelsCreated = 0;
                    }

                    if (c = randomElement(botVoidTunnelCells)) {
                        c.topTunnel = true;
                    }
                    else if (c = randomElement(botSingleDeadEndCells)) {
                        selectSingleDeadEnd(c);
                    }
                    else if (c = randomElement(botEdgeTunnelCells)) {
                        c.topTunnel = true;
                    }
                    else {
                        // could not find a bottom tunnel opening
                        if (numTunnelsCreated == 0) {
                            return false;
                        }
                    }
                }
            }

            // don't allow a horizontal path to cut straight through a map (through tunnels)
            var exit,topy;
            for (y=0; y<rows; y++) {
                c = cells[cols-1+y*cols];
                if (c.topTunnel) {
                    exit = true;
                    topy = c.final_y;
                    while (c.next[LEFT]) {
                        c = c.next[LEFT];
                        if (!c.connect[UP] && c.final_y == topy) {
                            continue;
                        }
                        else {
                            exit = false;
                            break;
                        }
                    }
                    if (exit) {
                        return false;
                    }
                }
            }

            // clear unused void tunnels (dead ends)
            var len = voidTunnelCells.length;
            var i;

            var replaceGroup = function(oldg,newg) {
                var i,c;
                for (i=0; i<rows*cols; i++) {
                    c = cells[i];
                    if (c.group == oldg) {
                        c.group = newg;
                    }
                }
            };
            for (i=0; i<len; i++) {
                c = voidTunnelCells[i];
                if (!c.topTunnel) {
                    replaceGroup(c.group, c.next[UP].group);
                    c.connect[UP] = true;
                    c.next[UP].connect[DOWN] = true;
                }
            }

            return true;
        };

        var joinWalls = function() {

            // randomly join wall pieces to the boundary to increase difficulty

            var x,y;
            var c;

            // join cells to the top boundary
            for (x=0; x<cols; x++) {
                c = cells[x];
                if (!c.connect[LEFT] && !c.connect[RIGHT] && !c.connect[UP] &&
                    (!c.connect[DOWN] || !c.next[DOWN].connect[DOWN])) {

                    // ensure it will not create a dead-end
                    if ((!c.next[LEFT] || !c.next[LEFT].connect[UP]) &&
                        (c.next[RIGHT] && !c.next[RIGHT].connect[UP])) {

                        // prevent connecting very large piece
                        if (!(c.next[DOWN] && c.next[DOWN].connect[RIGHT] && c.next[DOWN].next[RIGHT].connect[RIGHT])) {
                            c.isJoinCandidate = true;
                            if (Math.random() <= 0.25) {
                                c.connect[UP] = true;
                            }
                        }
                    }
                }
            }

            // join cells to the bottom boundary
            for (x=0; x<cols; x++) {
                c = cells[x+(rows-1)*cols];
                if (!c.connect[LEFT] && !c.connect[RIGHT] && !c.connect[DOWN] &&
                    (!c.connect[UP] || !c.next[UP].connect[UP])) {

                    // ensure it will not creat a dead-end
                    if ((!c.next[LEFT] || !c.next[LEFT].connect[DOWN]) &&
                        (c.next[RIGHT] && !c.next[RIGHT].connect[DOWN])) {

                        // prevent connecting very large piece
                        if (!(c.next[UP] && c.next[UP].connect[RIGHT] && c.next[UP].next[RIGHT].connect[RIGHT])) {
                            c.isJoinCandidate = true;
                            if (Math.random() <= 0.25) {
                                c.connect[DOWN] = true;
                            }
                        }
                    }
                }
            }

            // join cells to the right boundary
            var c2;
            for (y=1; y<rows-1; y++) {
                c = cells[cols-1+y*cols];
                if (c.raiseHeight) {
                    continue;
                }
                if (!c.connect[RIGHT] && !c.connect[UP] && !c.connect[DOWN] &&
                    !c.next[UP].connect[RIGHT] && !c.next[DOWN].connect[RIGHT]) {
                    if (c.connect[LEFT]) {
                        c2 = c.next[LEFT];
                        if (!c2.connect[UP] && !c2.connect[DOWN] && !c2.connect[LEFT]) {
                            c.isJoinCandidate = true;
                            if (Math.random() <= 0.5) {
                                c.connect[RIGHT] = true;
                            }
                        }
                    }
                }
            }
        };

        // try to generate a valid map, and keep count of tries.
        var genCount = 0;
        while (true) {
            reset();
            gen();
            genCount++;
            if (!isDesirable()) {
                continue;
            }

            setUpScaleCoords();
            joinWalls();
            if (!createTunnels()) {
                continue;
            }

            break;
        }

    };

    // Transform the simple cells to a tile array used for creating the map.
    var getTiles = function() {

        var tiles = []; // each is a character indicating a wall(|), path(.), or blank(_).
        var tileCells = []; // maps each tile to a specific cell of our simple map
        var subrows = rows*3+1+3;
        var subcols = cols*3-1+2;

        var midcols = subcols-2;
        var fullcols = (subcols-2)*2;

        // getter and setter for tiles (ensures vertical symmetry axis)
        var setTile = function(x,y,v) {
            if (x<0 || x>subcols-1 || y<0 || y>subrows-1) {
                return;
            }
            x -= 2;
            tiles[midcols+x+y*fullcols] = v;
            tiles[midcols-1-x+y*fullcols] = v;
        };
        var getTile = function(x,y) {
            if (x<0 || x>subcols-1 || y<0 || y>subrows-1) {
                return undefined;
            }
            x -= 2;
            return tiles[midcols+x+y*fullcols];
        };

        // getter and setter for tile cells
        var setTileCell = function(x,y,cell) {
            if (x<0 || x>subcols-1 || y<0 || y>subrows-1) {
                return;
            }
            x -= 2;
            tileCells[x+y*subcols] = cell;
        };
        var getTileCell = function(x,y) {
            if (x<0 || x>subcols-1 || y<0 || y>subrows-1) {
                return undefined;
            }
            x -= 2;
            return tileCells[x+y*subcols];
        };

        // initialize tiles
        var i;
        for (i=0; i<subrows*fullcols; i++) {
            tiles.push('_');
        }
        for (i=0; i<subrows*subcols; i++) {
            tileCells.push(undefined);
        }

        // set tile cells
        var c;
        var x,y,w,h;
        var x0,y0;
        for (i=0; i<rows*cols; i++) {
            c = cells[i];
            for (x0=0; x0<c.final_w; x0++) {
                for (y0=0; y0<c.final_h; y0++) {
                    setTileCell(c.final_x+x0,c.final_y+1+y0,c);
                }
            }
        }

        // set path tiles
        var cl, cu;
        for (y=0; y<subrows; y++) {
            for (x=0; x<subcols; x++) {
                c = getTileCell(x,y); // cell
                cl = getTileCell(x-1,y); // left cell
                cu = getTileCell(x,y-1); // up cell

                if (c) {
                    // inside map
                    if (cl && c.group != cl.group || // at vertical boundary
                        cu && c.group != cu.group || // at horizontal boundary
                        !cu && !c.connect[UP]) { // at top boundary
                        setTile(x,y,'.');
                    }
                }
                else {
                    // outside map
                    if (cl && (!cl.connect[RIGHT] || getTile(x-1,y) == '.') || // at right boundary
                        cu && (!cu.connect[DOWN] || getTile(x,y-1) == '.')) { // at bottom boundary
                        setTile(x,y,'.');
                    }
                }

                // at corner connecting two paths
                if (getTile(x-1,y) == '.' && getTile(x,y-1) == '.' && getTile(x-1,y-1) == '_') {
                    setTile(x,y,'.');
                }
            }
        }

        // extend tunnels
        var y;
        for (c=cells[cols-1]; c; c = c.next[DOWN]) {
            if (c.topTunnel) {
                y = c.final_y+1;
                setTile(subcols-1, y,'.');
                setTile(subcols-2, y,'.');
            }
        }

        // fill in walls
        for (y=0; y<subrows; y++) {
            for (x=0; x<subcols; x++) {
                // any blank tile that shares a vertex with a path tile should be a wall tile
                if (getTile(x,y) != '.' && (getTile(x-1,y) == '.' || getTile(x,y-1) == '.' || getTile(x+1,y) == '.' || getTile(x,y+1) == '.' ||
                    getTile(x-1,y-1) == '.' || getTile(x+1,y-1) == '.' || getTile(x+1,y+1) == '.' || getTile(x-1,y+1) == '.')) {
                    setTile(x,y,'|');
                }
            }
        }

        // create the ghost door
        setTile(2,12,'-');

        // set energizers
        var getTopEnergizerRange = function() {
            var miny;
            var maxy = subrows/2;
            var x = subcols-2;
            var y;
            for (y=2; y<maxy; y++) {
                if (getTile(x,y) == '.' && getTile(x,y+1) == '.') {
                    miny = y+1;
                    break;
                }
            }
            maxy = Math.min(maxy,miny+7);
            for (y=miny+1; y<maxy; y++) {
                if (getTile(x-1,y) == '.') {
                    maxy = y-1;
                    break;
                }
            }
            return {miny:miny, maxy:maxy};
        };
        var getBotEnergizerRange = function() {
            var miny = subrows/2;
            var maxy;
            var x = subcols-2;
            var y;
            for (y=subrows-3; y>=miny; y--) {
                if (getTile(x,y) == '.' && getTile(x,y+1) == '.') {
                    maxy = y;
                    break;
                }
            }
            miny = Math.max(miny,maxy-7);
            for (y=maxy-1; y>miny; y--) {
                if (getTile(x-1,y) == '.') {
                    miny = y+1;
                    break;
                }
            }
            return {miny:miny, maxy:maxy};
        };
        var x = subcols-2;
        var y;
        var range;
        if (range = getTopEnergizerRange()) {
            y = getRandomInt(range.miny, range.maxy);
            setTile(x,y,'o');
        }
        if (range = getBotEnergizerRange()) {
            y = getRandomInt(range.miny, range.maxy);
            setTile(x,y,'o');
        }

        // erase pellets in the tunnels
        var eraseUntilIntersection = function(x,y) {
            var adj;
            while (true) {
                adj = [];
                if (getTile(x-1,y) == '.') {
                    adj.push({x:x-1,y:y});
                }
                if (getTile(x+1,y) == '.') {
                    adj.push({x:x+1,y:y});
                }
                if (getTile(x,y-1) == '.') {
                    adj.push({x:x,y:y-1});
                }
                if (getTile(x,y+1) == '.') {
                    adj.push({x:x,y:y+1});
                }
                if (adj.length == 1) {
                    setTile(x,y,' ');
                    x = adj[0].x;
                    y = adj[0].y;
                }
                else {
                    break;
                }
            }
        };
        x = subcols-1;
        for (y=0; y<subrows; y++) {
            if (getTile(x,y) == '.') {
                eraseUntilIntersection(x,y);
            }
        }

        // erase pellets on starting position
        setTile(1,subrows-8,' ');

        // erase pellets around the ghost house
        var i,j;
        var y;
        for (i=0; i<7; i++) {

            // erase pellets from bottom of the ghost house proceeding down until
            // reaching a pellet tile that isn't surround by walls
            // on the left and right
            y = subrows-14;
            setTile(i, y, ' ');
            j = 1;
            while (getTile(i,y+j) == '.' &&
                    getTile(i-1,y+j) == '|' &&
                    getTile(i+1,y+j) == '|') {
                setTile(i,y+j,' ');
                j++;
            }

            // erase pellets from top of the ghost house proceeding up until
            // reaching a pellet tile that isn't surround by walls
            // on the left and right
            y = subrows-20;
            setTile(i, y, ' ');
            j = 1;
            while (getTile(i,y-j) == '.' &&
                    getTile(i-1,y-j) == '|' &&
                    getTile(i+1,y-j) == '|') {
                setTile(i,y-j,' ');
                j++;
            }
        }
        // erase pellets on the side of the ghost house
        for (i=0; i<7; i++) {

            // erase pellets from side of the ghost house proceeding right until
            // reaching a pellet tile that isn't surround by walls
            // on the top and bottom.
            x = 6;
            y = subrows-14-i;
            setTile(x, y, ' ');
            j = 1;
            while (getTile(x+j,y) == '.' &&
                    getTile(x+j,y-1) == '|' &&
                    getTile(x+j,y+1) == '|') {
                setTile(x+j,y,' ');
                j++;
            }
        }

        // return a tile string (3 empty lines on top and 2 on bottom)
        return (
            "____________________________" +
            "____________________________" +
            "____________________________" +
            tiles.join("") +
            "____________________________" +
            "____________________________");
    };

    var randomColor = function() {
        return '#'+('00000'+(Math.random()*(1<<24)|0).toString(16)).slice(-6);
    };

    // dijkstra's algorithm to find shortest path to all tiles from (x0,y0)
    // we also remove (destroyX,destroyY) from the map to try to constrain the path
    // from going a certain way from the start.
    // (We created this because the ghost's minimum distance direction is not always sufficient in procedural maps)
    var getShortestDistGraph = function(map,x0,y0,isNodeTile) {

        // build graph
        var graph = {};
        var x,y,i,j;
        for (y=0; y<36; y++) {
            for (x=0; x<28; x++) {
                if (isNodeTile(x,y)) {
                    i = x+y*28;
                    graph[i] = {'x':x, 'y':y, 'dist':Infinity, 'penult':undefined, 'neighbors':[], 'completed':false};
                    if (isNodeTile(x-1,y)) {
                        j = i-1;
                        graph[i].neighbors.push(graph[j]);
                        graph[j].neighbors.push(graph[i]);
                    }
                    if (isNodeTile(x,y-1)) {
                        j = i-28;
                        graph[i].neighbors.push(graph[j]);
                        graph[j].neighbors.push(graph[i]);
                    }
                }
            }
        }

        var node = graph[x0+y0*28];
        node.completed = true;
        node.dist = 0;
        var d;
        var next_node,min_dist,dist;
        while (true) {

            // update distances of current node's neighbors
            for (i=0; i<4; i++) {
                d = node.neighbors[i];
                if (d && !d.completed) {
                    dist = node.dist+1;
                    if (dist == d.dist) {
                        if (Math.random() < 0.5) {
                            d.penult = node;
                        }
                    }
                    else if (dist < d.dist) {
                        d.dist = dist;
                        d.penult = node;
                    }
                }
            }

            // find next node to process (closest fringe node)
            next_node = undefined;
            min_dist = Infinity;
            for (i=0; i<28*36; i++) {
                d = graph[i];
                if (d && !d.completed) {
                    if (d.dist < min_dist) { 
                        next_node = d;
                        min_dist = d.dist;
                    }
                }
            }

            if (!next_node) {
                break;
            }

            node = next_node;
            node.completed = true;
        }

        return graph;
    };

    // retrieves the direction enum from a node's penultimate node to itself.
    var getDirFromPenult = function(node) {
        if (!node.penult) {
            return undefined;
        }
        var dx = node.x - node.penult.x;
        var dy = node.y - node.penult.y;
        if (dy == -1) {
            return DIR_UP;
        }
        else if (dy == 1) {
            return DIR_DOWN;
        }
        else if (dx == -1) {
            return DIR_LEFT;
        }
        else if (dx == 1) {
            return DIR_RIGHT;
        }
    };

    // sometimes the ghosts can get stuck in loops when trying to return home
    // so we build a path from all tiles to the ghost door tile
    var makeExitPaths = function(map) {
        var isNodeTile = function(x,y) {
            if (x<0 || x>=28 || y<0 || y>=36) {
                return false;
            }
            return map.isFloorTile(x,y);
        };
        var graph = getShortestDistGraph(map,map.doorTile.x,map.doorTile.y,isNodeTile);

        // give the map a function that tells the ghost which direction to go to return home
        map.getExitDir = function(x,y) {
            if (x<0 || x>=28 || y<0 || y>=36) {
                return undefined;
            }
            var node = graph[x+y*28];
            var dirEnum = getDirFromPenult(node);
            if (dirEnum != undefined) {
                return rotateAboutFace(dirEnum); // reverse direction (door->ghost to door<-ghost)
            }
        };
    };

    // add fruit paths to a map
    var makeFruitPaths = (function(){
        var reversed = {
            'v':'^',
            '^':'v',
            '<':'>',
            '>':'<',
        };
        var reversePath = function(path) {
            var rpath = "";
            var i;
            for (i=path.length-1; i>=0; i--) {
                rpath += reversed[path[i]];
            }
            return rpath;
        };

        var dirChars = {};
        dirChars[DIR_UP] = '^';
        dirChars[DIR_DOWN] = 'v';
        dirChars[DIR_LEFT] = '<';
        dirChars[DIR_RIGHT] = '>';

        var getPathFromGraph = function(graph,x0,y0,x1,y1,reverse) {
            // from (x0,y0) to (x1,y1)
            var start_node = graph[x0+y0*28];
            var dx,dy;
            var path = "";
            var node;
            for (node=graph[x1+y1*28]; node!=start_node; node=node.penult) {
                path = dirChars[getDirFromPenult(node)] + path;
            }
            return reverse ? reversePath(path) : path;
        }

        return function(map) {

            paths = {entrances:[], exits:[]};

            var isFloorTile = function(x,y) {
                if (x<0 || x>=28 || y<0 || y>=36) {
                    return false
                }
                return map.isFloorTile(x,y);
            };

            enter_graph = getShortestDistGraph(map,15,20, function(x,y) { return (x==14 && y==20) ? false : isFloorTile(x,y); });
            exit_graph =  getShortestDistGraph(map,16,20, function(x,y) { return (x==17 && y==20) ? false : isFloorTile(x,y); });

            // start at (15,20)
            for (y=0; y<36; y++) {
                if (map.isFloorTile(-1,y)) {

                    // left entrance
                    paths.entrances.push({
                        'start': {'y':y*8+4, 'x': -4},
                        'path': '>'+getPathFromGraph(enter_graph, 15,20, 0,y, true)});

                    // right entrance
                    paths.entrances.push({
                        'start': {'y':y*8+4, 'x': 28*8+4},
                        'path': '<'+getPathFromGraph(enter_graph, 15,20, 27,y, true)});

                    // left exit
                    paths.exits.push({
                        'start': {'y':y*8+4, 'x': -4},
                        'path': getPathFromGraph(exit_graph, 16,20, 0,y, false)+'<'});

                    // right exit
                    paths.exits.push({
                        'start': {'y':y*8+4, 'x': 28*8+4},
                        'path': getPathFromGraph(exit_graph, 16,20, 27,y, false)+'>'});
                }
            }

            map.fruitPaths = paths;
        };
    })();

    return function() {
        genRandom();
        var map = new Map(28,36,getTiles());

        makeFruitPaths(map);
        makeExitPaths(map);

        map.name = "Random Map";
        map.wallFillColor = randomColor();
        map.wallStrokeColor = rgbString(hslToRgb(Math.random(), Math.random(), Math.random() * 0.4 + 0.6));
        map.pelletColor = "#ffb8ae";

        return map;
    };
})();

var atlas = (function(){

    var canvas,ctx;
    var size = 22;
    var cols = 14; // has to be ONE MORE than intended to fix some sort of CHROME BUG (last cell always blank?)
    var rows = 22;

    var creates = 0;

    var drawGrid = function() {
        // draw grid overlay
        var canvas = document.getElementById('gridcanvas');
        if (!canvas) {
            return;
        }
        var w = size*cols*renderScale;
        var h = size*rows*renderScale;
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.clearRect(0,0,w,h);
        var x,y;
        var step = size*renderScale;
        ctx.beginPath();
        for (x=0; x<=w; x+=step) {
            ctx.moveTo(x,0);
            ctx.lineTo(x,h);
        }
        for (y=0; y<=h; y+=step) {
            ctx.moveTo(0,y);
            ctx.lineTo(w,y);
        }
        ctx.lineWidth = "1px";
        ctx.lineCap = "square";
        ctx.strokeStyle="rgba(255,255,255,0.5)";
        ctx.stroke();
    };

    var create = function() {
        drawGrid();
        canvas = document.getElementById('atlas');
        ctx = canvas.getContext("2d");
        /*
        canvas.style.left = 0;
        canvas.style.top = 0;
        canvas.style.position = "absolute";
        */

        var w = size*cols*renderScale;
        var h = size*rows*renderScale;
        canvas.width = w;
        canvas.height = h;

        if (creates > 0) {
            ctx.restore();
        }
        creates++;

        ctx.save();
        ctx.clearRect(0,0,w,h);
        ctx.scale(renderScale,renderScale);

        var drawAtCell = function(f,row,col) {
            var x = col*size + size/2;
            var y = row*size + size/2;
            f(x,y);
        };

        var row = 0;
        drawAtCell(function(x,y) { drawCherry(ctx,x,y); },      row,0);
        drawAtCell(function(x,y) { drawStrawberry(ctx,x,y); },  row,1);
        drawAtCell(function(x,y) { drawOrange(ctx,x,y); },      row,2);
        drawAtCell(function(x,y) { drawApple(ctx,x,y); },       row,3);
        drawAtCell(function(x,y) { drawMelon(ctx,x,y); },       row,4);
        drawAtCell(function(x,y) { drawGalaxian(ctx,x,y); },    row,5);
        drawAtCell(function(x,y) { drawBell(ctx,x,y); },        row,6);
        drawAtCell(function(x,y) { drawKey(ctx,x,y); },         row,7);
        drawAtCell(function(x,y) { drawPretzel(ctx,x,y); },     row,8);
        drawAtCell(function(x,y) { drawPear(ctx,x,y); },        row,9);
        drawAtCell(function(x,y) { drawBanana(ctx,x,y); },      row,10);
        drawAtCell(function(x,y) { drawCookie(ctx,x,y); },      row,11);
        drawAtCell(function(x,y) { drawCookieFlash(ctx,x,y); },      row,12);

        var drawGhostCells = function(row,color) {
            var i,f;
            var col = 0;
            for (i=0; i<4; i++) { // dirEnum
                for (f=0; f<2; f++) { // frame
                    drawAtCell(function(x,y) { drawGhostSprite(ctx, x,y, f, i, false, false, false, color); },   row,col);
                    col++;
                }
            }
        };

        row++;
        drawGhostCells(row, "#FF0000");
        row++;
        drawGhostCells(row, "#FFB8FF");
        row++;
        drawGhostCells(row, "#00FFFF");
        row++;
        drawGhostCells(row, "#FFB851");

        row++;
        // draw disembodied eyes
        (function(){
            var i;
            var col = 0;
            for (i=0; i<4; i++) { // dirEnum
                drawAtCell(function(x,y) { drawGhostSprite(ctx, x,y, 0, i, false, false, true, "#fff"); },     row,col);
                col++;
            }
        })();

        // draw ghosts scared
        drawAtCell(function(x,y) { drawGhostSprite(ctx, x,y, 0, DIR_UP, true, false, false, "#fff"); }, row,4);
        drawAtCell(function(x,y) { drawGhostSprite(ctx, x,y, 1, DIR_UP, true, false, false, "#fff"); }, row,5);
        drawAtCell(function(x,y) { drawGhostSprite(ctx, x,y, 0, DIR_UP, true, true, false, "#fff"); },  row,6);
        drawAtCell(function(x,y) { drawGhostSprite(ctx, x,y, 1, DIR_UP, true, true, false, "#fff"); },  row,7);

        var drawPacCells = function(row,col,dir) {
            drawAtCell(function(x,y) { drawPacmanSprite(ctx, x,y, dir, Math.PI/6); }, row, col);
            drawAtCell(function(x,y) { drawPacmanSprite(ctx, x,y, dir, Math.PI/3); }, row, col+1);
        };
        row++;

        // draw pacman mouth closed
        drawAtCell(function(x,y) { drawPacmanSprite(ctx, x,y, DIR_RIGHT, 0); }, row, 0);

        // draw pacman directions
        (function(){
            var i;
            var col=1;
            for (i=0; i<4; i++) {
                drawPacCells(row,col,i);
                col+=2;
            }
        })();

        var drawMsPacCells = function(row,col,dir) {
            drawAtCell(function(x,y) { drawMsPacmanSprite(ctx, x,y, dir, 0); }, row, col);
            drawAtCell(function(x,y) { drawMsPacmanSprite(ctx, x,y, dir, 1); }, row, col+1);
            drawAtCell(function(x,y) { drawMsPacmanSprite(ctx, x,y, dir, 2); }, row, col+2);
        };
        row++;
        (function(){
            var i;
            var col=0;
            for (i=0; i<4; i++) {
                drawMsPacCells(row,col,i);
                col+=3;
            }
        })();

        var drawCookieCells = function(row,col,dir) {
            drawAtCell(function(x,y) { drawCookiemanSprite(ctx, x,y, dir, 0, true); }, row, col);
            drawAtCell(function(x,y) { drawCookiemanSprite(ctx, x,y, dir, 1, true); }, row, col+1);
            drawAtCell(function(x,y) { drawCookiemanSprite(ctx, x,y, dir, 2, true); }, row, col+2);
        };
        row++;
        (function(){
            var i;
            var col=0;
            for (i=0; i<4; i++) {
                drawCookieCells(row,col,i);
                col+=3;
            }
        })();

        var drawMonsterCells = function(row,color) {
            var i,f;
            var col=0;
            for (i=0; i<4; i++) { // dirEnum
                for (f=0; f<2; f++) { // frame
                    drawAtCell(function(x,y) { drawMonsterSprite(ctx, x,y, f, i, false, false, false, color); },   row,col);
                    col++;
                }
            }
        };

        row++;
        drawMonsterCells(row, "#FF0000");
        row++;
        drawMonsterCells(row, "#FFB8FF");
        row++;
        drawMonsterCells(row, "#00FFFF");
        row++;
        drawMonsterCells(row, "#FFB851");

        row++;
        (function(){
            var i;
            var col = 0;
            for (i=0; i<4; i++) { // dirEnum
                drawAtCell(function(x,y) { drawMonsterSprite(ctx, x,y, 0, i, false, false, true, "#fff"); },     row,col);
                col++;
            }
        })();
        drawAtCell(function(x,y) { drawMonsterSprite(ctx, x,y, 0, DIR_UP, true, false, false, "#fff"); }, row,4);
        drawAtCell(function(x,y) { drawMonsterSprite(ctx, x,y, 1, DIR_UP, true, false, false, "#fff"); }, row,5);
        drawAtCell(function(x,y) { drawMonsterSprite(ctx, x,y, 0, DIR_UP, true, true, false, "#fff"); },  row,6);
        drawAtCell(function(x,y) { drawMonsterSprite(ctx, x,y, 1, DIR_UP, true, true, false, "#fff"); },  row,7);

        var drawOttoCells = function(row,col,dir) {
            var i;
            for (i=0; i<4; i++) { // frame
                drawAtCell(function(x,y) { drawOttoSprite(ctx, x,y, dir, i); }, row, col);
                col++;
            }
        };
        row++;
        drawOttoCells(row,0, DIR_UP);
        drawOttoCells(row,4, DIR_RIGHT);
        row++;
        drawOttoCells(row,0, DIR_DOWN);
        drawOttoCells(row,4, DIR_LEFT);

        row++;
        drawAtCell(function(x,y) { drawPacPoints(ctx, x,y, 200, "#33ffff"); }, row, 0);
        drawAtCell(function(x,y) { drawPacPoints(ctx, x,y, 400, "#33ffff"); }, row, 1);
        drawAtCell(function(x,y) { drawPacPoints(ctx, x,y, 800, "#33ffff"); }, row, 2);
        drawAtCell(function(x,y) { drawPacPoints(ctx, x,y, 1600, "#33ffff");}, row, 3);
        drawAtCell(function(x,y) { drawPacPoints(ctx, x,y, 100, "#ffb8ff"); }, row, 4);
        drawAtCell(function(x,y) { drawPacPoints(ctx, x,y, 300, "#ffb8ff"); }, row, 5);
        drawAtCell(function(x,y) { drawPacPoints(ctx, x,y, 500, "#ffb8ff"); }, row, 6);
        drawAtCell(function(x,y) { drawPacPoints(ctx, x,y, 700, "#ffb8ff"); }, row, 7);
        drawAtCell(function(x,y) { drawPacPoints(ctx, x,y, 1000, "#ffb8ff"); }, row, 8);
        drawAtCell(function(x,y) { drawPacPoints(ctx, x,y, 2000, "#ffb8ff"); }, row, 9);
        drawAtCell(function(x,y) { drawPacPoints(ctx, x,y, 3000, "#ffb8ff"); }, row, 10);
        drawAtCell(function(x,y) { drawPacPoints(ctx, x,y, 5000, "#ffb8ff"); }, row, 11);
        row++;
        drawAtCell(function(x,y) { drawMsPacPoints(ctx, x,y, 100, "#fff"); }, row, 0);
        drawAtCell(function(x,y) { drawMsPacPoints(ctx, x,y, 200, "#fff"); }, row, 1);
        drawAtCell(function(x,y) { drawMsPacPoints(ctx, x,y, 500, "#fff"); }, row, 2);
        drawAtCell(function(x,y) { drawMsPacPoints(ctx, x,y, 700, "#fff"); }, row, 3);
        drawAtCell(function(x,y) { drawMsPacPoints(ctx, x,y, 1000, "#fff"); }, row, 4);
        drawAtCell(function(x,y) { drawMsPacPoints(ctx, x,y, 2000, "#fff"); }, row, 5);
        drawAtCell(function(x,y) { drawMsPacPoints(ctx, x,y, 5000, "#fff"); }, row, 6);

        row++;
        drawAtCell(function(x,y) {
            drawSnail(ctx,x,y, "#0ff");
        }, row, 0);
        drawAtCell(function(x,y) {
            drawSnail(ctx,x,y, "#FFF");
        }, row, 1);

        var drawMsOttoCells = function(row,col,dir) {
            var i;
            for (i=0; i<4; i++) { // frame
                drawAtCell(function(x,y) { drawMsOttoSprite(ctx, x,y, dir, i); }, row, col);
                col++;
            }
        };
        row++;
        drawMsOttoCells(row,0, DIR_UP);
        drawMsOttoCells(row,4, DIR_RIGHT);
        row++;
        drawMsOttoCells(row,0, DIR_DOWN);
        drawMsOttoCells(row,4, DIR_LEFT);

    };

    var copyCellTo = function(row, col, destCtx, x, y,display) {
        var sx = col*size*renderScale;
        var sy = row*size*renderScale;
        var sw = renderScale*size;
        var sh = renderScale*size;

        var dx = x - size/2;
        var dy = y - size/2;
        var dw = size;
        var dh = size;

        if (display) {
            console.log(sx,sy,sw,sh,dw,dy,dw,dh);
        }

        destCtx.drawImage(canvas,sx,sy,sw,sh,dx,dy,dw,dh);
    };

    var copyGhostPoints = function(destCtx,x,y,points) {
        var row = 16;
        var col = {
            200: 0,
            400: 1,
            800: 2,
            1600: 3,
        }[points];
        if (col != undefined) {
            copyCellTo(row, col, destCtx, x, y);
        }
    };

    var copyPacFruitPoints = function(destCtx,x,y,points) {
        var row = 16;
        var col = {
            100: 4,
            300: 5,
            500: 6,
            700: 7,
            1000: 8,
            2000: 9,
            3000: 10,
            5000: 11,
        }[points];
        if (col != undefined) {
            copyCellTo(row, col, destCtx, x, y);
        }
    };

    var copyMsPacFruitPoints = function(destCtx,x,y,points) {
        var row = 17;
        var col = {
            100: 0,
            200: 1,
            500: 2,
            700: 3,
            1000: 4,
            2000: 5,
            5000: 6,
        }[points];
        if (col != undefined) {
            copyCellTo(row, col, destCtx, x, y);
        }
    };

    var copyGhostSprite = function(destCtx,x,y,frame,dirEnum,scared,flash,eyes_only,color) {
        var row,col;
        if (eyes_only) {
            row = 5;
            col = dirEnum;
        }
        else if (scared) {
            row = 5;
            col = flash ? 6 : 4;
            col += frame;
        }
        else {
            col = dirEnum*2 + frame;
            if (color == blinky.color) {
                row = 1;
            }
            else if (color == pinky.color) {
                row = 2;
            }
            else if (color == inky.color) {
                row = 3;
            }
            else if (color == clyde.color) {
                row = 4;
            }
            else {
                row = 5;
            }
        }

        copyCellTo(row, col, destCtx, x, y);
    };

    var copyMuppetSprite = function(destCtx,x,y,frame,dirEnum,scared,flash,eyes_only,color) {
        if (scared) {
            if (flash) {
                copyFruitSprite(destCtx,x,y,"cookieface");
            }
            else {
                copyFruitSprite(destCtx,x,y,"cookie");
            }
        }
        else {
            copyGhostSprite(destCtx,x,y,frame,dirEnum,scared,flash,eyes_only,color);
        }
    };

    var copyMonsterSprite = function(destCtx,x,y,frame,dirEnum,scared,flash,eyes_only,color) {
        var row,col;
        if (eyes_only) {
            row = 13;
            col = dirEnum;
        }
        else if (scared) {
            row = 13;
            col = flash ? 6 : 4;
            col += frame;
        }
        else {
            col = dirEnum*2 + frame;
            if (color == blinky.color) {
                row = 9;
            }
            else if (color == pinky.color) {
                row = 10;
            }
            else if (color == inky.color) {
                row = 11;
            }
            else if (color == clyde.color) {
                row = 12;
            }
            else {
                row = 13;
            }
        }

        copyCellTo(row, col, destCtx, x, y);
    };

    var copyOttoSprite = function(destCtx,x,y,dirEnum,frame) {
        var col,row;
        if (dirEnum == DIR_UP) {
            col = frame;
            row = 14;
        }
        else if (dirEnum == DIR_RIGHT) {
            col = frame+4;
            row = 14;
        }
        else if (dirEnum == DIR_DOWN) {
            col = frame;
            row = 15;
        }
        else if (dirEnum == DIR_LEFT) {
            col = frame+4;
            row = 15;
        }
        copyCellTo(row,col,destCtx,x,y);
    };

    var copyMsOttoSprite = function(destCtx,x,y,dirEnum,frame) {
        var col,row;
        if (dirEnum == DIR_UP) {
            col = frame;
            row = 19;
        }
        else if (dirEnum == DIR_RIGHT) {
            col = frame+4;
            row = 19;
        }
        else if (dirEnum == DIR_DOWN) {
            col = frame;
            row = 20;
        }
        else if (dirEnum == DIR_LEFT) {
            col = frame+4;
            row = 20;
        }
        copyCellTo(row,col,destCtx,x,y);
    };

    var copySnail = function(destCtx,x,y,frame) {
        var row = 18;
        var col = frame;
        copyCellTo(row,col,destCtx,x,y);
    };

    var copyPacmanSprite = function(destCtx,x,y,dirEnum,frame) {
        var row = 6;
        var col;
        if (frame == 0) {
            col = 0;
        }
        else {
           col = dirEnum*2+1+(frame-1);
        }
        copyCellTo(row,col,destCtx,x,y);
    };

    var copyMsPacmanSprite = function(destCtx,x,y,dirEnum,frame) {
        // TODO: determine row, col
        //copyCellTo(row,col,destCtx,x,y);
        var row = 7;
        var col = dirEnum*3+frame;
        copyCellTo(row,col,destCtx,x,y);
    };

    var copyCookiemanSprite = function(destCtx,x,y,dirEnum,frame) {
        var row = 8;
        var col = dirEnum*3+frame;
        copyCellTo(row,col,destCtx,x,y);
    };

    var copyFruitSprite = function(destCtx,x,y,name) {
        var row = 0;
        var col = {
            "cherry": 0,
            "strawberry": 1,
            "orange": 2,
            "apple": 3,
            "melon": 4,
            "galaxian": 5,
            "bell": 6,
            "key": 7,
            "pretzel": 8,
            "pear": 9,
            "banana": 10,
            "cookie": 11,
            "cookieface": 12,
        }[name];

        copyCellTo(row,col,destCtx,x,y);
    };

    return {
        create: create,
        getCanvas: function() { return canvas; },
        drawGhostSprite: copyGhostSprite,
        drawMonsterSprite: copyMonsterSprite,
        drawMuppetSprite: copyMuppetSprite,
        drawOttoSprite: copyOttoSprite,
        drawMsOttoSprite: copyMsOttoSprite,
        drawPacmanSprite: copyPacmanSprite,
        drawMsPacmanSprite: copyMsPacmanSprite,
        drawCookiemanSprite: copyCookiemanSprite,
        drawFruitSprite: copyFruitSprite,
        drawGhostPoints: copyGhostPoints,
        drawPacFruitPoints: copyPacFruitPoints,
        drawMsPacFruitPoints: copyMsPacFruitPoints,
        drawSnail: copySnail,
    };
})();
//////////////////////////////////////////////////////////////
// Renderers

// Draws everything in the game using swappable renderers
// to enable to different front-end displays for Pac-Man.

// list of available renderers
var renderer_list;

// current renderer
var renderer;

var renderScale;

var mapMargin = 4*tileSize; // margin between the map and the screen
var mapPad = tileSize/8; // padding between the map and its clipping

var mapWidth = 28*tileSize+mapPad*2;
var mapHeight = 36*tileSize+mapPad*2;

var screenWidth = mapWidth+mapMargin*2;
var screenHeight = mapHeight+mapMargin*2;

// all rendering will be shown on this canvas
var canvas;

// switch to the given renderer index
var switchRenderer = function(i) {
    renderer = renderer_list[i];
    renderer.drawMap();
};

var getDevicePixelRatio = function() {
    // Only consider the device pixel ratio for devices that are <= 320 pixels in width.
    // This is necessary for the iPhone4's retina display; otherwise the game would be blurry.
    // The iPad3's retina display @ 2048x1536 starts slowing the game down.
    return 1;
    if (window.innerWidth <= 320) {
        return window.devicePixelRatio || 1;
    }
    return 1;
};

var initRenderer = function(){

    var bgCanvas;
    var ctx, bgCtx;

    // drawing scale
    var scale = 2;        // scale everything by this amount

    // (temporary global version of scale just to get things quickly working)
    renderScale = scale; 

    var resets = 0;

    // rescale the canvases
    var resetCanvasSizes = function() {

        // set the size of the canvas in actual pixels
        canvas.width = screenWidth * scale;
        canvas.height = screenHeight * scale;

        // set the size of the canvas in browser pixels
        var ratio = getDevicePixelRatio();
        canvas.style.width = canvas.width / ratio;
        canvas.style.height = canvas.height / ratio;

        if (resets > 0) {
            ctx.restore();
        }
        ctx.save();
        ctx.scale(scale,scale);

        bgCanvas.width = mapWidth * scale;
        bgCanvas.height = mapHeight * scale;
        if (resets > 0) {
            bgCtx.restore();
        }
        bgCtx.save();
        bgCtx.scale(scale,scale);

        resets++;
    };

    // get the target scale that will cause the canvas to fit the window
    var getTargetScale = function() {
        var sx = (window.innerWidth - 10) / screenWidth;
        var sy = (window.innerHeight - 10) / screenHeight;
        var s = Math.min(sx,sy);
        s *= getDevicePixelRatio();
        return s;
    };

    // maximize the scale to fit the window
    var fullscreen = function() {
        // NOTE: css-scaling alternative at https://gist.github.com/1184900
        renderScale = scale = getTargetScale();
        resetCanvasSizes();
        atlas.create();
        if (renderer) {
            renderer.drawMap();
        }
        center();
    };

    // center the canvas in the window
    var center = function() {
        var s = getTargetScale()/getDevicePixelRatio();
        var w = screenWidth*s;
        var x = Math.max(0,(window.innerWidth-10)/2 - w/2);
        var y = 0;
        /*
        canvas.style.position = "absolute";
        canvas.style.left = x;
        canvas.style.top = y;
        console.log(canvas.style.left);
        */
        document.body.style.marginLeft = (window.innerWidth - w)/2 + "px";
    };

    // create foreground and background canvases
    canvas = document.getElementById('canvas');
    bgCanvas = document.createElement('canvas');
    ctx = canvas.getContext("2d");
    bgCtx = bgCanvas.getContext("2d");

    // initialize placement and size
    fullscreen();

    // adapt placement and size to window resizes
    var resizeTimeout;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(fullscreen, 100);
    }, false);

    //////////////////////

    var beginMapFrame = function() {
        bgCtx.fillStyle = "#000";
        bgCtx.fillRect(0,0,mapWidth,mapHeight);
        bgCtx.translate(mapPad, mapPad);
    };

    var endMapFrame = function() {
        bgCtx.translate(-mapPad, -mapPad);
    };

    //////////////////////////////////////////////////////////////
    // Common Renderer
    // (attributes and functionality that are currently common to all renderers)

    // constructor
    var CommonRenderer = function() {
        this.actorSize = (tileSize-1)*2;
        this.energizerSize = tileSize+2;
        this.pointsEarnedTextSize = tileSize;

        this.energizerColor = "#FFF";
        this.pelletColor = "#888";

        this.flashLevel = false;
    };

    CommonRenderer.prototype = {

        setOverlayColor: function(color) {
            this.overlayColor = color;
        },

        beginMapClip: function() {
            ctx.save();
            ctx.beginPath();

            // subtract one from size due to shift done for sprite realignment?
            // (this fixes a bug that leaves unerased artifacts after actors use right-side tunnel
            ctx.rect(-mapPad,-mapPad,mapWidth-1,mapHeight-1); 

            ctx.clip();
        },

        endMapClip: function() {
            ctx.restore();
        },

        beginFrame: function() {
            this.setOverlayColor(undefined);
            ctx.save();

            // clear margin area
            ctx.fillStyle = "#000";
            (function(w,h,p){
                ctx.fillRect(0,0,w,p+1);
                ctx.fillRect(0,p,p,h-2*p);
                ctx.fillRect(w-p-2,p,p+2,h-2*p);
                ctx.fillRect(0,h-p-2,w,p+2);
            })(screenWidth, screenHeight, mapMargin);

            // draw fps
            if (DEBUG) {
                ctx.font = (tileSize-2) + "px ArcadeR";
                ctx.textBaseline = "bottom";
                ctx.textAlign = "right";
                ctx.fillStyle = "#333";
                ctx.fillText(Math.floor(executive.getFps())+" FPS", screenWidth, screenHeight);
            }

            // translate to map space
            ctx.translate(mapMargin+mapPad, mapMargin+mapPad);
        },

        endFrame: function() {
            ctx.restore();
            if (this.overlayColor != undefined) {
                ctx.fillStyle = this.overlayColor;
                ctx.fillRect(0,0,screenWidth,screenHeight);
            }
        },

        clearMapFrame: function() {
            ctx.fillStyle = "#000";
            ctx.fillRect(-1,-1,mapWidth+1,mapHeight+1);
        },

        renderFunc: function(f,that) {
            if (that) {
                f.call(that,ctx);
            }
            else {
                f(ctx);
            }
        },

        // scaling the canvas can incur floating point roundoff errors
        // which manifest as "grout" between tiles that are otherwise adjacent in integer-space
        // This function extends the width and height of the tile if it is adjacent to equivalent tiles
        // that are to the bottom or right of the given tile
        drawNoGroutTile: function(ctx,x,y,w) {
            var tileChar = map.getTile(x,y);
            this.drawCenterTileSq(ctx,x,y,tileSize,
                    map.getTile(x+1,y) == tileChar,
                    map.getTile(x,y+1) == tileChar,
                    map.getTile(x+1,y+1) == tileChar);
        },

        // draw square centered at the given tile with optional "floating point grout" filling
        drawCenterTileSq: function (ctx,tx,ty,w, rightGrout, downGrout, downRightGrout) {
            this.drawCenterPixelSq(ctx, tx*tileSize+midTile.x, ty*tileSize+midTile.y,w,
                    rightGrout, downGrout, downRightGrout);
        },

        // draw square centered at the given pixel
        drawCenterPixelSq: function (ctx,px,py,w,rightGrout, downGrout, downRightGrout) {
            ctx.fillRect(px-w/2, py-w/2,w,w);

            // fill "floating point grout" gaps between tiles
            var gap = 1;
            if (rightGrout) ctx.fillRect(px-w/2, py-w/2,w+gap,w);
            if (downGrout) ctx.fillRect(px-w/2, py-w/2,w,w+gap);
            //if (rightGrout && downGrout && downRightGrout) ctx.fillRect(px-w/2, py-w/2,w+gap,w+gap);
        },

        // this flag is used to flash the level upon its successful completion
        toggleLevelFlash: function () {
            this.flashLevel = !this.flashLevel;
        },

        setLevelFlash: function(on) {
            if (on != this.flashLevel) {
                this.flashLevel = on;
                this.drawMap();
            }
        },

        // draw the target visualizers for each actor
        drawTargets: function() {
            var i;
            ctx.strokeStyle = "rgba(255,255,255,0.5)";
            ctx.lineWidth = "1.5";
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            for (i=0;i<5;i++)
                if (actors[i].isDrawTarget)
                    actors[i].drawTarget(ctx);
        },

        drawPaths: function() {
            var backupAlpha = ctx.globalAlpha;
            ctx.globalAlpha = 0.7;
            var i;
            for (i=0;i<5;i++)
                if (actors[i].isDrawPath)
                    this.drawPath(actors[i]);
            ctx.globalAlpha = backupAlpha;
        },

        // draw a predicted path for the actor if it continues pursuing current target
        drawPath: function(actor) {
            if (!actor.targetting) return;

            // current state of the predicted path
            var tile = { x: actor.tile.x, y: actor.tile.y};
            var target = actor.targetTile;
            var dir = { x: actor.dir.x, y: actor.dir.y };
            var dirEnum = actor.dirEnum;
            var openTiles;

            // exit if we're already on the target
            if (tile.x == target.x && tile.y == target.y) {
                return;
            }

            // if we are past the center of the tile, we cannot turn here anymore, so jump to next tile
            if ((dirEnum == DIR_UP && actor.tilePixel.y <= midTile.y) ||
                (dirEnum == DIR_DOWN && actor.tilePixel.y >= midTile.y) ||
                (dirEnum == DIR_LEFT && actor.tilePixel.x <= midTile.x) ||
                (dirEnum == DIR_RIGHT & actor.tilePixel.x >= midTile.x)) {
                tile.x += dir.x;
                tile.y += dir.y;
            }
            var pixel = { x:tile.x*tileSize+midTile.x, y:tile.y*tileSize+midTile.y };
            
            // dist keeps track of how far we're going along this path, stopping at maxDist
            // distLeft determines how long the last line should be
            var dist = Math.abs(tile.x*tileSize+midTile.x - actor.pixel.x + tile.y*tileSize+midTile.y - actor.pixel.y);
            var maxDist = actorPathLength*tileSize;
            var distLeft;
            
            // add the first line
            ctx.strokeStyle = actor.pathColor;
            ctx.lineWidth = "2.0";
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.beginPath();
            ctx.moveTo(
                    actor.pixel.x+actor.pathCenter.x,
                    actor.pixel.y+actor.pathCenter.y);
            ctx.lineTo(
                    pixel.x+actor.pathCenter.x,
                    pixel.y+actor.pathCenter.y);

            if (tile.x == target.x && tile.y == target.y) {
                // adjust the distance left to create a smoothly interpolated path end
                distLeft = actor.getPathDistLeft(pixel, dirEnum);
            }
            else while (true) {

                // predict next turn from current tile
                openTiles = getOpenTiles(tile, dirEnum);
                if (actor != pacman && map.constrainGhostTurns)
                    map.constrainGhostTurns(tile, openTiles, dirEnum);
                dirEnum = getTurnClosestToTarget(tile, target, openTiles);
                setDirFromEnum(dir,dirEnum);
                
                // if the next tile is our target, determine how mush distance is left and break loop
                if (tile.x+dir.x == target.x && tile.y+dir.y == target.y) {
                
                    // adjust the distance left to create a smoothly interpolated path end
                    distLeft = actor.getPathDistLeft(pixel, dirEnum);

                    // cap distance left
                    distLeft = Math.min(maxDist-dist, distLeft);

                    break;
                }
                
                // exit if we're going past the max distance
                if (dist + tileSize > maxDist) {
                    distLeft = maxDist - dist;
                    break;
                }

                // move to next tile and add a line to its center
                tile.x += dir.x;
                tile.y += dir.y;
                pixel.x += tileSize*dir.x;
                pixel.y += tileSize*dir.y;
                dist += tileSize;
                ctx.lineTo(
                        tile.x*tileSize+midTile.x+actor.pathCenter.x,
                        tile.y*tileSize+midTile.y+actor.pathCenter.y);
            }

            // calculate final endpoint
            var px = pixel.x+actor.pathCenter.x+distLeft*dir.x;
            var py = pixel.y+actor.pathCenter.y+distLeft*dir.y;

            // add an arrow head
            ctx.lineTo(px,py);
            var s = 3;
            if (dirEnum == DIR_LEFT || dirEnum == DIR_RIGHT) {
                ctx.lineTo(px-s*dir.x,py+s*dir.x);
                ctx.moveTo(px,py);
                ctx.lineTo(px-s*dir.x,py-s*dir.x);
            }
            else {
                ctx.lineTo(px+s*dir.y,py-s*dir.y);
                ctx.moveTo(px,py);
                ctx.lineTo(px-s*dir.y,py-s*dir.y);
            }

            // draw path    
            ctx.stroke();
        },

        // erase pellet from background
        erasePellet: function(x,y) {
            bgCtx.translate(mapPad,mapPad);
            bgCtx.fillStyle = this.floorColor;
            this.drawNoGroutTile(bgCtx,x,y,tileSize);

            // fill in adjacent floor tiles
            if (map.getTile(x+1,y)==' ') this.drawNoGroutTile(bgCtx,x+1,y,tileSize);
            if (map.getTile(x-1,y)==' ') this.drawNoGroutTile(bgCtx,x-1,y,tileSize);
            if (map.getTile(x,y+1)==' ') this.drawNoGroutTile(bgCtx,x,y+1,tileSize);
            if (map.getTile(x,y-1)==' ') this.drawNoGroutTile(bgCtx,x,y-1,tileSize);

            // TODO: fill in adjacent wall tiles?

            bgCtx.translate(-mapPad,-mapPad);
        },

        // draw a center screen message (e.g. "start", "ready", "game over")
        drawMessage: function(text, color, x,y) {
            ctx.font = tileSize + "px ArcadeR";
            ctx.textBaseline = "top";
            ctx.textAlign = "right";
            ctx.fillStyle = color;
            x += text.length;
            ctx.fillText(text, x*tileSize, y*tileSize);
        },

        drawReadyMessage: function() {
            this.drawMessage("READY ","#FF0",11,20);
            drawExclamationPoint(ctx,16*tileSize+3, 20*tileSize+3);
        },

        // draw the points earned from the most recently eaten ghost
        drawEatenPoints: function() {
            atlas.drawGhostPoints(ctx, pacman.pixel.x, pacman.pixel.y, energizer.getPoints());
        },

        // draw each actor (ghosts and pacman)
        drawActors: function() {
            var i;
            // draw such that pacman appears on top
            if (energizer.isActive()) {
                for (i=0; i<4; i++) {
                    this.drawGhost(ghosts[i]);
                }
                if (!energizer.showingPoints())
                    this.drawPlayer();
                else
                    this.drawEatenPoints();
            }
            // draw such that pacman appears on bottom
            else {
                this.drawPlayer();
                for (i=3; i>=0; i--) {
                    if (ghosts[i].isVisible) {
                        this.drawGhost(ghosts[i]);
                    }
                }
                if (inky.isVisible && !blinky.isVisible) {
                    this.drawGhost(blinky,0.5);
                }
            }
        },

    };

    //////////////////////////////////////////////////////////////
    // Simple Renderer
    // (render a minimal Pac-Man display using nothing but squares)

    // constructor
    var SimpleRenderer = function() {

        // inherit attributes from Common Renderer
        CommonRenderer.call(this,ctx,bgCtx);

        this.messageRow = 21.7;
        this.pointsEarnedTextSize = 1.5*tileSize;

        this.backColor = "#222";
        this.floorColor = "#444";
        this.flashFloorColor = "#999";

        this.name = "Minimal";
    };

    SimpleRenderer.prototype = newChildObject(CommonRenderer.prototype, {

        drawMap: function() {

            beginMapFrame();

            var x,y;
            var i;
            var tile;

            // draw floor tiles
            bgCtx.fillStyle = (this.flashLevel ? this.flashFloorColor : this.floorColor);
            i=0;
            for (y=0; y<map.numRows; y++)
            for (x=0; x<map.numCols; x++) {
                tile = map.currentTiles[i++];
                if (tile == ' ')
                    this.drawNoGroutTile(bgCtx,x,y,tileSize);
            }

            // draw pellet tiles
            bgCtx.fillStyle = this.pelletColor;
            i=0;
            for (y=0; y<map.numRows; y++)
            for (x=0; x<map.numCols; x++) {
                tile = map.currentTiles[i++];
                if (tile == '.')
                    this.drawNoGroutTile(bgCtx,x,y,tileSize);
            }

            endMapFrame();
        },

        refreshPellet: function(x,y) {
            var i = map.posToIndex(x,y);
            var tile = map.currentTiles[i];
            if (tile == ' ') {
                this.erasePellet(x,y);
            }
            else if (tile == '.') {
                bgCtx.fillStyle = this.pelletColor;
                this.drawNoGroutTile(bgCtx,x,y,tileSize);
            }
        },


        // draw the current score and high score
        drawScore: function() {
            ctx.font = 1.5*tileSize + "px sans-serif";
            ctx.textBaseline = "top";
            ctx.textAlign = "left";
            ctx.fillStyle = "#FFF";
            ctx.fillText(getScore(), tileSize, tileSize*2);

            ctx.font = "bold " + 1.5*tileSize + "px sans-serif";
            ctx.textBaseline = "top";
            ctx.textAlign = "center";
            ctx.fillText("high score", tileSize*map.numCols/2, 3);
            ctx.fillText(getHighScore(), tileSize*map.numCols/2, tileSize*2);
        },

        // draw the extra lives indicator
        drawExtraLives: function() {
            var i;
            ctx.fillStyle = "rgba(255,255,0,0.6)";
            var lives = extraLives == Infinity ? 1 : extraLives;
            for (i=0; i<extraLives; i++)
                this.drawCenterPixelSq(ctx, (2*i+3)*tileSize, (map.numRows-2)*tileSize+midTile.y,this.actorSize);
        },

        // draw the current level indicator
        drawLevelIcons: function() {
            var i;
            ctx.fillStyle = "rgba(255,255,255,0.5)";
            var w = 2;
            var h = this.actorSize;
            for (i=0; i<level; i++)
                ctx.fillRect((map.numCols-2)*tileSize - i*2*w, (map.numRows-2)*tileSize+midTile.y-h/2, w, h);
        },

        // draw energizer items on foreground
        drawEnergizers: function() {
            ctx.fillStyle = this.energizerColor;
            var e;
            var i;
            for (i=0; i<map.numEnergizers; i++) {
                e = map.energizers[i];
                if (map.currentTiles[e.x+e.y*map.numCols] == 'o')
                    this.drawCenterTileSq(ctx,e.x,e.y,this.energizerSize);
            }
        },

        // draw pacman
        drawPlayer: function(scale, opacity) {
            if (scale == undefined) scale = 1;
            if (opacity == undefined) opacity = 1;
            ctx.fillStyle = "rgba(255,255,0,"+opacity+")";
            this.drawCenterPixelSq(ctx, pacman.pixel.x, pacman.pixel.y, this.actorSize*scale);
        },

        // draw dying pacman animation (with 0<=t<=1)
        drawDyingPlayer: function(t) {
            var f = t*85;
            if (f <= 60) {
                t = f/60;
                this.drawPlayer(1-t);
            }
            else {
                f -= 60;
                t = f/15;
                this.drawPlayer(t,1-t);
            }
        },

        // draw ghost
        drawGhost: function(g) {
            if (g.mode == GHOST_EATEN)
                return;
            var color = g.color;
            if (g.scared)
                color = energizer.isFlash() ? "#FFF" : "#2121ff";
            else if (g.mode == GHOST_GOING_HOME || g.mode == GHOST_ENTERING_HOME)
                color = "rgba(255,255,255,0.3)";
            ctx.fillStyle = color;
            this.drawCenterPixelSq(ctx, g.pixel.x, g.pixel.y, this.actorSize);
        },

        drawFruit: function() {
            if (fruit.isPresent()) {
                ctx.fillStyle = "#0F0";
                this.drawCenterPixelSq(ctx, fruit.pixel.x, fruit.pixel.y, tileSize+2);
            }
            else if (fruit.isScorePresent()) {
                ctx.font = this.pointsEarnedTextSize + "px sans-serif";
                ctx.textBaseline = "middle";
                ctx.textAlign = "center";
                ctx.fillStyle = "#FFF";
                ctx.fillText(fruit.getPoints(), fruit.pixel.x, fruit.pixel.y);
            }
        },

    });


    //////////////////////////////////////////////////////////////
    // Arcade Renderer
    // (render a display close to the original arcade)

    // constructor
    var ArcadeRenderer = function(ctx,bgCtx) {

        // inherit attributes from Common Renderer
        CommonRenderer.call(this,ctx,bgCtx);

        this.messageRow = 20;
        this.pelletSize = 2;
        this.energizerSize = tileSize;

        this.backColor = "#000";
        this.floorColor = "#000";
        this.flashWallColor = "#FFF";

        this.name = "Arcade";
    };

    ArcadeRenderer.prototype = newChildObject(CommonRenderer.prototype, {

        // copy background canvas to the foreground canvas
        blitMap: function() {
            ctx.scale(1/scale,1/scale);
            ctx.drawImage(bgCanvas,-1-mapPad*scale,-1-mapPad*scale); // offset map to compenstate for misalignment
            ctx.scale(scale,scale);
            //ctx.clearRect(-mapPad,-mapPad,mapWidth,mapHeight);
        },

        drawMap: function(isCutscene) {

            // fill background
            beginMapFrame();

            if (map) {

                // Sometimes pressing escape during a flash can cause flash to be permanently enabled on maps.
                // so just turn it off when not in the finish state.
                if (state != finishState) {
                    this.flashLevel = false;
                }

                var x,y;
                var i,j;
                var tile;

                // ghost house door
                i=0;
                for (y=0; y<map.numRows; y++)
                for (x=0; x<map.numCols; x++) {
                    if (map.currentTiles[i] == '-' && map.currentTiles[i+1] == '-') {
                        bgCtx.fillStyle = "#ffb8de";
                        bgCtx.fillRect(x*tileSize,y*tileSize+tileSize-2,tileSize*2,2);
                    }
                    i++;
                }

                if (this.flashLevel) {
                    bgCtx.fillStyle = "#000";
                    bgCtx.strokeStyle = "#fff";
                }
                else {
                    bgCtx.fillStyle = map.wallFillColor;
                    bgCtx.strokeStyle = map.wallStrokeColor;
                }
                for (i=0; i<map.paths.length; i++) {
                    var path = map.paths[i];
                    bgCtx.beginPath();
                    bgCtx.moveTo(path[0].x, path[0].y);
                    for (j=1; j<path.length; j++) {
                        if (path[j].cx != undefined)
                            bgCtx.quadraticCurveTo(path[j].cx, path[j].cy, path[j].x, path[j].y);
                        else
                            bgCtx.lineTo(path[j].x, path[j].y);
                    }
                    bgCtx.quadraticCurveTo(path[j-1].x, path[0].y, path[0].x, path[0].y);
                    bgCtx.fill();
                    bgCtx.stroke();
                }

                // draw pellet tiles
                bgCtx.fillStyle = map.pelletColor;
                i=0;
                for (y=0; y<map.numRows; y++)
                for (x=0; x<map.numCols; x++) {
                    this.refreshPellet(x,y,true);
                }

                if (map.onDraw) {
                    map.onDraw(bgCtx);
                }

                if (map.shouldDrawMapOnly) {
                    endMapFrame();
                    return;
                }
            }
            if (level > 0) {

                var numRows = 36;
                var numCols = 28;

                if (!isCutscene) {
                    // draw extra lives
                    var i;
                    bgCtx.fillStyle = pacman.color;

                    bgCtx.save();
                    bgCtx.translate(3*tileSize, (numRows-1)*tileSize);
                    bgCtx.scale(0.85, 0.85);
                    var lives = extraLives == Infinity ? 1 : extraLives;
                    if (gameMode == GAME_PACMAN) {
                        for (i=0; i<lives; i++) {
                            drawPacmanSprite(bgCtx, 0,0, DIR_LEFT, Math.PI/6);
                            bgCtx.translate(2*tileSize,0);
                        }
                    }
                    else if (gameMode == GAME_MSPACMAN) {
                        for (i=0; i<lives; i++) {
                            drawMsPacmanSprite(bgCtx, 0,0, DIR_RIGHT, 1);
                            bgCtx.translate(2*tileSize,0);
                        }
                    }
                    else if (gameMode == GAME_COOKIE) {
                        for (i=0; i<lives; i++) {
                            drawCookiemanSprite(bgCtx, 0,0, DIR_RIGHT, 1, false);
                            bgCtx.translate(2*tileSize,0);
                        }
                    }
                    else if (gameMode == GAME_OTTO) {
                        for (i=0; i<lives; i++) {
                            drawOttoSprite(bgCtx, 0,0,DIR_RIGHT, 0);
                            bgCtx.translate(2*tileSize,0);
                        }
                    }
                    if (extraLives == Infinity) {
                        bgCtx.translate(-4*tileSize,0);

                        // draw X
                        /*
                        bgCtx.translate(-s*2,0);
                        var s = 2; // radius of each stroke
                        bgCtx.beginPath();
                        bgCtx.moveTo(-s,-s);
                        bgCtx.lineTo(s,s);
                        bgCtx.moveTo(-s,s);
                        bgCtx.lineTo(s,-s);
                        bgCtx.lineWidth = 1;
                        bgCtx.strokeStyle = "#777";
                        bgCtx.stroke();
                        */

                        // draw Infinity symbol
                        var r = 2; // radius of each half-circle
                        var d = 3; // distance between the two focal points
                        bgCtx.beginPath();
                        bgCtx.moveTo(-d-r,0);
                        bgCtx.quadraticCurveTo(-d-r,-r,-d,-r);
                        bgCtx.bezierCurveTo(-(d-r),-r,d-r,r,d,r);
                        bgCtx.quadraticCurveTo(d+r,r,d+r,0);
                        bgCtx.quadraticCurveTo(d+r,-r,d,-r);
                        bgCtx.bezierCurveTo(d-r,-r,-(d-r),r,-d,r);
                        bgCtx.quadraticCurveTo(-d-r,r,-d-r,0);
                        bgCtx.lineWidth = 1;
                        bgCtx.strokeStyle = "#FFF";
                        bgCtx.stroke();
                    }
                    bgCtx.restore();
                }

                // draw level fruit
                var fruits = fruit.fruitHistory;
                var i,j;
                var f,drawFunc;
                var numFruit = 7;
                var startLevel = Math.max(numFruit,level);
                if (gameMode != GAME_PACMAN) {
                    // for the Pac-Man game, display the last 7 fruit
                    // for the Ms Pac-Man game, display stop after the 7th fruit
                    startLevel = Math.min(numFruit,startLevel);
                }
                var scale = 0.85;
                for (i=0, j=startLevel-numFruit+1; i<numFruit && j<=level; j++, i++) {
                    f = fruits[j];
                    if (f) {
                        drawFunc = getSpriteFuncFromFruitName(f.name);
                        if (drawFunc) {
                            bgCtx.save();
                            bgCtx.translate((numCols-3)*tileSize - i*16*scale, (numRows-1)*tileSize);
                            bgCtx.scale(scale,scale);
                            drawFunc(bgCtx,0,0);
                            bgCtx.restore();
                        }
                    }
                }
                if (!isCutscene) {
                    if (level >= 100) {
                        bgCtx.font = (tileSize-3) + "px ArcadeR";
                    }
                    else {
                        bgCtx.font = (tileSize-1) + "px ArcadeR";
                    }
                    bgCtx.textBaseline = "middle";
                    bgCtx.fillStyle = "#777";
                    bgCtx.textAlign = "left";
                    bgCtx.fillText(level,(numCols-2)*tileSize, (numRows-1)*tileSize);
                }
            }
            endMapFrame();
        },

        erasePellet: function(x,y,isTranslated) {
            if (!isTranslated) {
                bgCtx.translate(mapPad,mapPad);
            }
            bgCtx.fillStyle = "#000";
            var i = map.posToIndex(x,y);
            var size = map.tiles[i] == 'o' ? this.energizerSize : this.pelletSize;
            this.drawCenterTileSq(bgCtx,x,y,size+2);
            if (!isTranslated) {
                bgCtx.translate(-mapPad,-mapPad);
            }
        },

        refreshPellet: function(x,y,isTranslated) {
            if (!isTranslated) {
                bgCtx.translate(mapPad,mapPad);
            }
            var i = map.posToIndex(x,y);
            var tile = map.currentTiles[i];
            if (tile == ' ') {
                this.erasePellet(x,y,isTranslated);
            }
            else if (tile == '.') {
                bgCtx.fillStyle = map.pelletColor;
                bgCtx.translate(0.5, 0.5);
                this.drawCenterTileSq(bgCtx,x,y,this.pelletSize);
                bgCtx.translate(-0.5, -0.5);
            }
            else if (tile == 'o') {
                bgCtx.fillStyle = map.pelletColor;
                bgCtx.beginPath();
                bgCtx.arc(x*tileSize+midTile.x+0.5,y*tileSize+midTile.y,this.energizerSize/2,0,Math.PI*2);
                bgCtx.fill();
            }
            if (!isTranslated) {
                bgCtx.translate(-mapPad,-mapPad);
            }
        },

        // draw the current score and high score
        drawScore: function() {
            ctx.font = tileSize + "px ArcadeR";
            ctx.textBaseline = "top";
            ctx.fillStyle = "#FFF";

            ctx.textAlign = "right";
            ctx.fillText("1UP", 6*tileSize, 0);
            ctx.fillText(practiceMode ? "PRACTICE" : "HIGH SCORE", 19*tileSize, 0);
            //ctx.fillText("2UP", 25*tileSize, 0);

            // TODO: player two score
            var score = getScore();
            if (score == 0) {
                score = "00";
            }
            var y = tileSize+1;
            ctx.fillText(score, 7*tileSize, y);

            if (!practiceMode) {
                var highScore = getHighScore();
                if (highScore == 0) {
                    highScore = "00";
                }
                ctx.fillText(highScore, 17*tileSize, y);
            }
        },

        // draw ghost
        drawGhost: function(g,alpha) {
            var backupAlpha;
            if (alpha) {
                backupAlpha = ctx.globalAlpha;
                ctx.globalAlpha = alpha;
            }

            var draw = function(mode, pixel, frames, faceDirEnum, scared, isFlash,color, dirEnum) {
                if (mode == GHOST_EATEN)
                    return;
                var frame = g.getAnimFrame(frames);
                var eyes = (mode == GHOST_GOING_HOME || mode == GHOST_ENTERING_HOME);
                var func = getGhostDrawFunc();
                var y = g.getBounceY(pixel.x, pixel.y, dirEnum);
                var x = (g == blinky && scared) ? pixel.x+1 : pixel.x; // blinky's sprite is shifted right when scared

                func(ctx,x,y,frame,faceDirEnum,scared,isFlash,eyes,color);
            };
            vcr.drawHistory(ctx, function(t) {
                draw(
                    g.savedMode[t],
                    g.savedPixel[t],
                    g.savedFrames[t],
                    g.savedFaceDirEnum[t],
                    g.savedScared[t],
                    energizer.isFlash(),
                    g.color,
                    g.savedDirEnum[t]);
            });
            draw(g.mode, g.pixel, g.frames, g.faceDirEnum, g.scared, energizer.isFlash(), g.color, g.dirEnum);
            if (alpha) {
                ctx.globalAlpha = backupAlpha;
            }
        },

        // draw pacman
        drawPlayer: function() {
            var frame = pacman.getAnimFrame();
            if (pacman.invincible) {
                ctx.globalAlpha = 0.6;
            }

            var draw = function(pixel, dirEnum, steps) {
                var frame = pacman.getAnimFrame(pacman.getStepFrame(steps));
                var func = getPlayerDrawFunc();
                func(ctx, pixel.x, pixel.y, dirEnum, frame, true);
            };

            vcr.drawHistory(ctx, function(t) {
                draw(
                    pacman.savedPixel[t],
                    pacman.savedDirEnum[t],
                    pacman.savedSteps[t]);
            });
            draw(pacman.pixel, pacman.dirEnum, pacman.steps);
            if (pacman.invincible) {
                ctx.globalAlpha = 1;
            }
        },

        // draw dying pacman animation (with 0<=t<=1)
        drawDyingPlayer: function(t) {
            var frame = pacman.getAnimFrame();

            if (gameMode == GAME_PACMAN) {
                // 60 frames dying
                // 15 frames exploding
                var f = t*75;
                if (f <= 60) {
                    // open mouth all the way while shifting corner of mouth forward
                    t = f/60;
                    var a = frame*Math.PI/6;
                    drawPacmanSprite(ctx, pacman.pixel.x, pacman.pixel.y, pacman.dirEnum, a + t*(Math.PI-a),4*t);
                }
                else {
                    // explode
                    f -= 60;
                    this.drawExplodingPlayer(f/15);
                }
            }
            else if (gameMode == GAME_OTTO) {
                // TODO: spin around
                if (t < 0.8) {
                    var dirEnum = Math.floor((pacman.dirEnum - t*16))%4;
                    if (dirEnum < 0) {
                        dirEnum += 4;
                    }
                    drawOttoSprite(ctx, pacman.pixel.x, pacman.pixel.y, dirEnum, 0);
                }
                else if (t < 0.95) {
                    var dirEnum = Math.floor((pacman.dirEnum - 0.8*16))%4;
                    if (dirEnum < 0) {
                        dirEnum += 4;
                    }
                    drawOttoSprite(ctx, pacman.pixel.x, pacman.pixel.y, dirEnum, 0);
                }
                else {
                    drawDeadOttoSprite(ctx,pacman.pixel.x, pacman.pixel.y);
                }
            }
            else if (gameMode == GAME_MSPACMAN) {
                // spin 540 degrees
                var maxAngle = Math.PI*5;
                var step = (Math.PI/4) / maxAngle; // 45 degree steps
                var angle = Math.floor(t/step)*step*maxAngle;
                drawMsPacmanSprite(ctx, pacman.pixel.x, pacman.pixel.y, pacman.dirEnum, frame, angle);
            }
            else if (gameMode == GAME_COOKIE) {
                // spin 540 degrees
                var maxAngle = Math.PI*5;
                var step = (Math.PI/4) / maxAngle; // 45 degree steps
                var angle = Math.floor(t/step)*step*maxAngle;
                drawCookiemanSprite(ctx, pacman.pixel.x, pacman.pixel.y, pacman.dirEnum, frame, false, angle);
            }
        },

        // draw exploding pacman animation (with 0<=t<=1)
        drawExplodingPlayer: function(t) {
            var frame = pacman.getAnimFrame();
            drawPacmanSprite(ctx, pacman.pixel.x, pacman.pixel.y, pacman.dirEnum, 0, 0, t,-3,1-t);
        },

        // draw fruit
        drawFruit: function() {

            if (fruit.getCurrentFruit()) {
                var name = fruit.getCurrentFruit().name;

                // draw history trails of the fruit if applicable
                if (fruit.savedPixel) {
                    vcr.drawHistory(ctx, function(t) {
                        var pixel = fruit.savedPixel[t];
                        if (pixel) {
                            atlas.drawFruitSprite(ctx, pixel.x, pixel.y, name);
                        }
                    });
                }

                if (fruit.isPresent()) {
                    atlas.drawFruitSprite(ctx, fruit.pixel.x, fruit.pixel.y, name);
                }
                else if (fruit.isScorePresent()) {
                    if (gameMode == GAME_PACMAN) {
                        atlas.drawPacFruitPoints(ctx, fruit.pixel.x, fruit.pixel.y, fruit.getPoints());
                    }
                    else {
                        atlas.drawMsPacFruitPoints(ctx, fruit.pixel.x, fruit.pixel.y, fruit.getPoints());
                    }
                }
            }
        },

    });

    //
    // Create list of available renderers
    //
    renderer_list = [
        new SimpleRenderer(),
        new ArcadeRenderer(),
    ];
    renderer = renderer_list[1];
};

var hud = (function(){

    var on = false;

    return {

        update: function() {
            var valid = this.isValidState();
            if (valid != on) {
                on = valid;
                if (on) {
                    inGameMenu.onHudEnable();
                    vcr.onHudEnable();
                }
                else {
                    inGameMenu.onHudDisable();
                    vcr.onHudDisable();
                }
            }
        },
        draw: function(ctx) {
            inGameMenu.draw(ctx);
            vcr.draw(ctx);
        },
        isValidState: function() {
            return (
                state == playState ||
                state == newGameState ||
                state == readyNewState ||
                state == readyRestartState ||
                state == finishState ||
                state == deadState ||
                state == overState);
        },
    };

})();

var galagaStars = (function() {

    var stars = {};
    var numStars = 200;

    var width = mapWidth;
    var height = Math.floor(mapHeight*1.5);

    var ypos;
    var yspeed=-0.5;

    var t;
    var flickerPeriod = 120;
    var flickerSteps = 4;
    var flickerGap = flickerPeriod / flickerSteps;

    var init = function() {
        t = 0;
        ypos = 0;
        var i;
        for (i=0; i<numStars; i++) {
            stars[i] = {
                x: getRandomInt(0,width-1),
                y: getRandomInt(0,height-1),
                color: getRandomColor(),
                phase: getRandomInt(0,flickerPeriod-1),
            };
        }
    };

    var update = function() {
        t++;
        t %= flickerPeriod;

        ypos += yspeed;
        ypos %= height;
        if (ypos < 0) {
            ypos += height;
        }
    };

    var draw = function(ctx) {
        var i;
        var star;
        var time;
        var y;
        ctx.fillStyle = "#FFF";
        for (i=0; i<numStars; i++) {
            star = stars[i];
            time = (t + star.phase) % flickerPeriod;
            if (time >= flickerGap) {
                y = star.y - ypos;
                if (y < 0) {
                    y += height;
                }
                ctx.fillStyle = star.color;
                ctx.fillRect(star.x, y, 1,1);
            }
        }
    };

    return {
        init: init,
        draw: draw,
        update: update,
    };

})();
var getPointerPos = function(evt) {
    var obj = canvas;
    var top = 0;
    var left = 0;
    while (obj.tagName != 'BODY') {
        top += obj.offsetTop;
        left += obj.offsetLeft;
        obj = obj.offsetParent;
    }

    // calculate relative mouse position
    var mouseX = evt.pageX - left;
    var mouseY = evt.pageY - top;

    // make independent of scale
    var ratio = getDevicePixelRatio();
    mouseX /= (renderScale / ratio);
    mouseY /= (renderScale / ratio);

    // offset
    mouseX -= mapMargin;
    mouseY -= mapMargin;

    return { x: mouseX, y: mouseY };
};

var Button = function(x,y,w,h,onclick) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.onclick = onclick;

    // text and icon padding
    this.pad = tileSize;



    // icon attributes
    this.frame = 0;

    this.borderBlurColor = "#333";
    this.borderFocusColor = "#EEE";

    this.isSelected = false;

    // touch events
    this.startedInside = false;
    var that = this;
    var touchstart = function(evt) {
        evt.preventDefault();
        var fingerCount = evt.touches.length;
        if (fingerCount == 1) {
            var pos = getPointerPos(evt.touches[0]);
            (that.startedInside=that.contains(pos.x,pos.y)) ? that.focus() : that.blur();
        }
        else {
            touchcancel(evt);
        }
    };
    var touchmove = function(evt) {
        evt.preventDefault();
        var fingerCount = evt.touches.length;
        if (fingerCount == 1) {
            if (that.startedInside) {
                var pos = getPointerPos(evt.touches[0]);
                that.contains(pos.x, pos.y) ? that.focus() : that.blur();
            }
        }
        else {
            touchcancel(evt);
        }
    };
    var touchend = function(evt) {
        evt.preventDefault();
        var registerClick = (that.startedInside && that.isSelected);
        if (registerClick) {
            that.click();
        }
        touchcancel(evt);
        if (registerClick) {
            // focus the button to keep it highlighted after successful click
            that.focus();
        }
    };
    var touchcancel = function(evt) {
        evt.preventDefault();
        this.startedInside = false;
        that.blur();
    };


    // mouse events
    var click = function(evt) {
        var pos = getPointerPos(evt);
        if (that.contains(pos.x, pos.y)) {
            that.click();
        }
    };
    var mousemove = function(evt) {
        var pos = getPointerPos(evt);
        that.contains(pos.x, pos.y) ? that.focus() : that.blur();
    };
    var mouseleave = function(evt) {
        that.blur();
    };

    this.isEnabled = false;
    this.onEnable = function() {
        canvas.addEventListener('click', click);
        canvas.addEventListener('mousemove', mousemove);
        canvas.addEventListener('mouseleave', mouseleave);
        canvas.addEventListener('touchstart', touchstart);
        canvas.addEventListener('touchmove', touchmove);
        canvas.addEventListener('touchend', touchend);
        canvas.addEventListener('touchcancel', touchcancel);
        this.isEnabled = true;
    };

    this.onDisable = function() {
        canvas.removeEventListener('click', click);
        canvas.removeEventListener('mousemove', mousemove);
        canvas.removeEventListener('mouseleave', mouseleave);
        canvas.removeEventListener('touchstart', touchstart);
        canvas.removeEventListener('touchmove', touchmove);
        canvas.removeEventListener('touchend', touchend);
        canvas.removeEventListener('touchcancel', touchcancel);
        that.blur();
        this.isEnabled = false;
    };
};

Button.prototype = {

    contains: function(x,y) {
        return x >= this.x && x <= this.x+this.w &&
               y >= this.y && y <= this.y+this.h;
    },

    click: function() {
        // disable current click timeout (to prevent double clicks on some devices)
        clearTimeout(this.clickTimeout);

        // set a click delay
        var that = this;
        if (that.onclick) {
            this.clickTimeout = setTimeout(function() { that.onclick(); }, 200);
        }
    },

    enable: function() {
        this.frame = 0;
        this.onEnable();
    },

    disable: function() {
        this.onDisable();
    },

    focus: function() {
        this.isSelected = true;
        this.onfocus && this.onfocus();
    },

    blur: function() {
        this.isSelected = false;
        this.onblur && this.onblur();
    },

    setText: function(msg) {
        this.msg = msg;
    },

    setFont: function(font,fontcolor) {
        this.font = font;
        this.fontcolor = fontcolor;
    },

    setIcon: function(drawIcon) {
        this.drawIcon = drawIcon;
    },

    draw: function(ctx) {

        // draw border
        ctx.lineWidth = 2;
        ctx.beginPath();
        var x=this.x, y=this.y, w=this.w, h=this.h;
        var r=h/4;
        ctx.moveTo(x,y+r);
        ctx.quadraticCurveTo(x,y,x+r,y);
        ctx.lineTo(x+w-r,y);
        ctx.quadraticCurveTo(x+w,y,x+w,y+r);
        ctx.lineTo(x+w,y+h-r);
        ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
        ctx.lineTo(x+r,y+h);
        ctx.quadraticCurveTo(x,y+h,x,y+h-r);
        ctx.closePath();
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fill();
        ctx.strokeStyle = this.isSelected && this.onclick ? this.borderFocusColor : this.borderBlurColor;
        ctx.stroke();

        // draw icon
        if (this.drawIcon) {
            if (!this.msg) {
                this.drawIcon(ctx,this.x+this.w/2,this.y+this.h/2,this.frame);
            }
            else {
                this.drawIcon(ctx,this.x+this.pad+tileSize,this.y+this.h/2,this.frame);
            }
        }

        // draw text
        if (this.msg) {
            ctx.font = this.font;
            ctx.fillStyle = this.isSelected && this.onclick ? this.fontcolor : "#777";
            ctx.textBaseline = "middle";
            ctx.textAlign = "center";
            //ctx.fillText(this.msg, 2*tileSize+2*this.pad+this.x, this.y + this.h/2 + 1);
            ctx.fillText(this.msg, this.x + this.w/2, this.y + this.h/2 + 1);
        }
    },

    update: function() {
        if (this.drawIcon) {
            this.frame = this.isSelected ? this.frame+1 : 0;
        }
    },
};

var ToggleButton = function(x,y,w,h,isOn,setOn) {
    var that = this;
    var onclick = function() {
        setOn(!isOn());
        that.refreshMsg();
    };
    this.isOn = isOn;
    this.setOn = setOn;
    Button.call(this,x,y,w,h,onclick);
};

ToggleButton.prototype = newChildObject(Button.prototype, {

    enable: function() {
        Button.prototype.enable.call(this);
        this.refreshMsg();
    },
    setToggleLabel: function(label) {
        this.label = label;
    },
    refreshMsg: function() {
        if (this.label) {
            this.msg = this.label + ": " + (this.isOn() ? "ON" : "OFF");
        }
    },
    refreshOnState: function() {
        this.setOn(this.isOn());
    },

});
var Menu = function(title,x,y,w,h,pad,font,fontcolor) {
    this.title = title;
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.pad = pad;
    this.buttons = [];
    this.buttonCount = 0;
    this.currentY = this.y+this.pad;

    if (title) {
        this.currentY += 1*(this.h + this.pad);
    }

    this.font = font;
    this.fontcolor = fontcolor;
    this.enabled = false;

    this.backButton = undefined;
};

Menu.prototype = {

    clickCurrentOption: function() {
        var i;
        for (i=0; i<this.buttonCount; i++) {
            if (this.buttons[i].isSelected) {
                this.buttons[i].onclick();
                break;
            }
        }
    },

    selectNextOption: function() {
        var i;
        var nextBtn;
        for (i=0; i<this.buttonCount; i++) {
            if (this.buttons[i].isSelected) {
                this.buttons[i].blur();
                nextBtn = this.buttons[(i+1)%this.buttonCount];
                break;
            }
        }
        nextBtn = nextBtn || this.buttons[0];
        nextBtn.focus();
    },

    selectPrevOption: function() {
        var i;
        var nextBtn;
        for (i=0; i<this.buttonCount; i++) {
            if (this.buttons[i].isSelected) {
                this.buttons[i].blur();
                nextBtn = this.buttons[i==0?this.buttonCount-1:i-1];
                break;
            }
        }
        nextBtn = nextBtn || this.buttons[this.buttonCount-1];
        nextBtn.focus();
    },

    addToggleButton: function(isOn,setOn) {
        var b = new ToggleButton(this.x+this.pad,this.currentY,this.w-this.pad*2,this.h,isOn,setOn);
        this.buttons.push(b);
        this.buttonCount++;
        this.currentY += this.pad + this.h;
    },

    addToggleTextButton: function(label,isOn,setOn) {
        var b = new ToggleButton(this.x+this.pad,this.currentY,this.w-this.pad*2,this.h,isOn,setOn);
        b.setFont(this.font,this.fontcolor);
        b.setToggleLabel(label);
        this.buttons.push(b);
        this.buttonCount++;
        this.currentY += this.pad + this.h;
    },

    addTextButton: function(msg,onclick) {
        var b = new Button(this.x+this.pad,this.currentY,this.w-this.pad*2,this.h,onclick);
        b.setFont(this.font,this.fontcolor);
        b.setText(msg);
        this.buttons.push(b);
        this.buttonCount++;
        this.currentY += this.pad + this.h;
    },

    addTextIconButton: function(msg,onclick,drawIcon) {
        var b = new Button(this.x+this.pad,this.currentY,this.w-this.pad*2,this.h,onclick);
        b.setFont(this.font,this.fontcolor);
        b.setText(msg);
        b.setIcon(drawIcon);
        this.buttons.push(b);
        this.buttonCount++;
        this.currentY += this.pad + this.h;
    },

    addIconButton: function(drawIcon,onclick) {
        var b = new Button(this.x+this.pad,this.currentY,this.w-this.pad*2,this.h,onclick);
        b.setIcon(drawIcon);
        this.buttons.push(b);
        this.buttonCount++;
        this.currentY += this.pad + this.h;
    },

    addSpacer: function(count) {
        if (count == undefined) {
            count = 1;
        }
        this.currentY += count*(this.pad + this.h);
    },

    enable: function() {
        var i;
        for (i=0; i<this.buttonCount; i++) {
            this.buttons[i].enable();
        }
        this.enabled = true;
    },

    disable: function() {
        var i;
        for (i=0; i<this.buttonCount; i++) {
            this.buttons[i].disable();
        }
        this.enabled = false;
    },

    isEnabled: function() {
        return this.enabled;
    },

    draw: function(ctx) {
        if (this.title) {
            ctx.font = tileSize+"px ArcadeR";
            ctx.textBaseline = "middle";
            ctx.textAlign = "center";
            ctx.fillStyle = "#FFF";
            ctx.fillText(this.title,this.x + this.w/2, this.y+this.pad + this.h/2);
        }
        var i;
        for (i=0; i<this.buttonCount; i++) {
            this.buttons[i].draw(ctx);
        }
    },

    update: function() {
        var i;
        for (i=0; i<this.buttonCount; i++) {
            this.buttons[i].update();
        }
    },
};
////////////////////////////////////////////////////
// In-Game Menu
var inGameMenu = (function() {

    var w=tileSize*6,h=tileSize*3;

    var getMainMenu = function() {
        return practiceMode ? practiceMenu : menu;
    };
    var showMainMenu = function() {
        getMainMenu().enable();
    };
    var hideMainMenu = function() {
        getMainMenu().disable();
    };

    // button to enable in-game menu
    var btn = new Button(mapWidth/2 - w/2,mapHeight,w,h, function() {
        showMainMenu();
        vcr.onHudDisable();
    });
    btn.setText("MENU");
    btn.setFont(tileSize+"px ArcadeR","#FFF");

    // confirms a menu action
    var confirmMenu = new Menu("QUESTION?",2*tileSize,5*tileSize,mapWidth-4*tileSize,3*tileSize,tileSize,tileSize+"px ArcadeR", "#EEE");
    confirmMenu.addTextButton("YES", function() {
        confirmMenu.disable();
        confirmMenu.onConfirm();
    });
    confirmMenu.addTextButton("NO", function() {
        confirmMenu.disable();
        showMainMenu();
    });
    confirmMenu.addTextButton("CANCEL", function() {
        confirmMenu.disable();
        showMainMenu();
    });
    confirmMenu.backButton = confirmMenu.buttons[confirmMenu.buttonCount-1];

    var showConfirm = function(title,onConfirm) {
        hideMainMenu();
        confirmMenu.title = title;
        confirmMenu.onConfirm = onConfirm;
        confirmMenu.enable();
    };

    // regular menu
    var menu = new Menu("PAUSED",2*tileSize,5*tileSize,mapWidth-4*tileSize,3*tileSize,tileSize,tileSize+"px ArcadeR", "#EEE");
    menu.addTextButton("RESUME", function() {
        menu.disable();
    });
    menu.addTextButton("QUIT", function() {
        showConfirm("QUIT GAME?", function() {
            switchState(homeState, 60);
        });
    });
    menu.backButton = menu.buttons[0];

    // practice menu
    var practiceMenu = new Menu("PAUSED",2*tileSize,5*tileSize,mapWidth-4*tileSize,3*tileSize,tileSize,tileSize+"px ArcadeR", "#EEE");
    practiceMenu.addTextButton("RESUME", function() {
        hideMainMenu();
        vcr.onHudEnable();
    });
    practiceMenu.addTextButton("RESTART LEVEL", function() {
        showConfirm("RESTART LEVEL?", function() {
            level--;
            switchState(readyNewState, 60);
        });
    });
    practiceMenu.addTextButton("SKIP LEVEL", function() {
        showConfirm("SKIP LEVEL?", function() {
            switchState(readyNewState, 60);
        });
    });
    practiceMenu.addTextButton("CHEATS", function() {
        practiceMenu.disable();
        cheatsMenu.enable();
    });
    practiceMenu.addTextButton("QUIT", function() {
        showConfirm("QUIT GAME?", function() {
            switchState(homeState, 60);
            clearCheats();
            vcr.reset();
        });
    });
    practiceMenu.backButton = practiceMenu.buttons[0];

    // cheats menu
    var cheatsMenu = new Menu("CHEATS",2*tileSize,5*tileSize,mapWidth-4*tileSize,3*tileSize,tileSize,tileSize+"px ArcadeR", "#EEE");
    cheatsMenu.addToggleTextButton("INVINCIBLE",
        function() {
            return pacman.invincible;
        },
        function(on) {
            pacman.invincible = on;
        });
    cheatsMenu.addToggleTextButton("TURBO",
        function() {
            return turboMode;
        },
        function(on) {
            turboMode = on;
        });
    cheatsMenu.addToggleTextButton("SHOW TARGETS",
        function() {
            return blinky.isDrawTarget;
        },
        function(on) {
            for (var i=0; i<4; i++) {
                ghosts[i].isDrawTarget = on;
            }
        });
    cheatsMenu.addToggleTextButton("SHOW PATHS",
        function() {
            return blinky.isDrawPath;
        },
        function(on) {
            for (var i=0; i<4; i++) {
                ghosts[i].isDrawPath = on;
            }
        });
    cheatsMenu.addSpacer(1);
    cheatsMenu.addTextButton("BACK", function() {
        cheatsMenu.disable();
        practiceMenu.enable();
    });
    cheatsMenu.backButton = cheatsMenu.buttons[cheatsMenu.buttons.length-1];

    var menus = [menu, practiceMenu, confirmMenu, cheatsMenu];
    var getVisibleMenu = function() {
        var len = menus.length;
        var i;
        var m;
        for (i=0; i<len; i++) {
            m = menus[i];
            if (m.isEnabled()) {
                return m;
            }
        }
    };

    return {
        onHudEnable: function() {
            btn.enable();
        },
        onHudDisable: function() {
            btn.disable();
        },
        update: function() {
            if (btn.isEnabled) {
                btn.update();
            }
        },
        draw: function(ctx) {
            var m = getVisibleMenu();
            if (m) {
                ctx.fillStyle = "rgba(0,0,0,0.8)";
                ctx.fillRect(-mapPad-1,-mapPad-1,mapWidth+1,mapHeight+1);
                m.draw(ctx);
            }
            else {
                btn.draw(ctx);
            }
        },
        isOpen: function() {
            return getVisibleMenu() != undefined;
        },
        getMenu: function() {
            return getVisibleMenu();
        },
        getMenuButton: function() {
            return btn;
        },
    };
})();

//////////////////////////////////////////////////////////////////////////////////////
// Sprites
// (sprites are created using canvas paths)

var drawGhostSprite = (function(){

    // add top of the ghost head to the current canvas path
    var addHead = (function() {

        // pixel coordinates for the top of the head
        // on the original arcade ghost sprite
        var coords = [
            0,6,
            1,3,
            2,2,
            3,1,
            4,1,
            5,0,
            8,0,
            9,1,
            10,1,
            11,2,
            12,3,
            13,6,
        ];

        return function(ctx) {
            var i;
            ctx.save();

            // translate by half a pixel to the right
            // to try to force centering
            ctx.translate(0.5,0);

            ctx.moveTo(0,6);
            ctx.quadraticCurveTo(1.5,0,6.5,0);
            ctx.quadraticCurveTo(11.5,0,13,6);

            // draw lines between pixel coordinates
            /*
            ctx.moveTo(coords[0],coords[1]);
            for (i=2; i<coords.length; i+=2)
                ctx.lineTo(coords[i],coords[i+1]);
            */

            ctx.restore();
        };
    })();

    // add first ghost animation frame feet to the current canvas path
    var addFeet1 = (function(){

        // pixel coordinates for the first feet animation
        // on the original arcade ghost sprite
        var coords = [
            13,13,
            11,11,
            9,13,
            8,13,
            8,11,
            5,11,
            5,13,
            4,13,
            2,11,
            0,13,
        ];

        return function(ctx) {
            var i;
            ctx.save();

            // translate half a pixel right and down
            // to try to force centering and proper height
            ctx.translate(0.5,0.5);

            // continue previous path (assuming ghost head)
            // by drawing lines to each of the pixel coordinates
            for (i=0; i<coords.length; i+=2)
                ctx.lineTo(coords[i],coords[i+1]);

            ctx.restore();
        };

    })();

    // add second ghost animation frame feet to the current canvas path
    var addFeet2 = (function(){

        // pixel coordinates for the second feet animation
        // on the original arcade ghost sprite
        var coords = [
            13,12,
            12,13,
            11,13,
            9,11,
            7,13,
            6,13,
            4,11,
            2,13,
            1,13,
            0,12,
        ];

        return function(ctx) {
            var i;
            ctx.save();

            // translate half a pixel right and down
            // to try to force centering and proper height
            ctx.translate(0.5,0.5);

            // continue previous path (assuming ghost head)
            // by drawing lines to each of the pixel coordinates
            for (i=0; i<coords.length; i+=2)
                ctx.lineTo(coords[i],coords[i+1]);

            ctx.restore();
        };

    })();

    // draw regular ghost eyes
    var addEyes = function(ctx,dirEnum){
        var i;

        ctx.save();
        ctx.translate(2,3);

        var coords = [
            0,1,
            1,0,
            2,0,
            3,1,
            3,3,
            2,4,
            1,4,
            0,3
        ];

        var drawEyeball = function() {
            ctx.translate(0.5,0.5);
            ctx.beginPath();
            ctx.moveTo(coords[0],coords[1]);
            for (i=2; i<coords.length; i+=2)
                ctx.lineTo(coords[i],coords[i+1]);
            ctx.closePath();
            ctx.fill();
            ctx.lineJoin = 'round';
            ctx.stroke();
            ctx.translate(-0.5,-0.5);
            //ctx.fillRect(1,0,2,5); // left
            //ctx.fillRect(0,1,4,3);
        };

        // translate eye balls to correct position
        if (dirEnum == DIR_LEFT) ctx.translate(-1,0);
        else if (dirEnum == DIR_RIGHT) ctx.translate(1,0);
        else if (dirEnum == DIR_UP) ctx.translate(0,-1);
        else if (dirEnum == DIR_DOWN) ctx.translate(0,1);

        // draw eye balls
        ctx.fillStyle = "#FFF";
        ctx.strokeStyle = "#FFF";
        ctx.lineWidth = 1.0;
        ctx.lineJoin = 'round';
        drawEyeball();
        ctx.translate(6,0);
        drawEyeball();

        // translate pupils to correct position
        if (dirEnum == DIR_LEFT) ctx.translate(0,2);
        else if (dirEnum == DIR_RIGHT) ctx.translate(2,2);
        else if (dirEnum == DIR_UP) ctx.translate(1,0);
        else if (dirEnum == DIR_DOWN) ctx.translate(1,3);

        // draw pupils
        ctx.fillStyle = "#00F";
        ctx.fillRect(0,0,2,2); // right
        ctx.translate(-6,0);
        ctx.fillRect(0,0,2,2); // left

        ctx.restore();
    };

    // draw scared ghost face
    var addScaredFace = function(ctx,flash){
        ctx.strokeStyle = ctx.fillStyle = flash ? "#F00" : "#FF0";

        // eyes
        ctx.fillRect(4,5,2,2);
        ctx.fillRect(8,5,2,2);

        // mouth
        var coords = [
            1,10,
            2,9,
            3,9,
            4,10,
            5,10,
            6,9,
            7,9,
            8,10,
            9,10,
            10,9,
            11,9,
            12,10,
        ];
        ctx.translate(0.5,0.5);
        ctx.beginPath();
        ctx.moveTo(coords[0],coords[1]);
        for (i=2; i<coords.length; i+=2)
            ctx.lineTo(coords[i],coords[i+1]);
        ctx.lineWidth = 1.0;
        ctx.stroke();
        ctx.translate(-0.5,-0.5);
        /*
        ctx.fillRect(1,10,1,1);
        ctx.fillRect(12,10,1,1);
        ctx.fillRect(2,9,2,1);
        ctx.fillRect(6,9,2,1);
        ctx.fillRect(10,9,2,1);
        ctx.fillRect(4,10,2,1);
        ctx.fillRect(8,10,2,1);
        */
    };


    return function(ctx,x,y,frame,dirEnum,scared,flash,eyes_only,color) {
        ctx.save();
        ctx.translate(x-7,y-7);

        if (scared)
            color = flash ? "#FFF" : "#2121ff";

        if (!eyes_only) {
            // draw body
            ctx.beginPath();
            addHead(ctx);
            if (frame == 0)
                addFeet1(ctx);
            else
                addFeet2(ctx);
            ctx.closePath();
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.lineWidth = 0.5;
            ctx.strokeStyle = color;
            ctx.stroke();
            ctx.lineWidth = 1;
            ctx.fillStyle = color;
            ctx.fill();
        }

        // draw face
        if (scared)
            addScaredFace(ctx, flash);
        else
            addEyes(ctx,dirEnum);

        ctx.restore();
    };
})();

// draw points displayed when pac-man eats a ghost or a fruit
var drawPacPoints = (function(){
    var ctx;
    var color;

    var plotOutline = function(points,color) {
        var len = points.length;
        var i;
        ctx.beginPath();
        ctx.moveTo(points[0],points[1]);
        for (i=2; i<len; i+=2) {
            ctx.lineTo(points[i],points[i+1]);
        }
        ctx.closePath();
        ctx.lineWidth = 1.0;
        ctx.lineCap = ctx.lineJoin = "round";
        ctx.strokeStyle = color;
        ctx.stroke();
    };

    var plotLine = function(points,color) {
        var len = points.length;
        var i;
        ctx.beginPath();
        ctx.moveTo(points[0],points[1]);
        for (i=2; i<len; i+=2) {
            ctx.lineTo(points[i],points[i+1]);
        }
        ctx.lineWidth = 1.0;
        ctx.lineCap = ctx.lineJoin = "round";
        ctx.strokeStyle = color;
        ctx.stroke();
    };

    var draw0 = function(x,y) {
        ctx.save();
        ctx.translate(x,y);
        plotOutline([
            1,0,
            2,0,
            3,1,
            3,5,
            2,6,
            1,6,
            0,5,
            0,1,
        ],color);
        ctx.restore();
    };

    var draw1narrow = function(x,y) {
        plotLine([x,y,x,y+6],color);
    };

    var draw1 = function(x,y) {
        ctx.save();
        ctx.translate(x,y);
        plotLine([
            0,1,
            1,0,
            1,6,
            0,6,
            2,6,
        ],color);
        ctx.restore();
    };

    var draw2 = function(x,y) {
        ctx.save();
        ctx.translate(x,y);
        plotLine([
            0,2,
            0,1,
            1,0,
            3,0,
            4,1,
            4,2,
            0,6,
            4,6,
        ],color);
        ctx.restore();
    };

    var draw3 = function(x,y) {
        ctx.save();
        ctx.translate(x,y);
        plotLine([
            0,0,
            4,0,
            2,2,
            4,4,
            4,5,
            3,6,
            1,6,
            0,5,
        ],color);
        ctx.restore();
    };

    var draw4 = function(x,y) {
        ctx.save();
        ctx.translate(x,y);
        plotLine([
            3,6,
            3,0,
            0,3,
            0,4,
            4,4,
        ],color);
        ctx.restore();
    };

    var draw5 = function(x,y) {
        ctx.save();
        ctx.translate(x,y);
        plotLine([
            4,0,
            0,0,
            0,2,
            3,2,
            4,3,
            4,5,
            3,6,
            1,6,
            0,5,
        ],color);
        ctx.restore();
    };

    var draw6 = function(x,y) {
        ctx.save();
        ctx.translate(x,y);
        plotLine([
            3,0,
            1,0,
            0,1,
            0,5,
            1,6,
            2,6,
            3,5,
            3,3,
            0,3,
        ],color);
        ctx.restore();
    };

    var draw7 = function(x,y) {
        ctx.save();
        ctx.translate(x,y);
        plotLine([
            0,1,
            0,0,
            4,0,
            4,1,
            2,4,
            2,6,
        ],color);
        ctx.restore();
    };

    var draw8 = function(x,y) {
        ctx.save();
        ctx.translate(x,y);
        plotOutline([
            1,0,
            3,0,
            4,1,
            4,2,
            3,3,
            1,3,
            0,4,
            0,5,
            1,6,
            3,6,
            4,5,
            4,4,
            3,3,
            1,3,
            0,2,
            0,1,
        ],color);
        ctx.restore();
    };

    var draw100 = function() {
        draw1(-5,-3);
        draw0(-1,-3);
        draw0(4,-3);
    };

    var draw200 = function() {
        draw2(-7,-3);
        draw0(-1,-3);
        draw0(4,-3);
    };

    var draw300 = function() {
        draw3(-7,-3);
        draw0(-1,-3);
        draw0(4,-3);
    };
    
    var draw400 = function() {
        draw4(-7,-3);
        draw0(-1,-3);
        draw0(4,-3);
    };

    var draw500 = function() {
        draw5(-7,-3);
        draw0(-1,-3);
        draw0(4,-3);
    };

    var draw700 = function() {
        draw7(-7,-3);
        draw0(-1,-3);
        draw0(4,-3);
    };

    var draw800 = function() {
        draw8(-7,-3);
        draw0(-1,-3);
        draw0(4,-3);
    };

    var draw1000 = function() {
        draw1(-8,-3);
        draw0(-4,-3);
        draw0(1,-3);
        draw0(6,-3);
    };
    
    var draw1600 = function() {
        draw1narrow(-7,-3);
        draw6(-5,-3);
        draw0(0,-3);
        draw0(5,-3);
    };

    var draw2000 = function() {
        draw2(-10,-3);
        draw0(-4,-3);
        draw0(1,-3);
        draw0(6,-3);
    };

    var draw3000 = function() {
        draw3(-10,-3);
        draw0(-4,-3);
        draw0(1,-3);
        draw0(6,-3);
    };

    var draw5000 = function() {
        draw5(-10,-3);
        draw0(-4,-3);
        draw0(1,-3);
        draw0(6,-3);
    };

    return function(_ctx,x,y,points,_color) {
        ctx = _ctx;
        color = _color;

        ctx.save();
        ctx.translate(x+0.5,y+0.5);
        ctx.translate(0,-1);

        var f = {
            100: draw100,
            200: draw200,
            300: draw300,
            400: draw400,
            500: draw500,
            700: draw700,
            800: draw800,
            1000: draw1000,
            1600: draw1600,
            2000: draw2000,
            3000: draw3000,
            5000: draw5000,
        }[points];

        if (f) {
            f();
        }

        ctx.restore();
    };
})();

// draw points displayed when ms. pac-man eats a fruit
var drawMsPacPoints = (function(){
    var ctx;
    var color = "#fff";

    var plotOutline = function(points,color) {
        var len = points.length;
        var i;
        ctx.beginPath();
        ctx.moveTo(points[0],points[1]);
        for (i=2; i<len; i+=2) {
            ctx.lineTo(points[i],points[i+1]);
        }
        ctx.closePath();
        ctx.lineWidth = 1.0;
        ctx.lineCap = ctx.lineJoin = "round";
        ctx.strokeStyle = color;
        ctx.stroke();
    };

    var plotLine = function(points,color) {
        var len = points.length;
        var i;
        ctx.beginPath();
        ctx.moveTo(points[0],points[1]);
        for (i=2; i<len; i+=2) {
            ctx.lineTo(points[i],points[i+1]);
        }
        ctx.lineWidth = 1.0;
        ctx.lineCap = ctx.lineJoin = "round";
        ctx.strokeStyle = color;
        ctx.stroke();
    };


    var draw0 = function(x,y) {
        ctx.save();
        ctx.translate(x,y);
        plotOutline([
            0,0,
            2,0,
            2,4,
            0,4,
        ],color);
        ctx.restore();
    };

    var draw1 = function(x,y) {
        ctx.save();
        ctx.translate(x,y);
        plotLine([
            1,0,
            1,4,
        ],color);
        ctx.restore();
    };

    var draw2 = function(x,y) {
        ctx.save();
        ctx.translate(x,y);
        plotLine([
            0,0,
            2,0,
            2,2,
            0,2,
            0,4,
            2,4,
        ],color);
        ctx.restore();
    };

    var draw5 = function(x,y) {
        ctx.save();
        ctx.translate(x,y);
        plotLine([
            2,0,
            0,0,
            0,2,
            2,2,
            2,4,
            0,4,
        ],color);
        ctx.restore();
    };

    var draw7 = function(x,y) {
        ctx.save();
        ctx.translate(x,y);
        plotLine([
            0,0,
            2,0,
            2,4,
        ],color);
        ctx.restore();
    };

    var draw100 = function() {
        draw1(-5,-5);
        draw0(-1,-2);
        draw0(3,1);
    };

    var draw200 = function() {
        draw2(-5,-5);
        draw0(-1,-2);
        draw0(3,1);
    };

    var draw500 = function() {
        draw5(-5,-5);
        draw0(-1,-2);
        draw0(3,1);
    };

    var draw700 = function() {
        draw7(-5,-5);
        draw0(-1,-2);
        draw0(3,1);
    };

    var draw1000 = function() {
        draw1(-7,-7);
        draw0(-3,-4);
        draw0(1,-1);
        draw0(5,2);
    };

    var draw2000 = function() {
        draw2(-7,-7);
        draw0(-3,-4);
        draw0(1,-1);
        draw0(5,2);
    };

    var draw5000 = function() {
        draw5(-7,-7);
        draw0(-3,-4);
        draw0(1,-1);
        draw0(5,2);
    };

    return function(_ctx,x,y,points) {
        ctx = _ctx;

        ctx.save();
        ctx.translate(x+0.5,y+0.5);

        var f = {
            100: draw100,
            200: draw200,
            500: draw500,
            700: draw700,
            1000: draw1000,
            2000: draw2000,
            5000: draw5000,
        }[points];

        if (f) {
            f();
        }

        ctx.restore();
    };
})();

var drawMonsterSprite = (function(){
    var ctx;
    var color;

    var plotOutline = function(points,color) {
        var len = points.length;
        var i;
        ctx.beginPath();
        ctx.moveTo(points[0],points[1]);
        for (i=2; i<len; i+=2) {
            ctx.lineTo(points[i],points[i+1]);
        }
        ctx.closePath();
        ctx.lineWidth = 1.0;
        ctx.lineCap = ctx.lineJoin = "round";
        ctx.strokeStyle = color;
        ctx.stroke();
    };

    var plotLine = function(points,color) {
        var len = points.length;
        var i;
        ctx.beginPath();
        ctx.moveTo(points[0],points[1]);
        for (i=2; i<len; i+=2) {
            ctx.lineTo(points[i],points[i+1]);
        }
        ctx.lineWidth = 1.0;
        ctx.lineCap = ctx.lineJoin = "round";
        ctx.strokeStyle = color;
        ctx.stroke();
    };

    var plotSolid = function(points,color) {
        var len = points.length;
        var i;
        ctx.beginPath();
        ctx.moveTo(points[0],points[1]);
        for (i=2; i<len; i+=2) {
            ctx.lineTo(points[i],points[i+1]);
        }
        ctx.closePath();
        ctx.lineWidth = 1.0;
        ctx.lineJoin = "round";
        ctx.fillStyle = ctx.strokeStyle = color;
        ctx.fill();
        ctx.stroke();
    };


    // draw regular ghost eyes
    var drawEye = function(dirEnum,x,y){
        var i;

        ctx.save();
        ctx.translate(x,y);

        plotSolid([
            0,1,
            1,0,
            2,0,
            3,1,
            3,3,
            2,4,
            1,4,
            0,3
        ],"#FFF");

        // translate pupil to correct position
        if (dirEnum == DIR_LEFT) ctx.translate(0,2);
        else if (dirEnum == DIR_RIGHT) ctx.translate(2,2);
        else if (dirEnum == DIR_UP) ctx.translate(1,0);
        else if (dirEnum == DIR_DOWN) ctx.translate(1,3);

        // draw pupil
        plotSolid([
            0,0,
            1,0,
            1,1,
            0,1,
        ],"#00F");

        ctx.restore();
    };

    var drawRightBody = function() {
        plotSolid([
            -7,-3,
            -3,-7,
            -1,-7,
            -2,-6,
            0,-4,
            3,-7,
            5,-7,
            4,-7,
            3,-6,
            6,-3,
            6,1,
            5,3,
            2,6,
            -4,6,
            -5,5,
            -7,1,
        ],color);
    };

    var drawRightShoe = function(x,y) {
        ctx.save();
        ctx.translate(x,y);
        plotSolid([
            0,0,
            3,-3,
            4,-3,
            5,-2,
            5,-1,
            4,0,
        ],"#00F");
        ctx.restore();
    };

    var drawRight0 = function() {
        // antenna tips
        plotLine([-1,-7,0,-6],"#FFF");
        plotLine([5,-7,6,-6],"#FFF");

        drawRightBody();

        drawRightShoe(1,6);
        plotLine([-4,6,-1,6],"#00F");

        drawEye(DIR_RIGHT,-4,-4);
        drawEye(DIR_RIGHT,2,-4);
    };

    var drawRight1 = function() {
        // antenna tips
        plotLine([-1,-7,0,-7],"#FFF");
        plotLine([5,-7,6,-7],"#FFF");

        drawRightBody();

        drawRightShoe(-4,6);
        plotLine([2,6,5,6],"#00F");

        drawEye(DIR_RIGHT,-4,-4);
        drawEye(DIR_RIGHT,2,-4);
    };

    var drawLeft0 = function() {
        ctx.scale(-1,1);
        ctx.translate(1,0);
        drawRight0();
    };
    
    var drawLeft1 = function() {
        ctx.scale(-1,1);
        ctx.translate(1,0);
        drawRight1();
    };

    var drawUpDownBody0 = function() {
        plotLine([-6,-7,-7,-6],"#FFF");
        plotLine([5,-7,6,-6],"#FFF");
        plotSolid([
            -7,-3,
            -4,-6,
            -5,-7,
            -6,-7,
            -4,-7,
            -3,-6,
            -2,-6,
            -1,-5,
            0,-5,
            1,-6,
            2,-6,
            3,-7,
            5,-7,
            4,-7,
            3,-6,
            6,-3,
            6,1,
            5,3,
            4,5,
            3,6,
            -4,6,
            -5,5,
            -6,3,
            -7,1,
        ],color);
    };

    var drawUpDownBody1 = function() {
        plotLine([-6,-6,-7,-5],"#FFF");
        plotLine([5,-6,6,-5],"#FFF");
        plotSolid([
            -7,-3,
            -4,-6,
            -5,-7,
            -6,-6,
            -5,-7,
            -4,-7,
            -3,-6,
            -2,-6,
            -1,-5,
            0,-5,
            1,-6,
            2,-6,
            3,-7,
            4,-7,
            5,-6,
            4,-7,
            3,-6,
            6,-3,
            6,1,
            5,3,
            4,5,
            3,6,
            -4,6,
            -5,5,
            -6,3,
            -7,1,
        ],color);
    };

    var drawUp0 = function() {
        drawUpDownBody0();
        drawEye(DIR_UP,-5,-5);
        drawEye(DIR_UP,1,-5);
        plotSolid([
            -4,6,
            -3,5,
            -2,5,
            -1,6,
        ],"#00F");
    };

    var drawUp1 = function() {
        drawUpDownBody1();
        drawEye(DIR_UP,-5,-5);
        drawEye(DIR_UP,1,-5);
        plotSolid([
            0,6,
            1,5,
            2,5,
            3,6,
        ],"#00F");
    };

    var drawDown0 = function() {
        drawUpDownBody0();
        drawEye(DIR_DOWN,-5,-4);
        drawEye(DIR_DOWN,1,-4);
        plotSolid([
            0,6,
            1,4,
            2,3,
            3,3,
            4,4,
            4,5,
            3,6,
        ],"#00F");
        plotLine([-4,6,-2,6],"#00F");
    };

    var drawDown1 = function() {
        drawUpDownBody1();
        drawEye(DIR_DOWN,-5,-4);
        drawEye(DIR_DOWN,1,-4);
        plotSolid([
            -1,6,
            -2,4,
            -3,3,
            -4,3,
            -5,4,
            -5,5,
            -4,6,
        ],"#00F");
        plotLine([1,6,3,6],"#00F");
    };

    var borderColor;
    var faceColor;

    var drawScaredBody = function() {
        plotOutline([
            -6,-2,
            -2,-5,
            -3,-6,
            -5,-6,
            -3,-6,
            -1,-4,
            1,-4,
            3,-6,
            5,-6,
            3,-6,
            2,-5,
            6,-2,
            6,4,
            5,6,
            4,7,
            -4,7,
            -5,6,
            -6,4
        ],borderColor);

        plotLine([
            -2,4,
            -1,3,
            1,3,
            2,4
        ],faceColor);
    };


    var drawScared0 = function(flash) {
        plotLine([-2,-2,-2,0],faceColor);
        plotLine([-3,-1,-1,-1],faceColor);
        plotLine([2,-2,2,0],faceColor);
        plotLine([3,-1,1,-1],faceColor);
        plotLine([-5,-6,-6,-7],"#FFF");
        plotLine([5,-6,6,-7],"#FFF");
        drawScaredBody();
    };

    var drawScared1 = function(flash) {
        plotLine([-3,-2,-1,0],faceColor);
        plotLine([-3,0,-1,-2],faceColor);
        plotLine([1,-2,3,0],faceColor);
        plotLine([1,0,3,-2],faceColor);
        plotLine([-5,-6,-6,-5],"#FFF");
        plotLine([5,-6,6,-5],"#FFF");
        drawScaredBody();
    };

    return function(_ctx,x,y,frame,dirEnum,scared,flash,eyes_only,_color) {
        if (eyes_only) {
            return; // invisible
        }

        ctx = _ctx;
        color = _color;

        ctx.save();
        ctx.translate(x+0.5,y+0.5);

        if (scared) {
            ctx.translate(0,-1); // correct alignment error from my chosen coordinates
            borderColor = flash ? "#FFF" : "#00F";
            faceColor = flash ? "#F00" : "#FF0";
            [drawScared0, drawScared1][frame]();
        }
        else if (dirEnum == DIR_RIGHT) {
            [drawRight0, drawRight1][frame]();
        }
        else if (dirEnum == DIR_LEFT) {
            [drawLeft0, drawLeft1][frame]();
        }
        else if (dirEnum == DIR_DOWN) {
            [drawDown0, drawDown1][frame]();
        }
        else if (dirEnum == DIR_UP) {
            [drawUp0, drawUp1][frame]();
        }

        ctx.restore();
    };
})();

var drawColoredOttoSprite = function(color,eyeColor) {
    var ctx;

    var plotLine = function(points,color) {
        var len = points.length;
        var i;
        ctx.beginPath();
        ctx.moveTo(points[0],points[1]);
        for (i=2; i<len; i+=2) {
            ctx.lineTo(points[i],points[i+1]);
        }
        ctx.lineWidth = 1.0;
        ctx.lineCap = ctx.lineJoin = "round";
        ctx.strokeStyle = color;
        ctx.stroke();
    };

    var plotSolid = function(points,color) {
        var len = points.length;
        var i;
        ctx.beginPath();
        ctx.moveTo(points[0],points[1]);
        for (i=2; i<len; i+=2) {
            ctx.lineTo(points[i],points[i+1]);
        }
        ctx.closePath();
        ctx.lineWidth = 1.0;
        ctx.lineJoin = "round";
        ctx.fillStyle = ctx.strokeStyle = color;
        ctx.fill();
        ctx.stroke();
    };

    var drawRightEye = function() {
        plotSolid([
            -4,-5,
            -3,-6,
            -2,-6,
            -2,-5,
            -3,-4,
            -4,-4,
        ],eyeColor);
    };

    var drawRight0 = function() {
        plotSolid([
            -5,-4,
            -3,-6,
            2,-6,
            3,-5,
            -1,-3,
            3,-1,
            1,1,
            1,3,
            3,6,
            5,4,
            6,4,
            6,5,
            4,7,
            2,7,
            -1,1,
            -4,4,
            -3,6,
            -3,7,
            -4,7,
            -6,5,
            -6,4,
            -3,1,
            -5,-1,
        ],color);
        drawRightEye();
    };
    var drawRight1 = function() {
        plotSolid([
            -5,-4,
            -3,-6,
            1,-6,
            3,-4,
            3,-1,
            1,1,
            1,6,
            4,6,
            4,7,
            0,7,
            0,1,
            -2,1,
            -4,3,
            -4,4,
            -3,5,
            -3,6,
            -4,6,
            -5,4,
            -5,3,
            -3,1,
            -5,-1,
        ],color);
        drawRightEye();
    };
    var drawRight2 = function() {
        plotSolid([
            -5,-4,
            -3,-6,
            2,-6,
            3,-5,
            -1,-3,
            3,-1,
            1,1,
            1,3,
            4,3,
            4,4,
            0,4,
            0,1,
            -2,1,
            -2,6,
            1,6,
            1,7,
            -3,7,
            -3,1,
            -5,-1,
        ],color);
        drawRightEye();
    };
    var drawRight3 = function() {
        plotSolid([
            -5,-4,
            -3,-6,
            2,-6,
            -2,-3,
            2,0,
            1,1,
            3,5,
            5,3,
            6,3,
            6,4,
            4,6,
            2,6,
            -1,1,
            -3,1,
            -3,6,
            0,6,
            0,7,
            -4,7,
            -4,2,
            -3,1,
            -5,-1,
        ],color);
        drawRightEye();
    };

    var drawUpDownEyes = function() {
        plotSolid([
            -5,-5,
            -4,-6,
            -3,-6,
            -3,-5,
            -4,-4,
            -5,-4,
        ],eyeColor);
        plotSolid([
            3,-6,
            4,-6,
            5,-5,
            5,-4,
            4,-4,
            3,-5,
        ],eyeColor);
    };

    var drawUpDownHead = function() {
        plotSolid([
            -4,-4,
            -2,-6,
            2,-6,
            4,-4,
            4,-1,
            2,1,
            -2,1,
            -4,-1,
        ],color);
    };

    var drawUpDownLeg0 = function(y,xs) {
        ctx.save();
        ctx.translate(0,y);
        ctx.scale(xs,1);

        plotSolid([
            1,0,
            2,0,
            2,6,
            4,6,
            4,7,
            1,7,
        ],color);

        ctx.restore();
    };

    var drawUpDownLeg1 = function(y,xs) {
        ctx.save();
        ctx.translate(0,y);
        ctx.scale(xs,1);

        plotSolid([
            1,0,
            2,0,
            2,4,
            3,5,
            4,4,
            5,4,
            5,5,
            3,7,
            2,7,
            1,6,
        ],color);

        ctx.restore();
    };
    var drawUpDownLegs0 = function() {
        drawUpDownLeg0(0,-1);
        drawUpDownLeg1(-2,1);
    };

    var drawUpDownLegs1 = function() {
        drawUpDownLeg0(-2,-1);
        drawUpDownLeg1(-2,1);
    };

    var drawUpDownLegs2 = function() {
        drawUpDownLeg1(-2,-1);
        drawUpDownLeg0(0,1);
    };

    var drawUpDownLegs3 = function() {
        drawUpDownLeg1(0,-1);
        drawUpDownLeg0(0,1);
    };

    var drawDown0 = function() {
        drawUpDownHead();
        drawUpDownEyes();
        drawUpDownLegs0();
        plotLine([-2,-3,2,-3],"#000");
    };
    var drawDown1 = function() {
        drawUpDownHead();
        drawUpDownEyes();
        drawUpDownLegs1();
    };
    var drawDown2 = function() {
        drawUpDownHead();
        drawUpDownEyes();
        drawUpDownLegs2();
        plotLine([-2,-3,2,-3],"#000");
    };
    var drawDown3 = function() {
        drawUpDownHead();
        drawUpDownEyes();
        drawUpDownLegs3();
        plotSolid([
            -2,-3,
            0,-5,
            2,-3,
            0,-1,
        ],"#000");
    };

    var drawUp0 = function() {
        drawUpDownEyes();
        drawUpDownHead();
        drawUpDownLegs0();
    };
    var drawUp1 = function() {
        drawUpDownEyes();
        drawUpDownHead();
        drawUpDownLegs1();
    };
    var drawUp2 = function() {
        drawUpDownEyes();
        drawUpDownHead();
        drawUpDownLegs2();
    };
    var drawUp3 = function() {
        drawUpDownEyes();
        drawUpDownHead();
        drawUpDownLegs3();
    };

    return function(_ctx,x,y,dirEnum,frame,rotate) {
        ctx = _ctx;

        ctx.save();
        ctx.translate(x+0.5,y+0.5);
        if (rotate) {
            ctx.rotate(rotate);
        }

        if (dirEnum == DIR_RIGHT) {
            ctx.translate(0,-1); // correct my coordinate system
            [drawRight0, drawRight1, drawRight2, drawRight3][frame]();
        }
        else if (dirEnum == DIR_LEFT) {
            ctx.translate(0,-1); // correct my coordinate system
            ctx.scale(-1,1);
            [drawRight0, drawRight1, drawRight2, drawRight3][frame]();
        }
        else if (dirEnum == DIR_DOWN) {
            ctx.translate(0,-1); // correct my coordinate system
            [drawDown0, drawDown1, drawDown2, drawDown3][frame]();
        }
        else if (dirEnum == DIR_UP) {
            ctx.translate(0,-1); // correct my coordinate system
            [drawUp0, drawUp1, drawUp2, drawUp3][frame]();
        }

        ctx.restore();
    };
};

var drawOttoSprite = drawColoredOttoSprite("#FF0","#00F");
var drawMsOttoSprite = drawColoredOttoSprite("#F00","#FFF");

var drawDeadOttoSprite = function(ctx,x,y) {
    var plotOutline = function(points,color) {
        var len = points.length;
        var i;
        ctx.beginPath();
        ctx.moveTo(points[0],points[1]);
        for (i=2; i<len; i+=2) {
            ctx.lineTo(points[i],points[i+1]);
        }
        ctx.closePath();
        ctx.lineWidth = 1.0;
        ctx.lineCap = ctx.lineJoin = "round";
        ctx.strokeStyle = color;
        ctx.stroke();
    };
    ctx.save();
    ctx.translate(x+2,y);
    plotOutline([
        3,-5,
        -1,-5,
        -2,-6,
        -2,-7,
        -1,-8,
        3,-8,
        4,-7,
        4,-6,
    ],"#F00");
    ctx.restore();
    drawOttoSprite(ctx,x,y,DIR_LEFT,2,Math.PI/2);
};

// draw pacman body
var drawPacmanSprite = function(ctx,x,y,dirEnum,angle,mouthShift,scale,centerShift,alpha,color,rot_angle) {

    if (mouthShift == undefined) mouthShift = 0;
    if (centerShift == undefined) centerShift = 0;
    if (scale == undefined) scale = 1;
    if (alpha == undefined) alpha = 1;

    if (color == undefined) {
        color = "rgba(255,255,0," + alpha + ")";
    }

    ctx.save();
    ctx.translate(x,y);
    ctx.scale(scale,scale);
    if (rot_angle) {
        ctx.rotate(rot_angle);
    }

    // rotate to current heading direction
    var d90 = Math.PI/2;
    if (dirEnum == DIR_UP) ctx.rotate(3*d90);
    else if (dirEnum == DIR_RIGHT) ctx.rotate(0);
    else if (dirEnum == DIR_DOWN) ctx.rotate(d90);
    else if (dirEnum == DIR_LEFT) ctx.rotate(2*d90);

    // plant corner of mouth
    ctx.beginPath();
    ctx.moveTo(-3+mouthShift,0);

    // draw head outline
    ctx.arc(centerShift,0,6.5,angle,2*Math.PI-angle);
    ctx.closePath();

    //ctx.strokeStyle = color;
    //ctx.stroke();
    ctx.fillStyle = color;
    ctx.fill();

    ctx.restore();
};

// draw giant pacman body
var drawGiantPacmanSprite = function(ctx,x,y,dirEnum,frame) {

    var color = "#FF0";
    var mouthShift = 0;
    var angle = 0;
    if (frame == 1) {
        mouthShift = -4;
        angle = Math.atan(7/14);
    }
    else if (frame == 2) {
        mouthShift = -2;
        angle = Math.atan(13/9);
    }

    ctx.save();
    ctx.translate(x,y);

    // rotate to current heading direction
    var d90 = Math.PI/2;
    if (dirEnum == DIR_UP) ctx.rotate(3*d90);
    else if (dirEnum == DIR_RIGHT) ctx.rotate(0);
    else if (dirEnum == DIR_DOWN) ctx.rotate(d90);
    else if (dirEnum == DIR_LEFT) ctx.rotate(2*d90);

    // plant corner of mouth
    ctx.beginPath();
    ctx.moveTo(mouthShift,0);

    // draw head outline
    ctx.arc(0,0,16,angle,2*Math.PI-angle);
    ctx.closePath();

    ctx.fillStyle = color;
    ctx.fill();

    ctx.restore();
};

var drawMsPacmanSprite = function(ctx,x,y,dirEnum,frame,rot_angle) {
    var angle = 0;

    // draw body
    if (frame == 0) {
        // closed
        drawPacmanSprite(ctx,x,y,dirEnum,0,undefined,undefined,undefined,undefined,undefined,rot_angle);
    }
    else if (frame == 1) {
        // open
        angle = Math.atan(4/5);
        drawPacmanSprite(ctx,x,y,dirEnum,angle,undefined,undefined,undefined,undefined,undefined,rot_angle);
        angle = Math.atan(4/8); // angle for drawing eye
    }
    else if (frame == 2) {
        // wide
        angle = Math.atan(6/3);
        drawPacmanSprite(ctx,x,y,dirEnum,angle,undefined,undefined,undefined,undefined,undefined,rot_angle);
        angle = Math.atan(6/6); // angle for drawing eye
    }

    ctx.save();
    ctx.translate(x,y);
    if (rot_angle) {
        ctx.rotate(rot_angle);
    }

    // reflect or rotate sprite according to current direction
    var d90 = Math.PI/2;
    if (dirEnum == DIR_UP)
        ctx.rotate(-d90);
    else if (dirEnum == DIR_DOWN)
        ctx.rotate(d90);
    else if (dirEnum == DIR_LEFT)
        ctx.scale(-1,1);

    // bow
    var x=-7.5,y=-7.5;
    ctx.fillStyle = "#F00";
    ctx.beginPath(); ctx.arc(x+1,y+4,1.25,0,Math.PI*2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(x+2,y+5,1.25,0,Math.PI*2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(x+3,y+3,1.25,0,Math.PI*2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(x+4,y+1,1.25,0,Math.PI*2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(x+5,y+2,1.25,0,Math.PI*2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#0031FF";
    ctx.beginPath(); ctx.arc(x+2.5,y+3.5,0.5,0,Math.PI*2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(x+3.5,y+2.5,0.5,0,Math.PI*2); ctx.closePath(); ctx.fill();

    // lips
    ctx.strokeStyle = "#F00";
    ctx.lineWidth = 1.25;
    ctx.lineCap = "round";
    ctx.beginPath();
    if (frame == 0) {
        ctx.moveTo(5,0);
        ctx.lineTo(6.5,0);
        ctx.moveTo(6.5,-1.5);
        ctx.lineTo(6.5,1.5);
    }
    else {
        var r1 = 7.5;
        var r2 = 8.5;
        var c = Math.cos(angle);
        var s = Math.sin(angle);
        ctx.moveTo(-3+r1*c,r1*s);
        ctx.lineTo(-3+r2*c,r2*s);
        ctx.moveTo(-3+r1*c,-r1*s);
        ctx.lineTo(-3+r2*c,-r2*s);
    }
    ctx.stroke();

    // mole
    ctx.beginPath();
    ctx.arc(-3,2,0.5,0,Math.PI*2);
    ctx.fillStyle = "#000";
    ctx.fill();

    // eye
    ctx.strokeStyle = "#000";
    ctx.lineCap = "round";
    ctx.beginPath();
    if (frame == 0) {
        ctx.moveTo(-2.5,-2);
        ctx.lineTo(-0.5,-2);
    }
    else {
        var r1 = 0.5;
        var r2 = 2.5;
        var c = Math.cos(angle);
        var s = Math.sin(angle);
        ctx.moveTo(-3+r1*c,-2-r1*s);
        ctx.lineTo(-3+r2*c,-2-r2*s);
    }
    ctx.stroke();

    ctx.restore();
};

var drawCookiemanSprite = (function(){

    // TODO: draw pupils separately in atlas
    //      composite the body frame and a random pupil frame when drawing cookie-man

    var prevFrame = undefined;
    var sx1 = 0; // shift x for first pupil
    var sy1 = 0; // shift y for first pupil
    var sx2 = 0; // shift x for second pupil
    var sy2 = 0; // shift y for second pupil

    var er = 2.1; // eye radius
    var pr = 1; // pupil radius

    var movePupils = function() {
        var a1 = Math.random()*Math.PI*2;
        var a2 = Math.random()*Math.PI*2;
        var r1 = Math.random()*pr;
        var r2 = Math.random()*pr;

        sx1 = Math.cos(a1)*r1;
        sy1 = Math.sin(a1)*r1;
        sx2 = Math.cos(a2)*r2;
        sy2 = Math.sin(a2)*r2;
    };

    return function(ctx,x,y,dirEnum,frame,shake,rot_angle) {
        var angle = 0;

        // draw body
        var draw = function(angle) {
            //angle = Math.PI/6*frame;
            drawPacmanSprite(ctx,x,y,dirEnum,angle,undefined,undefined,undefined,undefined,"#47b8ff",rot_angle);
        };
        if (frame == 0) {
            // closed
            draw(0);
        }
        else if (frame == 1) {
            // open
            angle = Math.atan(4/5);
            draw(angle);
            angle = Math.atan(4/8); // angle for drawing eye
        }
        else if (frame == 2) {
            // wide
            angle = Math.atan(6/3);
            draw(angle);
            angle = Math.atan(6/6); // angle for drawing eye
        }

        ctx.save();
        ctx.translate(x,y);
        if (rot_angle) {
            ctx.rotate(rot_angle);
        }

        // reflect or rotate sprite according to current direction
        var d90 = Math.PI/2;
        if (dirEnum == DIR_UP)
            ctx.rotate(-d90);
        else if (dirEnum == DIR_DOWN)
            ctx.rotate(d90);
        else if (dirEnum == DIR_LEFT)
            ctx.scale(-1,1);

        var x = -4; // pivot point
        var y = -3.5;
        var r1 = 3;   // distance from pivot of first eye
        var r2 = 6; // distance from pivot of second eye
        angle /= 3; // angle from pivot point
        angle += Math.PI/8;
        var c = Math.cos(angle);
        var s = Math.sin(angle);

        if (shake) {
            if (frame != prevFrame) {
                movePupils();
            }
            prevFrame = frame;
        }

        // second eyeball
        ctx.beginPath();
        ctx.arc(x+r2*c, y-r2*s, er, 0, Math.PI*2);
        ctx.fillStyle = "#FFF";
        ctx.fill();
        // second pupil
        ctx.beginPath();
        ctx.arc(x+r2*c+sx2, y-r2*s+sy2, pr, 0, Math.PI*2);
        ctx.fillStyle = "#000";
        ctx.fill();

        // first eyeball
        ctx.beginPath();
        ctx.arc(x+r1*c, y-r1*s, er, 0, Math.PI*2);
        ctx.fillStyle = "#FFF";
        ctx.fill();
        // first pupil
        ctx.beginPath();
        ctx.arc(x+r1*c+sx1, y-r1*s+sy1, pr, 0, Math.PI*2);
        ctx.fillStyle = "#000";
        ctx.fill();

        ctx.restore();

    };
})();

////////////////////////////////////////////////////////////////////
// FRUIT SPRITES

var drawCherry = function(ctx,x,y) {

    // cherry
    var cherry = function(x,y) {
        ctx.save();
        ctx.translate(x,y);

        // red fruit
        ctx.beginPath();
        ctx.arc(2.5,2.5,3,0,Math.PI*2);
        ctx.lineWidth = 1.0;
        ctx.strokeStyle = "#000";
        ctx.stroke();
        ctx.fillStyle = "#ff0000";
        ctx.fill();

        // white shine
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(1,3);
        ctx.lineTo(2,4);
        ctx.strokeStyle = "#fff";
        ctx.stroke();
        ctx.restore();
    };

    ctx.save();
    ctx.translate(x,y);

    // draw both cherries
    cherry(-6,-1);
    cherry(-1,1);

    // draw stems
    ctx.beginPath();
    ctx.moveTo(-3,0);
    ctx.bezierCurveTo(-1,-2, 2,-4, 5,-5);
    ctx.lineTo(5,-4);
    ctx.bezierCurveTo(3,-4, 1,0, 1,2);
    ctx.strokeStyle = "#ff9900";
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.restore();
};

var drawStrawberry = function(ctx,x,y) {
    ctx.save();
    ctx.translate(x,y);

    // red body
    ctx.beginPath();
    ctx.moveTo(-1,-4);
    ctx.bezierCurveTo(-3,-4,-5,-3, -5,-1);
    ctx.bezierCurveTo(-5,3,-2,5, 0,6);
    ctx.bezierCurveTo(3,5, 5,2, 5,0);
    ctx.bezierCurveTo(5,-3, 3,-4, 0,-4);
    ctx.fillStyle = "#f00";
    ctx.fill();
    ctx.strokeStyle = "#f00";
    ctx.stroke();

    // white spots
    var spots = [
        {x:-4,y:-1},
        {x:-3,y:2 },
        {x:-2,y:0 },
        {x:-1,y:4 },
        {x:0, y:2 },
        {x:0, y:0 },
        {x:2, y:4 },
        {x:2, y:-1 },
        {x:3, y:1 },
        {x:4, y:-2 } ];

    ctx.fillStyle = "#fff";
    var i,len;
    for (i=0, len=spots.length; i<len; i++) {
        var s = spots[i];
        ctx.beginPath();
        ctx.arc(s.x,s.y,0.75,0,2*Math.PI);
        ctx.fill();
    }

    // green leaf
    ctx.beginPath();
    ctx.moveTo(0,-4);
    ctx.lineTo(-3,-4);
    ctx.lineTo(0,-4);
    ctx.lineTo(-2,-3);
    ctx.lineTo(-1,-3);
    ctx.lineTo(0,-4);
    ctx.lineTo(0,-2);
    ctx.lineTo(0,-4);
    ctx.lineTo(1,-3);
    ctx.lineTo(2,-3);
    ctx.lineTo(0,-4);
    ctx.lineTo(3,-4);
    ctx.closePath();
    ctx.strokeStyle = "#00ff00";
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // stem
    ctx.beginPath();
    ctx.moveTo(0,-4);
    ctx.lineTo(0,-5);
    ctx.lineCap = 'round';
    ctx.strokeStyle = "#fff";
    ctx.stroke();
    ctx.restore();
};

var drawOrange = function(ctx,x,y) {
    ctx.save();
    ctx.translate(x,y);

    // orange body
    ctx.beginPath();
    ctx.moveTo(-2,-2);
    ctx.bezierCurveTo(-3,-2, -5,-1, -5,1);
    ctx.bezierCurveTo(-5,4, -3,6, 0,6);
    ctx.bezierCurveTo(3,6, 5,4, 5,1);
    ctx.bezierCurveTo(5,-1, 3,-2, 2,-2);
    ctx.closePath();
    ctx.fillStyle="#ffcc33";
    ctx.fill();
    ctx.strokeStyle = "#ffcc33";
    ctx.stroke();

    // stem
    ctx.beginPath();
    ctx.moveTo(-1,-1);
    ctx.quadraticCurveTo(-1,-2,-2,-2);
    ctx.quadraticCurveTo(-1,-2,-1,-4);
    ctx.quadraticCurveTo(-1,-2,0,-2);
    ctx.quadraticCurveTo(-1,-2,-1,-1);
    ctx.strokeStyle = "#ff9900";
    ctx.lineJoin = 'round';
    ctx.stroke();

    // green leaf
    ctx.beginPath();
    ctx.moveTo(-0.5,-4);
    ctx.quadraticCurveTo(0,-5,1,-5);
    ctx.bezierCurveTo(2,-5, 3,-4,4,-4);
    ctx.bezierCurveTo(3,-4, 3,-3, 2,-3);
    ctx.bezierCurveTo(1,-3,1,-4,-0.5,-4);
    ctx.strokeStyle = "#00ff00";
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.fillStyle = "#00ff00";
    ctx.fill();

    ctx.restore();
};

var drawApple = function(ctx,x,y) {
    ctx.save();
    ctx.translate(x,y);

    // red fruit
    ctx.beginPath();
    ctx.moveTo(-2,-3);
    ctx.bezierCurveTo(-2,-4,-3,-4,-4,-4);
    ctx.bezierCurveTo(-5,-4,-6,-3,-6,0);
    ctx.bezierCurveTo(-6,3,-4,6,-2.5,6);
    ctx.quadraticCurveTo(-1,6,-1,5);
    ctx.bezierCurveTo(-1,6,0,6,1,6);
    ctx.bezierCurveTo(3,6, 5,3, 5,0);
    ctx.bezierCurveTo(5,-3, 3,-4, 2,-4);
    ctx.quadraticCurveTo(0,-4,0,-3);
    ctx.closePath();
    ctx.fillStyle = "#ff0000";
    ctx.fill();

    // stem
    ctx.beginPath();
    ctx.moveTo(-1,-3);
    ctx.quadraticCurveTo(-1,-5, 0,-5);
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#ff9900';
    ctx.stroke();

    // shine
    ctx.beginPath();
    ctx.moveTo(2,3);
    ctx.quadraticCurveTo(3,3, 3,1);
    ctx.lineCap = 'round';
    ctx.strokeStyle = "#fff";
    ctx.stroke();

    ctx.restore();
};

var drawMelon = function(ctx,x,y) {
    ctx.save();
    ctx.translate(x,y);

    // draw body
    ctx.beginPath();
    ctx.arc(0,2,5.5,0,Math.PI*2);
    ctx.fillStyle = "#7bf331";
    ctx.fill();

    // draw stem
    ctx.beginPath();
    ctx.moveTo(0,-4);
    ctx.lineTo(0,-5);
    ctx.moveTo(2,-5);
    ctx.quadraticCurveTo(-3,-5,-3,-6);
    ctx.strokeStyle="#69b4af";
    ctx.lineCap = "round";
    ctx.stroke();

    // dark lines
    /*
    ctx.beginPath();
    ctx.moveTo(0,-2);
    ctx.lineTo(-4,2);
    ctx.lineTo(-1,5);
    ctx.moveTo(-3,-1);
    ctx.lineTo(-2,0);
    ctx.moveTo(-2,6);
    ctx.lineTo(1,3);
    ctx.moveTo(1,7);
    ctx.lineTo(3,5);
    ctx.lineTo(0,2);
    ctx.lineTo(3,-1);
    ctx.moveTo(2,0);
    ctx.lineTo(4,2);
    ctx.strokeStyle="#69b4af";
    ctx.lineCap = "round";
    ctx.lineJoin = 'round';
    ctx.stroke();
    */
    // dark spots
    var spots = [
        0,-2,
        -1,-1,
        -2,0,
        -3,1,
        -4,2,
        -3,3,
        -2,4,
        -1,5,
        -2,6,
        -3,-1,
        1,7,
        2,6,
        3,5,
        2,4,
        1,3,
        0,2,
        1,1,
        2,0,
        3,-1,
        3,1,
        4,2,
         ];

    ctx.fillStyle="#69b4af";
    var i,len;
    for (i=0, len=spots.length; i<len; i+=2) {
        var x = spots[i];
        var y = spots[i+1];
        ctx.beginPath();
        ctx.arc(x,y,0.65,0,2*Math.PI);
        ctx.fill();
    }

    // white spots
    var spots = [
        {x: 0,y:-3},
        {x:-2,y:-1},
        {x:-4,y: 1},
        {x:-3,y: 3},
        {x: 1,y: 0},
        {x:-1,y: 2},
        {x:-1,y: 4},
        {x: 3,y: 2},
        {x: 1,y: 4},
         ];

    ctx.fillStyle = "#fff";
    var i,len;
    for (i=0, len=spots.length; i<len; i++) {
        var s = spots[i];
        ctx.beginPath();
        ctx.arc(s.x,s.y,0.65,0,2*Math.PI);
        ctx.fill();
    }

    ctx.restore();
};

var drawGalaxian = function(ctx,x,y) {
    ctx.save();
    ctx.translate(x,y);

    // draw yellow body
    ctx.beginPath();
    ctx.moveTo(-4,-2);
    ctx.lineTo(4,-2);
    ctx.lineTo(4,-1);
    ctx.lineTo(2,1);
    ctx.lineTo(1,0);
    ctx.lineTo(0,0);
    ctx.lineTo(0,5);
    ctx.lineTo(0,0);
    ctx.lineTo(-1,0);
    ctx.lineTo(-2,1);
    ctx.lineTo(-4,-1);
    ctx.closePath();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = ctx.fillStyle = '#fffa36';
    ctx.fill();
    ctx.stroke();

    // draw red arrow head
    ctx.beginPath();
    ctx.moveTo(0,-5);
    ctx.lineTo(-3,-2);
    ctx.lineTo(-2,-2);
    ctx.lineTo(-1,-3);
    ctx.lineTo(0,-3);
    ctx.lineTo(0,-1);
    ctx.lineTo(0,-3);
    ctx.lineTo(1,-3);
    ctx.lineTo(2,-2);
    ctx.lineTo(3,-2);
    ctx.closePath();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = ctx.fillStyle = "#f00";
    ctx.fill();
    ctx.stroke();

    // draw blue wings
    ctx.beginPath();
    ctx.moveTo(-5,-4);
    ctx.lineTo(-5,-1);
    ctx.lineTo(-2,2);
    ctx.moveTo(5,-4);
    ctx.lineTo(5,-1);
    ctx.lineTo(2,2);
    ctx.strokeStyle = "#00f";
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.restore();
};

var drawBell = function(ctx,x,y) {
    ctx.save();
    ctx.translate(x,y);

    // bell body
    ctx.beginPath();
    ctx.moveTo(-1,-5);
    ctx.bezierCurveTo(-4,-5,-6,1,-6,6);
    ctx.lineTo(5,6);
    ctx.bezierCurveTo(5,1,3,-5,0,-5);
    ctx.closePath();
    ctx.fillStyle = ctx.strokeStyle = "#fffa37";
    ctx.stroke();
    ctx.fill();

    // marks
    ctx.beginPath();
    ctx.moveTo(-4,4);
    ctx.lineTo(-4,3);
    ctx.moveTo(-3,1);
    ctx.quadraticCurveTo(-3,-2,-2,-2);
    ctx.moveTo(-1,-4);
    ctx.lineTo(0,-4);
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
    ctx.stroke();

    // bell bottom
    ctx.beginPath();
    ctx.rect(-5.5,6,10,2);
    ctx.fillStyle = "#68b9fc";
    ctx.fill();
    ctx.beginPath();
    ctx.rect(-0.5,6,2,2);
    ctx.fillStyle = '#fff';
    ctx.fill();

    ctx.restore();
};

var drawKey = function(ctx,x,y) {
    ctx.save();
    ctx.translate(x,y);

    // draw key metal
    ctx.beginPath();
    ctx.moveTo(-1,-2);
    ctx.lineTo(-1,5);
    ctx.moveTo(0,6);
    ctx.quadraticCurveTo(1,6,1,3);
    ctx.moveTo(1,4);
    ctx.lineTo(2,4);
    ctx.moveTo(1,1);
    ctx.lineTo(1,-2);
    ctx.moveTo(1,0);
    ctx.lineTo(2,0);
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#fff';
    ctx.stroke();

    // draw key top
    ctx.beginPath();
    ctx.moveTo(0,-6);
    ctx.quadraticCurveTo(-3,-6,-3,-4);
    ctx.lineTo(-3,-2);
    ctx.lineTo(3,-2);
    ctx.lineTo(3,-4);
    ctx.quadraticCurveTo(3,-6, 0,-6);
    ctx.strokeStyle = ctx.fillStyle = "#68b9fc";
    ctx.fill();
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(1,-5);
    ctx.lineTo(-1,-5);
    ctx.lineCap = 'round';
    ctx.strokeStyle = "#000";
    ctx.stroke();

    ctx.restore();
};

var drawPretzel = function(ctx,x,y) {
    ctx.save();
    ctx.translate(x,y);

    // bread
    ctx.beginPath();
    ctx.moveTo(-2,-5);
    ctx.quadraticCurveTo(-4,-6,-6,-4);
    ctx.quadraticCurveTo(-7,-2,-5,1);
    ctx.quadraticCurveTo(-3,4,0,5);
    ctx.quadraticCurveTo(5,5,5,-1);
    ctx.quadraticCurveTo(6,-5,3,-5);
    ctx.quadraticCurveTo(1,-5,0,-2);
    ctx.quadraticCurveTo(-2,3,-5,5);
    ctx.moveTo(1,1);
    ctx.quadraticCurveTo(3,4,4,6);
    ctx.lineWidth = 2.0;
    ctx.lineCap = 'round';
    ctx.strokeStyle = "#ffcc33";
    ctx.stroke();

    // salt
    var spots = [
        -5,-6,
        1,-6,
        4,-4,
        -5,0,
        -2,0,
        6,1,
        -4,6,
        5,5,
         ];

    ctx.fillStyle = "#fff";
    var i,len;
    for (i=0, len=spots.length; i<len; i+=2) {
        var x = spots[i];
        var y = spots[i+1];
        ctx.beginPath();
        ctx.arc(x,y,0.65,0,2*Math.PI);
        ctx.fill();
    }

    ctx.restore();
};

var drawPear = function(ctx,x,y) {
    ctx.save();
    ctx.translate(x,y);

    // body
    ctx.beginPath();
    ctx.moveTo(0,-4);
    ctx.bezierCurveTo(-1,-4,-2,-3,-2,-1);
    ctx.bezierCurveTo(-2,1,-4,2,-4,4);
    ctx.bezierCurveTo(-4,6,-2,7,0,7);
    ctx.bezierCurveTo(2,7,4,6,4,4);
    ctx.bezierCurveTo(4,2,2,1,2,-1);
    ctx.bezierCurveTo(2,-3,1,-4,0,-4);
    ctx.fillStyle = ctx.strokeStyle = "#00ff00";
    ctx.stroke();
    ctx.fill();

    // blue shine
    ctx.beginPath();
    ctx.moveTo(-2,3);
    ctx.quadraticCurveTo(-2,5,-1,5);
    ctx.strokeStyle = "#0033ff";
    ctx.lineCap = 'round';
    ctx.stroke();

    // white stem
    ctx.beginPath();
    ctx.moveTo(0,-4);
    ctx.quadraticCurveTo(0,-6,2,-6);
    ctx.strokeStyle = "#fff";
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.restore();
};

var drawBanana = function(ctx,x,y) {
    ctx.save();
    ctx.translate(x,y);

    // body
    ctx.beginPath();
    ctx.moveTo(-5,5);
    ctx.quadraticCurveTo(-4,5,-2,6);
    ctx.bezierCurveTo(2,6,6,2,6,-4);
    ctx.lineTo(3,-3);
    ctx.lineTo(3,-2);
    ctx.lineTo(-4,5);
    ctx.closePath();
    ctx.fillStyle = ctx.strokeStyle = "#ffff00";
    ctx.stroke();
    ctx.fill();

    // stem
    ctx.beginPath();
    ctx.moveTo(4,-5);
    ctx.lineTo(5,-6);
    ctx.strokeStyle="#ffff00";
    ctx.lineCap='round';
    ctx.stroke();

    // black mark
    ctx.beginPath();
    ctx.moveTo(3,-1);
    ctx.lineTo(-2,4);
    ctx.strokeStyle = "#000";
    ctx.lineCap='round';
    ctx.stroke();

    // shine
    ctx.beginPath();
    ctx.moveTo(2,3);
    ctx.lineTo(0,5);
    ctx.strokeStyle = "#fff";
    ctx.lineCap='round';
    ctx.stroke();

    ctx.restore();
};

var drawCookie = function(ctx,x,y) {
    ctx.save();
    ctx.translate(x,y);

    // body
    ctx.beginPath();
    ctx.arc(0,0,6,0,Math.PI*2);
    ctx.fillStyle = "#f9bd6d";
    //ctx.fillStyle = "#dfab68";
    ctx.fill();

    // chocolate chips
    var spots = [
        0,-3,
        -4,-1,
        0,2,
        3,0,
        3,3,
         ];

    ctx.fillStyle = "#000";
    var i,len;
    for (i=0, len=spots.length; i<len; i+=2) {
        var x = spots[i];
        var y = spots[i+1];
        ctx.beginPath();
        ctx.arc(x,y,0.75,0,2*Math.PI);
        ctx.fill();
    }

    ctx.restore();
};

var drawCookieFlash = function(ctx,x,y) {
    ctx.save();
    ctx.translate(x,y);

    // body
    ctx.beginPath();
    ctx.arc(0,0,6,0,Math.PI*2);
    ctx.fillStyle = "#000";
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#f9bd6d";
    ctx.fill();
    ctx.stroke();

    // chocolate chips
    var spots = [
        0,-3,
        -4,-1,
        0,2,
        3,0,
        3,3,
         ];

    ctx.fillStyle = "#f9bd6d";
    var i,len;
    for (i=0, len=spots.length; i<len; i+=2) {
        var x = spots[i];
        var y = spots[i+1];
        ctx.beginPath();
        ctx.arc(x,y,0.75,0,2*Math.PI);
        ctx.fill();
    }

    ctx.restore();
};

var getSpriteFuncFromFruitName = function(name) {
    var funcs = {
        'cherry': drawCherry,
        'strawberry': drawStrawberry,
        'orange': drawOrange,
        'apple': drawApple,
        'melon': drawMelon,
        'galaxian': drawGalaxian,
        'bell': drawBell,
        'key': drawKey,
        'pretzel': drawPretzel,
        'pear': drawPear,
        'banana': drawBanana,
        'cookie': drawCookie,
    };

    return funcs[name];
};

var drawRecordSymbol = function(ctx,x,y,color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.translate(x,y);

    ctx.beginPath();
    ctx.arc(0,0,4,0,Math.PI*2);
    ctx.fill();

    ctx.restore();
};

var drawRewindSymbol = function(ctx,x,y,color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.translate(x,y);

    var s = 3;
    var drawTriangle = function(x) {
        ctx.beginPath();
        ctx.moveTo(x,s);
        ctx.lineTo(x-2*s,0);
        ctx.lineTo(x,-s);
        ctx.closePath();
        ctx.fill();
    };
    drawTriangle(0);
    drawTriangle(2*s);

    ctx.restore();
};

var drawUpSymbol = function(ctx,x,y,color) {
    ctx.save();
    ctx.translate(x,y);
    var s = tileSize;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0,-s/2);
    ctx.lineTo(s/2,s/2);
    ctx.lineTo(-s/2,s/2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
};

var drawDownSymbol = function(ctx,x,y,color) {
    ctx.save();
    ctx.translate(x,y);
    var s = tileSize;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0,s/2);
    ctx.lineTo(s/2,-s/2);
    ctx.lineTo(-s/2,-s/2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
};

var drawSnail = (function(){
    var plotSolid = function(points,color) {
        var len = points.length;
        var i;
        ctx.beginPath();
        ctx.moveTo(points[0],points[1]);
        for (i=2; i<len; i+=2) {
            ctx.lineTo(points[i],points[i+1]);
        }
        ctx.closePath();
        ctx.lineWidth = 1.0;
        ctx.lineJoin = "round";
        ctx.fillStyle = ctx.strokeStyle = color;
        ctx.fill();
        ctx.stroke();
    };
    return function(ctx,x,y,color) {
        ctx.save();
        ctx.translate(x,y);
        ctx.beginPath();
        ctx.moveTo(-7,3);
        ctx.lineTo(-5,3);
        ctx.bezierCurveTo(-6,0,-5,-3,-2,-3);
        ctx.bezierCurveTo(0,-3,2,-2,2,2);
        ctx.bezierCurveTo(3,-1,3,-2,5,-2);
        ctx.bezierCurveTo(6,-2,6,0,5,0);
        ctx.bezierCurveTo(4,1,4,3,2,3);
        ctx.closePath();

        ctx.lineWidth = 1.0;
        ctx.lineCap = ctx.lineJoin = "round";
        ctx.fillStyle = ctx.strokeStyle = color;
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(4,-2);
        ctx.lineTo(3,-5);
        ctx.moveTo(5,-1);
        ctx.lineTo(7,-5);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(3,-5, 1, 0, Math.PI*2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(7,-5, 1, 0, Math.PI*2);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(-4,1);
        ctx.bezierCurveTo(-5,-1,-3,-3, -1,-2);
        ctx.bezierCurveTo(0,-1,0,0,-1,1);
        ctx.bezierCurveTo(-2,1,-3,0,-2,-0.5);
        ctx.lineWidth = 0.5;
        ctx.strokeStyle = "#000";
        ctx.stroke();

        ctx.restore();
    };
})();

var drawHeartSprite = function(ctx,x,y) {
    ctx.save();
    ctx.translate(x,y);
    ctx.fillStyle = "#ffb8ff";

    ctx.beginPath();
    ctx.moveTo(0,-3);
    ctx.bezierCurveTo(-1,-4,-2,-6,-3.5,-6);
    ctx.quadraticCurveTo(-7,-6,-7,-0.5);
    ctx.bezierCurveTo(-7,2,-2,5,0,7);
    ctx.bezierCurveTo(2,5,7,2,7,-0.5);
    ctx.quadraticCurveTo(7,-6,3.5,-6);
    ctx.bezierCurveTo(2,-6,1,-4,0,-3);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
};

var drawExclamationPoint = function(ctx,x,y) {
    ctx.save();
    ctx.translate(x,y);
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = ctx.fillStyle = "#ff0";
    ctx.beginPath();
    ctx.moveTo(-1,1);
    ctx.bezierCurveTo(-1,0,-1,-3,0,-3);
    ctx.lineTo(2,-3);
    ctx.bezierCurveTo(2,-2,0,0,-1,1);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(-2,3,0.5,0,Math.PI*2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
};
var fuzeSpriteData = {
    "fuze": "data:image/png;base64,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",
    "aywen_red": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAACgCAYAAACLz2ctAAB74klEQVR42uz9WZBleZ7fCX3+6znnbr5GREbkUllZe1W3unt6M0mo0cIIkMZ6BMIYMWZiQKYBMzBeeIAnsDEMQ4DxgMkwGcPIBA8glkEjG400I7W6R90SUrfUtKp6qequPbfIiIzwCHe/6zn/lYf//3revOUemVmVtQpPu+aeHr5cP/d3fv/f8l1E5kfuTVzzsdh5KEDWj+XO5/e/d//75M73bj8We9//ft/yziPWRwJCfcS9z6f6tey8/5F40z9iQSduCDq589A1eNROEMn3CF659z1qL5C/3QBMOwEXAH/NI+wE4o9cEOofgcDbvvjymmC7LvBMfej6Xj4jE+5mTVW/R18ThHyAINwGT9oJvAC4+hiAvj6G+tgG4jYb/sgEof4hDzxxTYbaD5D9wGvqw9aH3jtOn5X99E7w6g8pALeZbht4a2C189jUh9sJ1t0jnB/mgNQ/xMes2As0sxNU5ppMZ2vgtUBX3zc7wSTfIwD1MwJQvM8g3D1CdwPQ1eDbAEtgAVwC8/qxroHp6u/bPZLf77GcP+Dn//8BeEPQ7TYSu8HV7gTXNtDszmOb+TpgtPP1Zi8A94PppgBU34UAXO8E36Q+z2bnd24zod/5/vw+AzFfU4PyAYP4X6kAvKmJ2A0GuxN0I2BcH6OdF6+5Jvu9nwB8vzXgB+2E9zvgbfOxG4AXOwG4eyOt6te5veYk7QT1TZktX9MAvd/v/VcqAPebiuvqr92AGtUXa7rz2H3xdoOw3TuC7TUBeN1NIK/phOUHzH43ZcHdJmR7BE/rjbRbKoxqcG5qvej2RjbvNa7ZD7zd7jt+vzpt/QMcfOqG5qHdy2QTYAYc1Pez+gLuBqC55ijebULkMwLwpg57d3zz7QQgO8EQdxqR/cDb/q2TGpyrnQB018wNr2tQ9o/93a7b7Rzr25/1PcuE+gf0yFV7jUO3d7RuA29cg20GHNYgnO7VT3Yve+42KO81z7upBhXfRuZ7Vje8DYz9m8PuZPlZDcD1znhmP3CelcV2M5/b6a7XOx9v/5b4r1oGFNd0nO1O4E13Mtt058id7PzbbOdz450jdrfL1XszQfkew+SbBtPfSeDdVBPGnee62/C09e852AmW4ZrM9ayB9fZ37NabqxrQ8/rYXoP329T8yATgdZlve9dPa2Y7BI72stx0JzjH19RNdifLXXd0yvfRQIj3ufL7TgOQG4boeqf+O9jpgodrtiW7Acg1AbSb/XabnaZeI3ZuhLTz8b8yGVBdc8cfASf1cQoc79R6u0dyt1fz2WvmdNcdnTdms0EIHgpBK+BOLK9p2Js6ZyALATlfvYK/ZDW/lzMvx8SJlDyvJE1KtCnjgFGGo5SuXm3xrXXm7mmwbbi6azLebuCFa2pAbgjAoWa/y3rNtjEQrln/iR/1DLh77G4bjW3wHQO3gNv1cWsnACd7oxS702yYZ4xIRN574cU1r9Q3pOB3lEQBwRhShk+5gR+P5St8/SUCIJfPfRH497TgXyiBFoJxq5kJyXNtwzJnTkPizw2euzFis+LTITBNeftcrmt4xE450uwEWrqm8djvgm9qQHYDcFKv2zb4dtd/bud3fVeDUOQfjG53G3yTGmAnNeDuAnfq47RmxNnefMxcM5+T77dRyHtXeCUE5wJeTOUzS+BVo/lrjeFAwL+zcbySMl8zigeihPGXgb9hDF3X0qbIWIFVGuUcjwQEBEoq7oXIn9sMNClxmOCzIXAS024Q7mes/Xndsx75GXvi3RrQ1QA8Bx4B94E36uMB8Lhmx3W9176rDYn+AWk4tplvVoPsFHiuPu7WDLjNfvsNxnU13rsCb7fIOpOCR1ISheCjMTFJicQ7+60zKbiXMv/cGn7JKtoQ+YWY+Skp+DvW8D8adXTO8aaQtFogyEghGSGZSjgPkSc+sQw9WkomWnFiFSOteCrg14PiDw8JS+Y1JWlyZpzyVeQIEKI8Zcm737/fx7OG0GEngW+T+Wpn87K9rvs38Y9MAO7XN2anyJ7uBN826z1X35/Uf9s2GfaGY/Yq8FKt4wC6eky+LiULKdA5s5KSX24MbYz8V1xgIwRfUAKk5D+1kv+jlrRW87Fxx2/GzEZJAom3+g0xCxSJnAQhJULO+JyZasm9ccfCRzYxcjk4ll7Sx8hMR0ZGc2wt/+bFirUU/CNrSAp+JoX9UkAkIUow5px36sR8w0Cb9wFM2GZIvxOM6xp4k51aer95+64ew9/LI3h/rWX3ut3d4LsL3KsBeKv+23TnAn3L6iyXzHF1ZRdSkIClELwpBHMyPxczJzm/6xX5m6OGVcq8lBL/zGj+YYw81ZKXJmM0osw8YuDSBTKZTYjIDClHZrYpxVMIjLQm5oTMmcPGcm/cMcTE3HsernsSMDaGlydjPtcP/M/OLngiBP+gMfx3N45LAQOCw5yx+d2vStqbeL/XeCTXyvSa74k79d4lcFaP4NeAb9T39+vn57Xr9jvd8Ic+mlH/3vcn8207u+2Y5bges9vge26n8Tja2Ww014xWBDX4MrCUgo2QHKfMKMNhznxJa/6eUfwTo8hCcgAslWSSMrcS/K/HDa9rxX8UIhul+PnjI94eHF9fbRhJwYPVmnXIzJ1j7SOtloyt4dwFGikZG8ML4xFWSoYEy+DZhMjdUYsSAikkQgimxrAOga/nxNtdQx8jf2fU8C+05A+05vOt5VeM5kuN4bWuYa4Ez/t4dQaLG8ZXeedjsfPY/pv41hNiO2JxO8Po9c6c0d3QUYsf1gy4u0ttdlZL2+A72el279T327HLbC/49jMfGTiXgjMl6YEzrXigFPdyxgrB328tr+fEfa3RStENjpnz/Fkf+X0p+F2r+Z0QWTnPZ44O6GPkteWKw6bhrB/QUjCESKckJ11DSolbXcsTF1i6wHFriDnXAIsIQEu4HDzHbcN577gzKt83sZaV8wwxYpRiZBQSOB08x84zAZqY+cmU+U2reawkf3654Y8PnrhTEG4PxSxA5XenxTdUqXFfrs9lJ3jTTuBtG5GHO1nw9frx4/pvq50seN22Jf8wZMD9mq/dCb7TGmx3d5qO3Zpvdk3m+5bgk3W+dpAySSp+s7P832TiVxrDLxvFI2t5kOHSebSQeK15k8zvjDp+Xwnux8jl4DlsDCOt+cZ8SQLOB0fK4GpH3BrNSGlyhokx3Bl1DCky0opGKc42jpHRCCEYYsRKhUuZnDNP+4G5D1wOjo9Oxxw1lj4mViGycIFVTBwowUdiIknJj7nAf2vVcyEF//tJxxMl+cmQsDl/y7AQ4E2jOVOS45Q4yJlHUvIb1nArJbr8riDcR+K4a/bKeW9KIa450fMP+hG83+3aneA72Ml6d/e63d1xy3ar8S3gz7zzC363Mfy/OsvfPJzyNw9G/JbI9ELwYN0zxMRYa95abZhay0hLzjY9t7sRC+cxUjIxmpO2RUvJ437g3AUmRjM2ugSSkrwwGTExmpUPLH3AKsUrsykhZ2KGpfOsY8BIia4PJSUuJSRglURIictwf71m1rTc6lpCilz6wGVKvJ4y32g0Z0bxzcbw04NHAM+nxO81lmVOvJgzv2cU/3ln+PXG8o/HLf/JuOGB0gzAr7eGDPyYj0xy5lcbwydiuoqia4AJ8Rq4v7wGXS6f0QD9wAWguGbI3O4Nme/sBN5+8N1U870r+BZS8r89GPN/GLfcH3WsjOLcOUTKPB48i5g56TrujDouh4Fbo47LwfHibEZnDTFHZrbMYmPOaKWATKyjmZTLoNhIyWFjWYWIz5lWaRKZmdEoIXhjtUYJwbhmv4vBc+EcKWVWweNT5rRriRnujsccWMM3Lhecjlo6peiMLuMcYOEjQQoulOJ3Jg1HKfMpF+mF4NdGll+ednxFK14aPG9IyVFO/OwQuBSCNwQsleBvW02T4ad9ZC0Fj5Tk+ZhIO43aDXNDsYdA2u+I92Fd33EgfjcDcB9YsL/h2A2+7aD5sGbI7oZj96pm7YXgf3A85csCbktBEILWGIaU+epizZASM6uZGINWilUIuJSxSnPcGu7P52gpsdrQx4QgIYWk0QoXI0YKNiHhU+bQNjwdHA/WA8sQ0EpipGRs9FUGXIXIm6t1zZAeFxMTa3h7PeBi5O54wknX8uZyVTOxZhNKpjUIEqJkSyEZYiLlRDCKV5XiG43hNwR02vCTm56fdoHXreGnU+K/uez5aIj8tPO8FBO/aTUXWvBPrOZnY+LjPvJ7reWTPux2EfkZZdIuZG3/NdjNnB9KHfjdCMDrhsxbzN5Nwbet+bbzKHtN5rtaoyHgfzoZYWLkvxcSv9I2SK0ZcuZ3zs7RSiIQHDaWISWUkLzd9wwhctw0vDZf4FNibA3rGMg50yhNHwObGHkylGM2pMRB27AMkXWMhJwRQhBSqcOO2xYlBb/35AK33e8KgYvld658wEiYWYOLCZ/LX9BIiVaSnDMuJTKZ50cdlz7QaY2SgolWjJTi6/2AGLUgBKcpIhD8w9bwe0rwRVkG2Z8OiSDgKGV+xgX+qVG8bQ1CKX6293ypa/js4K9b+4k94IPZC75mZ+bK3pEdrgHB/kAE4D6SY3xN8D13Teab3jAIfddGQwJ/u7X8vycj/up8zd/qGr4oMkPwfPlywSZmZloxNpplCDRK0ihFzuUG3nhXJqui7Gxn1nB71PCRgxlTY2iU4rx3DDEiajaau4CUsgStVkzq0auEpDWah+s1Lia0UjSyBH8mY6UkC8HcBUJOzIzCqPJzViHSKMXUaB5vHCddy4E19Clyq23wKeMz3O1aVn7grB/opWTeNhzGyF85X3Mf+EJjmKbMKzHhBXQZfs4FfrlrGaZTLsmolPmc8+Q63H4fi4FmD9QhdnbJ+yic7ygTftgBeNOs76jWeDcdu88aMovdvzAIwV8dt/yUixgJf11LXl9veDp4hpRplGKkNY2WtErytHe4mJj7wKE1aAkuJSZG8cKoRZCZaIUgc2QbbnUt98Ydm5B44kr95lIi5owScKvrcCkxNoaYE3PneNwPaCU4sqbWjiCFYBUiKWdmjWGsFSElhpSZWEMrBY3WGKUwEoaYELVCW8fI2FiMEEghyELQSEWIiSEnPjcE/hsbx8ZoJsA/V4o/5iM2l+1Ph+APrObNzvI1Y/ivrgee92EbgO9Vq+/Wf3onCcQ93vJwDQTs+x6A1zUdRzXz3bkm8+1uOJpr1mvfcpXOpOT3tOKjMfDXWstXNhtCzCQhiBlemY7QSrIOgSEkljEyd56J1fQhMARPzBkrJI82PXNXGoa59wwpkXJmiIlOK2LOrGoWlUCjFUaWn50yRMpRfDE4ZtbWmyCBAC0kgoxRCikgZGiUYh0CS+dxMTJtGhptiDHhYuS5UcdEa3zKHHct5MxryyUxJawApSRPnEe0Dfe14k2t+OdW8paSvIzgZR/RwNuqrBnzZMxRTvyJ+Yppysg6wnkPiqveA/GyN7TeDq77PdTM9z0D7me/0c7Re2cn893dgVbNdmo+fd2cTwBf1YovSMkjrYkC/pHVfF4r/iBE5kPAKEWnFaetpVWKsVFcusC583Ra02nFzFo2wbOOGSMVKWd8FvQZLn3ifPCcD47zwSGlIAPPdQ0KWIbAyBhCKgGpZTmaBdCHkrmslCx8IOZ8NXY5bBpapQgpczE4fEpMjUVJiVUKLSUuZV5dLFmGiFGaCx/IwEU/sA7l5y1cYB0ip22DEIInMdNLwf94seFVIfiaVnyp0fyBhEda8SWt+A2rGKSiHzx3nGecMge1q+cdONp7cV52cYT9HmF+vQOM/baP4Q8jAHfvom0dsXv07tZ9z+0gW95zyCyA/4/V/N224Z+PWv6m0fzGdMLXpOSLm56l80yNYWo0I604spohJc5d4HxwgKCRkpgTQ4g0SjKkzMxalt5jlaJPGSsFQ8qsY2YZMyvvudVYptbykekEKFlRCoEQ5XhtlaRPiUhGClj4wElraJWi1QojBQvvaZTiqLUIIVnVmWIGzjbD1WpuEyNrH3hjuea5UUeMiSf9cDUzScDEaN7e9NwetfQxMhGCaUq8pSV9ZzkLkS9J+N224YtWc54iq5h5XsDHB8dvWcPPufAt+zhxs56O2IFwDTXgtqT5Be+miMbvVwCKZ4BKZ9cMm2/Xz+3Cqvb1Wa6CrxeC//m45T/LkS/5SJSC85R5bbFi4wsA4KCxWFk6Xi0lyxB5bblByzKXGxtDqySrEDgfAqet5XE/cOkTRkparVjFiBSCRkk6pTnpWh6uem53HUYKPn4ww6VEq0t2HWvNxw5mDDESYuK4MZy2DY2SjLXmdNRhteK4aXjUDxy1DTNbMmgfIwsfmFlDztCHiBFcbUwEpdOOOUEWSCk5bRqe9o6ng2dmLQfWYo3Gkvm60USjscAQKmA2Z544T0oJK+Fegl/tGjrgkz5erfS2nUWNwpv2xVsOyZY/slVsWO6oNcRv9xjWH1LwyT1o1WQHUn9c32+3G8+a870L/fFlo/m8EDxYO2IGiYAc6KQClTlpG1zOhJQYpcSQoY8JqwSKMjyeO8cmhFLcSMHCJ0KGsVY0WjG1Fp8zfQhMTUMGXExsUiTkxMi0XPrAR2dTnvYDfUw0WvPViwtOW8utVjNWmnENsInRzIeBc1cwfre6BikkB43hbDPgciTnzEhrQoqsQpnPHVjDcWOZe8/ce46sqUd64qF3vL3p+Zk7pyydI5F5e/D8khIMMaE3PSFGJtaw8JGzwREytBJEknxDCvSk468pxa90Fq0UxyHxr28GfmYzsJISmzLmHRTOdZJ0N6mCie8HHnC/fdfX4PpOdh5HO2SibkeT5VsYaXln6PQfdJa3+4E7XUMm82gzIOvo5KRtWYRAIxW6jkvO+oG5K0ery6Vz3WYZgcAqUFLQao2sgXbpQuk2tSYBfYxXm5E3VqW7nhjN0nsyEqMkwXvGWiMFgOLp4Fl4j5aCJ5vSbJy2lokpIIVvLlb0QTI2ipTLgPpJP6CEYKQVsTYoGThpGoaUWIeyY16GyKN1z52uIeWKtBaCk9byaLXhTp1TLmMm+chZ37OOYAW8NJnxcOO40IrL8wVGSWJK/NvLnodS8H8ftfxqo/mvrR1Tkbgd4vtRppA31Irfsy74OmjVdZuOXVDp9ujdkon2s9+7fvhbSvLvzzr+Ly5AznxkOq4zPY2qA9whJe6OO3yM+JzoY6QPCaPKAPioMYScWfqAECX7CQRGlWs29wEtFXdHZaziYmIVPGNtyCTmzvO4d7gQeNr3bGLicd/zZDMgBUgBZxuHrbM8qxRSyKvJ7Dp6zjaOlDOdLuCEmW3qTZGRQjBtDFoIOq1Zh0gfIlOrOa5zwEf9wGXvuDfuaFW5ybRUJDJHbQspooCLYUCLzNuD4zJk+pj5+MGYqdH0KZVCLXq0lNyTgn9nOfBZH/mZ3vFLreHvH015PiZedp4oBPLdG49t97vYOYIv9lQawveyBhQ7R67ZgVbtcjl20czb4DvcgX1fe/QOQvBrVvNrRvHXpWDuPB8/mPFgvSGRGRnDWCmsErgYUdu5mS/zOlW7UylEaTBixKWEEQItBb6uzUBw2rVkoFGSp/1QYFpK4VNBM7uYKt9IMA+BuQ+0dQitRQZRVnGbELhwngerDY/7gZwpQ2opWPrAOgSkkFhZgtOlTKhH8BATmxARQnDQWDpTnvOQEkvnsFLwscNp+Xu04cAaEgkXApJyDebO0WrBkyFw7hKbkLjVWowULAfHi6OOIym5PWoYQmTeNrytJJ8OEScgCfjNpmXVWP74coMof3QW7w7A/hrVrtUN2EHx3TyCr2Nr3cRiu31N03Etpi8BSQi+YBQvpMxGZkZKcW8yptOGs/6C41rkH9qy8D+0hk0NDBBsYsJHx9goEJKYC5hAidLhhgSHrUULCaJsKpQQNEpxYEutGAVcOI+oA1sJ+JwIKTOzhrHWnNTMetY7VqGs8ZSUjGo3LkW5cWwue+VYh9gXzpVGJJfjNaryalmlGGIkO1AC5s7TKMndUYsWZRzTGYMSkHNiJCVGK4TISCkQSvLYBR4OZTZ5p9FMjOSs97w4anl93XPSNeQomDQN97qO35KS31GKQcJfWA38eIx8wWi+NGr5sdWGJASirI72G0y7J4+y3Zj490GM+lAyoLiBSHRyzazvOiZbsw+t2jYcnzeaIAT/WEv+xmzEOsOdruXcOULOfOb4kI9Nx2VAnDIuRTpdkMZbTsZpZ5GUMYfPZX7XKoESApcyLmVEfZFXFWAaUyqdrdH4nHE5McRMynDUGKxSPDcqa7Lnxx0IyVnvUELwysGUu6OOY6uZWsNIK4Qo6BmJwNTAPNsMQJktvjSdMHeeS+eJta7VUrLw/qqJGRnF5eBAFICCT4kQIzFnYq7zxxhqneo46z1Taxhrya2uJYt3YGAhJ/qUebje8PyoQ0UHOTGaTnEk/uJiw20f+SUtuRUjPzl4khBZfiuTbtiT8ug/jHWc/g5qv13G/snevO/2Hod3H9d3BS6QwKUUfEMJ3lSK/4fVPN90SJ14e71GSsFnD2dMtUJLQR9hiJF1KDXcpY9kYKQkm1B2rGOtSrsmBCGV1VYGGjI+Cl6Zjrkzaq8y5Nfnq6sAGGsDBEaqNAedKhuNA2vwKfF4M3DclE7yvB94sN7Qh4iWktPWcthYlBD0OaKyRosyIvIpc+E8crXm4wdTHqzWPO4H7o67clEDuBjJaKQoWe6tdX91nKpaVmgpEQLuX6y4PR4BMNKSY6vZhMhbm4Gp0cSUWMYyOdhEx5E1WClpJby1WHHXWCZNw988nvGLZxf00XC27YLfyX5iD8u5Pe0Od0SSwl7g+b3P5Q/zCN5ftU1uOH5P92o+exOcXgC/IyV/1EX+TgOf0B2PY2TpPIdtgxaZ40aTUuL+cs0qJF5drNiEwNRojNb0MbKOgSEmWq1RUjJRCilyweIpzfOjhrvjlomx3J2M6b3j8WZgyHDSGnyKrHNi7R2nbVuaF0qzcdQ0LJzj0vkCShgymxDK6i7B1DbknLiome1212KlpI+BidUctSUAhYDzYQAhuD3usEoytZaLwSFaixKw9pE+BJQQ3K6bGC0kywonG2nD85MRxljurzYcNJan/VCeW+WeSATHbVOwhTkxMZq7kwkXPiCt5MIHhsWKFw5mfEVJ/t7IliYpxV3Zh5s2W6s9zjB7jgP9nsjRM4Pw282A1wFMtyOX4z2Agbkm+MQ2mnsheCrgv5ASLyTFurG8tVzywmTMxTCwSuXFXjjHE5e4dJ4DY5hYzSpENoNnajRDzChRDg5RgQOtFEy0wApIKTB3nj5l7q973lqu6IyuHA7ByBjujS0PVxtcTtwddWQyR41l5cqKLpFJEWRKrH1AKcWQIquhR+QyuhlpzcN1z3FTsuHCeSbWXHXKSsDCeaQQLF15Tre6lpwzRgo6VepGkWHaFI6Jq/D+mDMP12tarbBK8fpyjZIliF+bLznpLLe7lo13BcsYEy9OJ5w0houhr8gewZAg+sBbiwUtgq8qxfng+HGftkQh8YzV6u7+d5/vw94KL7/XgPrbyYD7qk3TnbR8cM2wWe2NW97F5xDAL1nDfSVxXcfr6zWNFHzzcsEmFAbaxeAQQuATTLWiUQIjYNJYnojA494x1qo0D0IwMZonfc/UGsgJIQXLJJhvPILCbDNKMh8CT53HSsF5XzKckQItJJ1RNFKz8UNd68E6ZGaN5Lwf6LQue2MBrSqUzBihTwklFH1MPB0ct9qGWOuxVgrGxiAQLJyjUYrHfV8AsUIwxMBIaQQJKyXL4BFC4lOm04qVc0yN4cmmx9Qd88J5dCuxSjJWklttw0JJFs7xkVnHJgS+Pp8TUkF6d1pBrZsv+oGZMTwZPJ8Skn8tfAtmcJdO0e1tPMQ17MS8B1rN14hPfFsBeBO/Y1+ddF9W9jr+7rt+4Gta8Y+V5Ne0IsXIWb/BSsm5ixw1hsebgYRAS+iUwKrSZlgpOWwMP3HrmG8sVrw6XxXsn5QMMdAoxaJ2lCHDUNdgE63IZFxM3Bq1BGrnKSWXg+O4tZx0bc2miTeXK4xSrELkwDYsnadVio/OxqQ5DCGWLY1QKFlOnKUPvHIwZeU8LmVaJTgfHK9MJ7iYCiBVFrjW7bZl7gpQISaYp8hpW6H9LnDcthiZaFQhOPlUBuIvtS1WUm4u7zltGw6sJqTEzDasfKAPnoXzhCy4cJ4DWzO+EPiUkAKWPoKU/GUfaVIm7qSyPYh+vkbJS+3tjXfBqn4HwPqhNSH7O999XebuBh7Hu2o+gLkQXAr4D7UiSUkKgQfrodL1E50uF9MnaFT95ULSx0SnJFNr6IxBC8knZxMOreH1xZK1L+iYVpWLvIkl2DpdmoS5jygkPkVen6+YWIOpQ16r5FXdR86c9T2d1ix9IGbIZBolaJThyWbgM4cz5s7zO08uuDsecekSrSpAhPPBMVaKqTX4mJhZxTcXS+5Nxry1WnNoy2jFSMlEl79LS4kUglRXg51WTIzhoDGsfeC0a3m4WnNgJUMoCO3tTXbSGHyGTgi0lNwZj3i63hCyoFGCF8cd6xBZpe0qUDF3nk4r/rSS/Btrxx6ZXeydevu1ntzjiYQ9j5NtlyyfdQzr71BSY1dvuX2GLNrVfvdNJfmVxvCPlOSLOdOOR3Qh8PuXPUpKZrVWapRi5T2NhpjKWGThy7EVc+b8Ys0Lk4xRGp0jKiV+7tYxl87ztcslqxA4bCyPe0efIhOh2NTRC2QaZQgpoYRgqjVPo8dIdbWRGDdlV3w2eJYhMTIalxIhJk47w3xwXAyel2cTfEqcDY5WSY5by9x5zvqBhSy15ax20JlS//mUeLDaIKsIzFhJZtbQak2nFJfOoYRmasr3WSkxjUWQ2VhT6uHelXFPHcYvfEKJzEEjCalk2ZPRiFEILJ2jVYJZYzm/iPgUMEkipeDnteKvrBw2X6vAsB+E1zFCt3Ifmx3Ry10pYf8sjZn3MwfcP3q3+97j2u3e2iGRT/e0W+QulP4bSvGfNoZ5hq9YxVNtMELwaNPT1Wxx1hfS9vng8KmMNzaxvAiy1ng+Fq5GoyQxVV0WW/R2Oq24N+64cI5zV7YXh1YXoGlKjPQ7WoyNkrRKsYkRnzKtUiTguClbh7dWGy58uIJDLb2vSgeCW11DnxKtljw37njSOzqlCLms8Za+TCJ8THx0NuZ8cOXY9WXQvfKlizZSMg+Fg9LHyIP1hpDLtmThAyknLoaBmBJr73m46svfnTOhbl2GmNjEwL3JmJDhk4dT3liueGE6IaaES4mhNiRCwMXgyTlzd9zyi1nyqcFjEVeIbPHepkC7yWVf9nf9QQCrHyQAzQ2zv+vGLlertu2x+0BKvqoVnw6RSzJf6lqS1nzjco6SEoTk8bpHVBjVRG9nXpIDa5hazfOTMZ89PuS5keXQak4ay8sHEybWElJ54S8Gx8UwcNQYjhpbAk0r5q7At0Z173qrbXhu3DE2pgYLBW6lJZ0SPFj1nNXarNWSULNwo0qDMTGGFycTFs5jlaRTik0IPOnLFOJjszGNLNl2PjhujTr6GBAInvQDjSrD700FthopedL7q32ylepqr+xT4nLwBcMoBVZrLn1gFWLd6JTn1WhFq8qxnTOcu4GR1nzsYMql8xy2hRr6YLXm+ZFlpBSvNobfbg0v+ci9+lyGSgMIQmyLvOu0C2+S+Fh+EMDqewXgvnTurp7L6TXCkeNrkC4kUTYdPxUif8tofq0xvCklcxfw9YVd+UDIcNJYbo1a3l735QmKLbqkodUKHxMb79mEIhb0xmLF25s1Sx9IObMOgQsXKiFd8lO3TwuLTcDUGnQ99o7blucnEwDeWm9wqZCGYk486R3nPjBUAUlyqQsPbQnqA2vQskCsLp0jpMy98Yg+FBbcZ44O+MTBjMth4M3VBkHZ9Z52bVFD8P5da7iQE0YqpCybC1FROYLtPjmi63J2UTPyEIsEUaMkRhXEt674xjeXK56fjjkfCuJGAc+NugJyJXM5OExF39xqLU+F4GHXsFGSpRRMEoxTYq0kl1oxKeWDEN8afGkPsLr4oIDV9xOAN+19d5VLT66B18sEQgLf1IovaMXfbzR/SwmeGEVKiSeDY1o7s5FSBRSqFSvnKaCVkgEnde+7qFg5QVniW21Y+UgfC/nHp0hIGSnrDjZFXluu0VKgRVGnWvvI2BTo1e3RiJX3fPlizmePDgip7HZDBp/eIReVC1GK+5gzz0/HTE2hWnZK0elSHm1CwKfEoTX8i0dPeNw7Mpm585x2DbJuRbY8lFSPh4kxDDXTGiFJVd5qSAklRUFsx4SuvJd7k465K0hqLcv3bGJiajRjY7l0A49WG+6ORxgh+Op8gRGS58cdv332lLOhUBM2ITIxhqO24Zsx87Vxy9e7hiFn1lLwURcYlCBISfuOmuv+uMXdAFhd7IEV0rcTgPubj10Ztds3kIvszvErBPDr1vJ/HTX8BvDnMvyEC/xqLAQgWfVTlj5y3BqsEhgpeGHcMdGKlyYdnzs+4lbXMrGGV6bTKpMWaFXZwU5MCd61DxgpGOkCwxeikMzPh4IOnlrLk8Ff8Tkg8fXLJW2FVF06z5HVdFpz6SNNBXz6VICuRkpemI7Luk7AJiZiTlfMufkw0GrN/dUal3P5HiEZGc3Tfiholpy5Pep4uNqwDpFWFS7J3HuskHRaM6Sy922kZGoKcX6kFQI4bRs2MfKoH8pMUZRs2WlFX4fWI62ZuwGrCvfkqG14tOk56zecD56FiwhRUTlKcWs84k7bMoTISgo2rcHFyEJJ7sZUJtEp79eGu/4m26N3C9W6rAG4fq86UH6AzUdzgzHM5JrG40oyDeBfaMGbOfPZnPlL64HfrKgTqxS+wqpemnSElEipvKBl3RZ5tB744pOnvLVaISlZIefCtZWi1D8Xw8DKORpVdF5eGI/52MEMVYv950YFX/egHuurENFC8OZiwdNhKDXqesOB0XxkOqHV6qpDPbCaVtUMqjWtkpz1fbn9K9Ll0jmslMyd43LwbFKCnBnJshpzFWC69B6NQOTMc+MOKWHhwhX6ZR0i31ysAJhqzWFjmRrFkTUcNw0fP5gxtWX1Nq6NiJYlaLdsvkfrDUII7oxalt7zpB/YBM/YKB73Q4kDAZtYyFNz73lrVTYqR6OOkAX3teLiYMJtIbnfWH67tdft057FJeH9oqWflQHFNXvfwz2w6e1r2G0KkNvs95tacSYlXzaK45j4FSP5vFQMISFEZlnHJS4GzgdPFmVoLISgUxqtFRfO4eqecu0DPsbCfBsc587zdPC4VLLaQVPkOVYVI9gYw9x5Quaq+0xApwWvL6twpJZYKXh+Mub2aMIqJJbeY1TpvKUAK8uGxShZf79hFULZ9xqDT/Bks8HnVIALMVUkSySmfDUMuzPuULkM0l0qApblqJdYJZgYg4Ai2yag0aXZkkJwp+u4v+4ZYmTaWIQAFzORMmT3lfVWkNZlptnp8vNWvqBgcoZFiCgEt9qiBjazRRMnpBLQNgt82/C0a/ipJ5eF+CQFt0O6TvR83/bhvL6f7zQi4ds5gvcJ5rM9Icnd4/daoGkS8DWtaBF8XkvOcuZVRKk9rClaLFKxCb4CNQtg86gxNKrM3bZ/cqc1khJYz08mPFytWHpPqzQL7+m05MhqTrsWHwtgdGoMWmQerQf6VH72SAmMEjwdynhqVnfKR63lpekBh01zhXrZNjJ3RwWxctwYQi0drKwBUlWwEpmLvidmMBW7J+r6bWo0SpQNiYtlWD1WAiVgYjUhwSoE1hW9LSuK57i1zIzBpbILvvSeTOGalK471heqIK5HWqPrcHuo4uenrUWI8jf3IRayUz07rSwaDkZCzGW8ZKXksK2qXUryhlH8Fy/XvG0Up/GKN3JdAzL/dgJQfwDo1a5r0a5RzLVrtzIgEkTgi1ryFzaOf2YUv6U1d4wGqdkEz+XgaGTZd2opaFWRQDtoLIsYkSnRSEGMEZcl98ZjXl0sGVLmuLFcuLKlOLAGIyX3F2sAjFL0QtDHogHzaDPUtZxC5LIem1VuRicFp21XRyGubFu0JCSBIjPWmmASQ4z4GMuoJMVCcq9ZZoihAEaryoKVgokqI6UhwVqUDDMfBl5LkTujFiMER1bTCMEQy452HYow0t1Rx0FjeXvd02rN08HRh8KKuzvqeHOxriJGBTRrlYScmVpbOTIRIzMXw8BB0yByuRYulbJlZgq8LQFPhsClT3ziwGCV5NIXmbnkB75iNY9aw0+uBl4zis+4b1sE4QOv4uQNATjZscO6bvV2VaGanHkq4J80mr8cIq+HyHlIZXQgUw24MoqQQnC7sayDpzOKtQ+QQUmYWV2kKTK8tlgiyXziYEJOkbX3jLR8l2LB2GhmjeHhquetTQmomZFFXUCUjlYJwcN1z1hrMol1KPD5lXd0WjPVghDKkn/lHDmXGV6rSoJvRCYLkEoSc0TmyLHVjHQhmzfK0KkyQvIpMZK6aMXkMkrZAh+aIFASTps6o4ylrhyi543FQEJyXvfPY2NZ+QJVO24tLickmSdD2eiEWgcGkbnTFZK+FILHm4GjxnLStpxtNkX/xhVMpaSAYMv4ZsknzBFDDGwyLAZHKxP/sNHc7j2XUnzPVPL353+7ATjeA5mamwz/MvCnfeRvhMhfG7e8MThWQ5nXeVnqlZAiz41GrGPmchgIKTJpLTOjaCtx+3IY6FRmHSOnjeaj02kp7FOgVQqXAn0ITKoiwtgWfJvPuR6TgmVIBCU4UmUT8nhwjHUZFLda42Mk54SLgZQjY20IJqFkgVANIdNK6IxCy3KkWiWIOZJTaUgOrea0bUm5yKwZWfgrVFWtR33P43Wxb1i5wqLDKMZS8mA9oGRAC3A5M/eRTXVoaqTkrZg4bRsOrcHKwurLOWO1wshYtasVkszUKJ72jpgLnMwqxRvLFbHOfdY+4lMB7h42lolWdEoy94FHm00hTeXEJsayypSaw87wky5+TwLwpr3vrin0TX5s3/KDAnAsJH+AINUBVyIzpHKhGiUZqhoBJFzMXPqEcIE7UvHSdMLCWr52uSyghAxPKoTppG1I9AhRVmUzazFSocncXw88rZTLWaNZhlgbg8IjbqssRsEDZppRS6cVKWrOhoGcE1Mt8blkCJULDdNIQR8D08ZyakvGuvCBqS6jnFYbXCzi5be6jj4EhCxH4oExdBN41Ace9Y6Z0biYSVoytZLzwTOvqlihXquQYR08Vipyziy9Z2IMx7YIHlmlEThOuyJmZGSZEBSktObBZig1t5YsXMAoiRaCtnqYHBhFQrAMZZTTKYXPmbeXG4YY0VJgU0T7QJ/z9zQDymuol92el625zhJru9T+e43mb4xaHmnJ09Vw1ammXIe7VUMPHWmV4PEQGRlbtFFcILDiteWKe6OWj81GPKwbi3PnObQlOx41Fi3KJuW0a7lwCecyRkputYYLF3i0Kcv4VpUaq1OKPgZ8zDRSMDOKFD2LYaBTgrGSKKk41IrffjqHWszHnAu1UxRYV6sVR63ELVbcatvKkotMTUtKiZBiRWgLjo1Bk1l4OLRFoauQouBp77jdWe52DQ83AykWLdMsRFk/acX54DnrHYLMKzNNay0+wcgIOq3QothF9EIQEcSUOF/1VXCpADqMLNqFVssywEuJmGHuHHNfEeZCMNaFe7yJkSYL1lLyQs48+B4dweIa9tt1woX7dgnsAg/+s9bw77caQ8InQc5l5SZlAQC83Q+cDY67XUOnFYsK+hxSUXYv+9cyOvna5YqTxvDiuDQdY1GOzu3PM0oSQ9kUpCrI3SqBJBN04UFIMhcuMdKSkZYsQ1mvzUz5OqsEIge0sBwZxRMfWERBqxWtLJyTdUw83jh+/GjKcdOyipHbjeXRuiB5OqU5sQaXE2svWMfIR0cjhhhY+cCdUcdxbBgPPROteH21YWY0UyN51Bew6VFjmMQi43bmYm008tV6Ttfp6sN1TwSO26ZyoiOP+p6x0Rw3Bl+z9RATSx+LQlcqNXAkF3UJBPfXPUbAVCbG2eFcZu0kpnb45y5wYgVTxJUv3octp/Z+8X+7ruPmOtjV1lLnm0rya1ryv1o5DoXk1eWaRklute0VENIIODCKTQzM3VY0UhZZjBAxUmJk0VvutCIjiuZLnfwPMTM2BYRw1FiMhPurFUZAJytMI8FHRpbnGlWaE10ubMqJiVYl0wFawLG1PN+1xFwyxlQr7i/LzzuwhoX3SDLHVtGoMpD+2HTEk8HxwmRCowTPj1qULEjq5ydjTtqmiGKGxO1Rx8vTCS/Pprw8mXCr6/hDJ0d0qkCwThuNj0V5S0qFEoJDoxhrVbRcBMRYGzetGULguVGLFOVIXVagKRQyfqtUmXnmTKtkJdPnKkdMVXHNnNqCR3yusXykMaSU6n67QM8g84lc1Fd/3sfveRNyk27cvkYIWzYzGX7dGv6tPvDVxvL7ZGZa8/bG8dnjls/aGZcucKujsNh8YJAFZJorB7fTqioVRKZGcmgtF27ACJhX1QOAp5ue1kjmtSu86B1SS1IKHBnNgW3opODV4JmZMupZ+EQmcmp13e8WAMRIScZK8dpqQwJOreZAl9pt7gInjSWmxAvTjnujhoxACMmhNdzqOn7j0RlPneNO1zF3jqk1zIeBhQ9YJfnM0WHRfU6Z01FDn7myd3hjueK0UUx0pE9F4SFmmNmCvDk0RXnV5YyovJOl91dYKCkUrZSMtKBTsh61kdtdS0jpavZ30Xu0EPShCCptgalGlO7+PAT6FBkpwdw5LmLmxCj+oot8IiRs5nueAfcxYDcZA4pd15u5gL83tvyfxg2y0giVgMthADJ3Rg2vzGZALtzeeoe3StKo0hwkyhGScxlTCMqGJOTCEiuQds9FX/RixqagxvsQiMBPHM/4saMpPpfffaDLcXRoJSllYioABglXGeRryzUiR+60FgmFTpnLJuT5UanxprZhZgyHtlAfDxrLrDF85mDCVy7mfHOx4Lwf+I2Hj+hj5Plxxx+7d6eiahJKgMyCO51lHSIvjEd8+mCKrWMmJSSvTFpOGs3SBWZG0sgyaG5qR39gLbKiWhZ9XwnxmU4KGlm4M6sQSKncwL4qco2N5KQt9EwlQEvJ097TCAgx8dbGXalL9Bk+bhT/uyHxR3zE7mgLcr0T503Gid8RL/j97Pu+5e1NLfjNRjPWiqdDZBVKk/Fo7aovh2ETyhhkEzNjXbi3SgqcL0eJEpKRUbRVxZ6dGiRlqoh4RqqyXnvcO0ZSEHLgjml4UDm1bZ01rkLkyEhWMTPWAiPqBiBlLgbPrClrsHvdmEXtal0qKzNy5rXVmudHLaeNxaWMFJl7ozGbGEgp8fxkxL3JmL//+n2WPvLZo0N+4tYJJ61FS40QgdloQkqJxWbgpGm5dLFuYywfnQrkUvD6asNzneITjeW5LuJi4GxwrDz4Ku97tllx0feMdGHNKSHonUMIeYVttLI0J74CFcZC4FNmXQNxXffhx43FZbjdGA6U4PGmx0jJn0+Jv7QpXiOJUieLmwPvOuvY96WOoL8NEcobZbkk8Pta8URKEJqe4kw5s4YHqwElyxquDHzLEn7lHa0q+9o+FGuFVQ2uVkqaukT1VUiSLHi4GXh+3OJE4ung6VSpHdch89Fxw8+eznh743i47q9U6hFFh7mRcLeVJASnbeEJn1WAqCYy0y1KlIt+u2t4uNlw7hx3uhYjJG8sV9zpGuY+krNgVMUxQ4YDa/nLn/s0LqVCK9AKKSWXmx4hBEejCYMfIGVcjLw0GXF/uUZVCd9PzCacNpqvLDYcN4UqsBGCV4zh7U3PuQsIIVm7AZETWmTO3MDSDXx82vDG2jHE0u2WmWTDW+seJRKCrUBSsQZrlbmqw5ch8PVVTydAK8UoRz6ZBA+k4JWQMPldkZT33JZ2lfPjB7Xzum4XLG5Qud/V+ptdBz5dSMETKbivNV9XAi8lsroGXfrChQhVjWCLbFFVRsIqgdWFk7FdKzVKXX3c1X+LgBGCS+cLdD1xNbA9tYpPHozLqixntBBMraWTgvvrAZ8zHx0bOqWZWc1x0/KpgxkvTkY0sqyqYt2tnjSWkVY8P+o4Mga5RWMKeaWCMLOGA2MQovjETawp8r65dK6ttZxMZoytZT30hOiZb3oQZUyiyOQUiVlwe9QScuLAGGam8I3nLnDp4hUUbBkiSoIVmUZrliGxcI5TKzgw+qqOzhV4kXPmtG14XMc3RcypSIYIoFGCsyoTp3PkthS0SbCU8M2c+UUXuZ3AV1DrXsbbNb+e1x3wk/o439kFu2epZ32ofsG/2xi+qhXflCVgfEoF1h6LYtPKR9Yh8ngz8OJkRA6RIcYribTB+6qrAkaXZX2nJOfBo6XC1LUd9UKKWiceaM1zneFOa3mua7lwhYgz0oLzIXPuHJ3M3G0tjSxKVZ3WHFX11JExzIzhpHGknNCqiAxNjGbhPKICQ5VUPHUFjT1SEqck81QG4q0qClzkhJUCowyGjCSTcuTuwSHWaM6Xc4ZYSE5WSca6KGK9vtoU7F+ITKq6g+kErS5lwyoEDqwh5LqdCInnO4OPgQOjCiZSSqwsbktnLrD2JTO8OGp4a71hE1LRp5YKI8BIhZcSIwSfzZKfWDt+SysOleZ/su55KWYGIQiCqywovjUAhx3x8s0eFyR+2NIcz3z72d5xW0n+6azlfHBMmqbYJhjD081wld1CzryxXHPSWsa66N2tQtFjUaJckD5EPnk45a3lCiUkoTYNE2MIqQSAEXUIK0HJQm1MGQ6MpBOWlOEjbZmdP+43ZY5WYf5aKHTVWlESGiGxQTCEIu6IKKOKRknujVuUlGxC5NAolJRopThpLAdNoXUaVXjNUkBrSseshCYER4wBbUpwnk5nxJwI3rMcelLWHAuYNg2vL1f41COkIsXERfC0SSFlwRS6FFmFMg5qJcQUsLLUy1OjMTKzAibacOFXuJR4uN7w3KjhE7MpF95z3ve4GMhSoWOglaUZuZcSZ0Lw0ZT5w85xNxfr214IjooJT74m+DY7ouWLCkrd7HBB3vMo1h92Sz3LmVHKNLoQvRchImoHZStX96ixBTy5GRgbjQoJH4s+ch8i0mimtqzUQv3emKkSG6XoFkKgVVlPuZiLOr0oWTOnEjymDqlzKi9SIzM6ZzpTOMVTWxDYrSpzwlmT8TrXLUBgbMrPD/V3Tky5XGNraJXGFhkzWlU7/dqux1Qk41qjCDEicyYFjzEWqRQ5wqjtEHXm17ueI20wUnCmFReDYxMKKvnpMBBSZqoEx5Mxj4ZiovNwtSKTuNvZsjIsOFPGWiBlsZMo10Dw5qpn6SN3Rh3deISrKrCH1rB2Dh8C/7JrCFbyU5vAWzLxu1pxkjIfiXHXDnYXBb3LA9nC8Oc7Qfi+tKPfbwC+vxY7F4HscYxILRgpjauEo1gL800173tpOua8H0AUuLuQBbplVIGWd7ZIlmkhSSKRpWA1RJSSxRckF/K4qoW0DxGMvqLhS1mQLCJnjJK0UtHXrzdS0WpJK0XVCiyMuKKWX+rSSS6kd58TCgOiKKymnAqwMyWsNYwaXdwxd3QHdb0dY0r4EDiaHFTjQ8Fqs+ZwPCXEgFEahMAqU6weVCE7tRIuBohJXg2ibzUt47bh7fWah6sNh1oyH3qGLHCoAsmS0IoytNckXChNh1ZlbnrZb0qmrsli4TyNkDQKunXP3QSvhMRHQ+YzITJJ+boY2GXBLfdwgJd7ARi+0wyY91rq6/7/6m0pBH9XCx5XrmpWGRfKMTGgeLTuOe0smcz95bqQg3Lh455XjoOr0/chCs4Hj9WaBsH9lS8bgBSL1kq14LICWqnQImMFiKoMP2kactWIFnXWV7Yrqi7kYYiBSdZoRBUxL3Vma+2V7/0QAjmDVpJNFa9sdUtTUdTUdaG1DZ01SCXIKbN2BY0SKk9DScmkbZmORiWQU2TUlCwYtQch8JV33GhNs16x6HsOrWTWWO4dH+NzmXf6kNhU+NjdtuPXn8zx0fHiuCVJiRXl2oxV2SjF+hylKro6IZeBfhKSRktyFvzcxvNHXcRkOMj5puB7Pyjo5Xu4rr/vAHzWnCddlw018Od84lJFfhOJykXjeRkiZ0O4IlQ3SnHpfNF9FqIIL1ZkSoiJqS1ikQsXOKiD5C0Zy0qBQnHUlDWcVqBEOQZHtQvslKVV8mqVVCQ1it6flqIEWnW7bFUp3KWAph6xRimUUAghsToipWTjBlpj0Ko0MbL6gyil0drQGINSpXnIZGadxWiNUBql3lG2EKL4BnfduN4gGW1bNv2axjblhrMdjW5o9AJJZmQNQioaMtPWcnvUMncDrm2ZtZafOZ7x64+e8OpyU4QwRfFDSUKQsuDASC6dZx0yY9MyCZGXhSRXMjxK8qpWaASf84mPVc3Fa+Z+8RrfkF0i0nxPEeE9bbz0M4KPa4IvPisIx/WIe6naQq1DQdqGnJmaLXmmzPTGpqCRG6MxoqiRLivnIOZEioUaOaRcpTlKbTbWpmqiOKwEKzTkzKE1TLVmVudyY60YZLrSkrZSgs5X0mYjU3awuQ63x9bQmtK3CqmICTpjORgZpFSshg0ulBuq0QolBd6Hq8CVStbRBxhTAkZJhVQKZBEbQipyqpctUZW7FFJrRrQMg8MYg1SQYuBEjkkpX4lTxpwYNyNOxomNL7zolOFzp8dYBW+tBx73A7faFiky/+zREw6tRklQsmUTA2+t1nzENvzCEDiOiRcQfDokegEqZ45Tvikerqv/ljvi5fu60e9LOfX9ZMC4o3a0+/7aAvOpgJ/1if+SUfytnK4U4a0sR9MyRLIQjFQxE7z0gU7JIvy9JRXFSEhlX/l0KGoARpbuuY/hCso0koVMY6RgrEs3O9KqcEHkVuyzvIBCK0wWVwPiThULL1E3BJXnjTWarh2REXS2K9IXIdA1I6DH6KJ6mmIEUxS0slBkJC54pFBorcusrWkJmzWmNQgpQRuIRfgyS0FOZcZJykjb0ilDCp4YPTkVIXKlFSmXLJwTxBzLz1IaoYrKvtWGw27CpOn4aS040JLfOV8QcqZVhcSupWAkDJ0ybHJikII/NSRmNeCm73ZP2k9E+8G32QvA5V7w+fdrXCOfEXi7WW8beG7HqnO/xc65RvRaCl5JiVtKMdJl8n5gmxLxVQU01k1HSJlNKCBMKyGkVBWiYBPildFfn0r2clVJIVZgaRm7lOFyztAqVRhlFXZvqxSaVbK4U0pxpZqvZLFWkJTM5SupXQpFa1pCypyve5aDo49gbHcVrL5aOwipSEiE0Chl0abYcqWc6ReXRYtv6EnekTdLCI4cQw28BCmRXX+1AojR41wBxG6Pbmua+jth6Yun3UWIGGPJQvHl+ZJzn7i/KSKefU2wU6PKzUIRsQw5c+nK4PmnfQm+IN59jIlvdUTfff2HPRGi/eB73+OX95sB94NveEYQIoDbCW6lxG9riVASkzJWFXX4SOGjHtQLs/AFRj/Spuo4J570ngTcG9n6ImfGRpARV4w0KJ1vYXXBYaMROTE2lrYSuKUEKyRK1q2DLKpRClE9hOXVnW51kfqddWOGCIvFiix6YhYsXRmDaKXKLDIWWujE2mIHZjOtBm1KHYgoHsEuFAJTzD2NscSQ8N7TWFOQNFIhlMYNG0LwqFgEg3JKxBzp2rYQoFAYY3l7MefhYs2j9Yavzpe8ud4gyVVXWtBVzOI3FiteX8JtW67xPCTujEaEytDT1jBOkVHORAE6P3PasW/VcN2xu9wRI/rAouX6fTQfuz6xu16xfm/anXdV7/+Ui3wyJP5KI3mtCgD5VNAgE6OKr4coSvgARiQWPnO7s5x0DY83A5tYtE903XwsfaxA1aL83lVUshKy2iiUwPLVbjXkEnBBCHwIjI2+kjTT1THTSIXRhuUQebA852zwBZUMjIzhdDS6ErR0MbIYelKCsdUV3Z2xqvjHvTAd161IkRNp6hHfV4i/FDC4REyZnBNG1fGOlKQYyRVFDeC8L9D8LNj0C77w8IwvPLng9dWaJxUj2Ved7LtdQ8qZeUiFbmA0Z85z7iJTK4uUcbWRnViN84GvGsmP+bgryfask28bfJe14326M3ZZ7DUe6cNAw+S9J+H2xAeHvXXLVRbcErDvpsyIUp+sQmSoGaGoixSIVbfNREIy1gUlk6rCqJaSaRmT4WJiiKEy0grds6kNhFEFCGCVrrtjhVSFW6tyMf1TdZ9sZBGP3P6nhKRtOi5c5O3Vppgd+sClD7gYeWu94f56g62EHR/LUF1Jwfn5gK58lpQzrZYcWcvtxnLaGF6aTpgZzZ3JuKi6VrhZyqnI7gbPZthAhq7tyAhyjrhQBJvO1j2Xg+fJ4HhtuebzZ+c87nsebQr3WFSHpVbAEC3HjaFRkpFSLL3jYshECqBXCMGLsynzvmfuAp/1iT/bh5vQLdcdubsjlyfAY+Bsb+c7vN/12/sNwLxn076/8xuumXbndzjBcC4FB0qicuSysrZaWcYlSx/YpMzTfuBWZwsQIMHjfrjCqzVasvBlBRczrEO8cjfqtCalyHxwxHrxhYSUioGLlmXkkX35c47aAiK1shzRSgqMNjxZD3zxfM4mlmF30aops7tWK86Hof5/YlVpjL33rENxYW9qH+FSqsqsitPGcqeuGT99MOMzRzMOu5ZZa5BkVJ1FZjJCCkIsm5MQI1nC5XrD26sNly7w9fmSL10s+Np8QUqRThak9Mxqbo9G3B2NsVozUorTUVt1ows2cmY0Zy5wf+3o4yVGSF4Sks8MnqbWf/UIzteMWXZrvflO9jsDHtUgfLoHOogfVga8Tn5hm/1uWjqnXUmOQQieaMkTrTivEmWxCkl2phx/62qr5VPGp1SRwKlYIVTXy1ZCjyCF0ozoWvcV5fi6BUmJuQvcHTVXPm5b/r7WqsprFASOlKBEGaMIIXmw2fCk72m1YjEk1jEy1pojq/EpMhWRVfJ0Ek7aApQQjayij0XBdB2Lns3jIeCCZ07ARc9zo443ViushJdToveao1FT1QV0PQlKIIZUjsN+CISUeNL3fOHsvCJ9Aj920HG7MdxuDYfWMm0apk1x4uyshdr4pJh5rrU811p+9a3HrIPnua6sHV1M3HUBJwX/sVX8CR8psOCrPe++N9w26M530C5PaxBuM+Bib/SSP+wMeF37vX6vLOiBbyjB41y63cNRcR0qjuRw1FqWPjDEgBKWW53lyWbAyGLPem/cMDWat9cleCemwLFcLhlky2tYBcHtTrKu8z5dj9mywy1WCjmXvXGqQuBKi3J0xiJP9umjgyoiVGrOpS9SIWNlidkSYiLnhBUCl0oWzilCdSGKuQzDNzEyZMGlC/SprOyguKU/0mvuqXGFkxUJNqsNMQVi9KSU6V3RuHm0WvFks6GRiVuN5mNCczk4+hB4tC4bkLEPjPpiStP2mnFTJH4bbUAUz7ujxvBw01f/kcBLKXMKrJTkPGWaGnw3bDnme8ft2U7td74TfMtr5Dfyh6GMcFMA7lq278597JYWkoARmVRHJZ1W5Co7McTI0sGRLVuFtS8E6aebDdPG8mgdGeuC1O1DJAtV5NaSp1WG86GCWUWR13jqPC9XI6yxLsNaS4Embfe8mUyIAVWNXKAYQS9c6TxP2pZNjByoUo6ftIUaOviBkIs7Z0qRTYi4BMvqQby6kkMrYx4rJCdac8toEgKXMzFHNtGzDIp1cGx6hWpzWd21hVTk/MBqvUFWg8ELN2AlHBrJVy7mvLEsCJlp03I0GvOoT1xeLNi4nkMt+Mi446XplJdmY2ZtRipTdWKK2mtMhQZxguCB89iU+DNrT5PfNffb1XpZ1ez3BHi7Ph7fsHLbvB8p3u80AMNeBlw9Y/YjAaEy/JhP9DXoziuA9Hbl1571Qx0Sw4XriTmzdKVTnlhTV3i+8HlFxhjDhY80lShUhIbKmq6PiakpdSCiAAa0VFihKEOKAhIQVbVmCJHWNkytoJGqyIEowcioOs3M9MHV7BQ57wfeXG94e+NYhWJ4fe6LEqtIseyjteTlScPtNjJSmok2TGQRAqeKAIUUiRSgate2ZeVnLOREbCKb4FgPjj5Evnm54CuXC6wy3JvNQGn6BG+sVsxdYOkjE6M42wQebi6IqdBSM5lpKzDaIiu/4+XJmBPbsiDQhsB/Z+G5HdP2xbpu4rE9gndrvkc7wbc/dP62/eLeDxgh7cwB+50jeN+07uoYruwN8dGUeD5EVkoxNSVwMluLgLIByYIiuxszpjqej7XiUR2FzGxBrcQMjcysy9gXlzNGag6NROV8NV6xVbtF1KfeKlNkNxBFcRVBrJanPhW1qKYsm0vGS5EhFKmPx5uBL18seDQ4llmyCgUpM6Ti2DSEyIFRLGIm+cSF2/DyxHNv1OCr+GMji26N0wIXS3PQNQ2TtkVogzANTYqEVGq/15drPv/kKY/7wPPTKVIonkb4xvmCr16s+GOvfJynywe4YcNINixjxmrDg03PycgzcYZWB1pjykoTUTRkhoG/dL7k511glNm3ZLiu3t/d8z6tjy3aZVd6d3c9+6Gy4q6rA/udY3h90/R7q+E6Spn/vgtMKLJoUOZat0ajOitrkFJx1nvWvpCwQy5jDVnlzPoQrzSiZ1Zz1FiULKu8mZHcHY847lpGRheoUWW6mYpsyTkWAEEV6hFCMG0bUoqUHUEiRM/GD8yHnsXQ87Tv+RePnvJLbz7ioQt4ZVnGTGMbFinzjUWPNh2fvPUcj/pY7bIKzOnVpee1Zc9b6zUPh55FKH9XjFUJQVY7MQG6aVDWItuW1ijONj1fvlgy1i0/dXxQuLnK8tP3nufuZISS8NpqA6J4f9xuGw5UAU888eWmQBab2C2FYGoNCxdYRM8f8olRLlEm3t9pt9rRfF7uDZ2vG8N96G6Z+wHods79/Sey2wFlUVmafyZk/gaC3yVjJdwdtcwHBzuay1qWOutiKPJjSkrmg7ti5w+xMOXG1nJ/s2RqinpVo1XRQa4mNgWjEitntBBx0hWOpuyEM4IQIkoJfEgMvtRzLhZb1PNh4PNnF1yGxMG449FQZn8/d+8e42bEL3/jG7QS5iEyC5FOl678tDEMvjQkj/uIi5k7uUDzR8bW5wdGacZNi5oeFeiWUCjTkJVi5SOfPj1lvl7yzfmKlw+O+OjRCbZt+LzRvDDWXFy+zS0jsaOGw3bE4ByRyAvTCbdGDadtwSiOjCHl0nw0jeYgZYr73buckK4bPvudme8+1P66BQTfTuB9EEDqfnreH0q7m6A3AnhTSj6bMv8yRsbWkmtneOn8FdNSC8EmZVYxY0IoWSmXlV0jMyKnKymKrTJCKzVWFZFLXWudRDEszGRiAqvLALjkesHgIzHHq9u1SATLOrwslldfvlxhtGEqM1+drzntRvzMc8/xyeNjopD89qjhQA488pGL5Tl3GoHWBh/h4Tpy0ioOG8UQq+51giQkWmlapVA1Q0vbQY4QXLlBqin2rJ3wZZ84HhWeSmc107blU6e3WfRLPk1ikRLTdsYv3L3Ll63h1eWCY6242xoaWeekRnLcWDYuFEWxwTN6R2j8Wa/v/sZr2Hndw3fqD/ztAlLTDU9yuCYA3/XEbM78xT7wK53mYSz1laiyGxvnOTSSE6NYxAJvjxTEzFQXpElMFGiTEIQKAJCiOKS7OgAeV6yfqzZeoua8mHIlE5UZZFtXgEKWmdm6msY0WrPuB+YuMtKGuQ9skuCnjo+5Nx5xu20RKXN3ZPmFFz/CP3ntK7yoI2TJOiQ+fnLCN84vEMDlEBkpySvTESPT0GrDQdtw2BTIPWTcMGDWS2SV482p1LUHjeFLZ+dYJbnbGdbecX5xSXKRnzg8ZKY+QV+dQ0+N5o35HKMFv/jyPTSJFBy5qmppKfnIZITWRTfn3+7jezWZu5lvfcPCIX5Q4vmHlQF3OaB+54647s5IlfdDBm6nzNeNYC0ghWKRMHcBLQWfmTS83DVF8bN3WLksiGghmPvijeFTsR8IOaOl4sKVa9AaVXbCMRPrOP/p4Dg0mql5x5xTXL0v4M+iq1d2xAaBUKqqIygmpqExHT89m+F8oDUtnjJTFCEyDJ5PT2fEux8hi+LJMbgBnSPHsnCSY0pImTlqmjIwtobbbcNRU7YgGfAhkIcelIEUICaUaZhYy/MHU0Is4uUpj8gZFBkVPK80Db5p2FiDi55bhyNmpsj93pu2xBjLtqQqJUxNUV29i+CVmN9Pfb874Vh9mM7oHxYn5Lrd8E174ZxAKOCbUnJsqqO5j2gJP3s45o+czggxMKRAo+DHD0Y87B0+F9YXoigYTI3C5czGZ04aW/nBglU1ZC7UjqKQcGiK5ssQfKm9ZMmkUgiEFNtQLKGZC7BhpCwHtkMZS6s11mh8TPQ+Yk1D7wMhRt5crlg6z2dm45JdlWI8G7MYej53fMAmBEIuaqtzFyAHbrWWY1s2Ebpaui77gVkorUD2kewdOSeeOzjk/vw+K5e4XA+EHGlUqY8L8sYy0xo7sjS6wyggRUQqwuRdWyBvIUVcSJxWVmIQ4AS0+UabhX4P4byLbt6dcnyowfdBM+B+M3ITOiZtsYESeCoF943iXx8C/6GR9D7RScWfuH1Ezo6vXF5yPngimVujjk5mxkJyt23JwKUvrpCHTcOQHOcu0pri1TsziofrHh8jn5yOOW40VpW1m5GCkCM2F2i9kmC0RGaumHbTrmXUNLS2Kb4isjizu+BJEjoBSM/tUcvGOY6bccEAComLkRAigoDR4HLkwFrWMeESHFrFTBtuNYaxKTIlPhTvuMEH+sExSYA0iDyQY8Rqy3Hb4JJjdHjAyjl67xiiJ+eEDwPLOKA9FeNYdspH4wmjpinYwlyg+FoIpqaAeF9A0r576HwdwWixM3a5+HYIRt/tDLiPjul3UnS/h4bYjmNELwT/Zh+YpsgvjwyPUuIP3z7msIF/fv8pKUrGSnDUdmhtuN0VqYiZNQQkhyHydHC4LHgqJZvgGMlCKnq4HnAhcngyo6t84ytqptyOXUArQWc1WqrSAdaBbaM0WimMzDSyYvmyIEbHot+wcY6YMudcIkWBXoVUtPt8yrgQUdIwbjpmti2CkjFx0DR0MjLWIHOGXPxPZBZ1tJJ5enlOO5piJofkYV1BrJGJ0RxaR2MNrmvIKdNUZS7nXdFFTLHQAshomRk3lpSK3VdjNIN3LN3AkTG8PG75k/NNVaYF9e7g26dXnu/N/BYfhGL53c6AeS8DXgdMuErVW2TtvZhEBp5IwedS5lUp+MS0Zb7pWQyeiW0Zy4a74wkno5Yn/cCTzZrpqMEqw0mjGUn46tLRyKIq/2BTdGZydZR0MbIKqdh91ZGLFAWKlTNXsrSFhK4wVbdZyvI+xYSSmRR9nbFpbh8cEXPm8fySx4tFYbmlOsCThtY0nE5aJl3HtBvhY7EJEyRGGjSRVBWqNs6Tc4GhaVEcPpeD58nZY+5MDxBNC86B68sNIQSNLC5LWrUFGS1Aj0aoqr6gpSCEQGM1ORcsYUoRREZWcta40ZxKyR8bwr6S1G7n2+/Ia+wz3LZ1oP+gMKvvdgYc9tAx/Q1w7Ku305T5r7vIf65FMe2bL2mU4qhtOelGfOJkipaakbG4mHn1csnLB2OUVJx2LWdD0Uh5IgqUytVVkk+Zr8/X3G5bXhrPsEqSU3kRQgQhMlZrdA1Cq9XVTC7lWEY3soJeVeFuTDtLiIW/3OljXjo+BorOTR+2gSZpbIOq2s1aa8gRLTKSxMXinE3whTUn1ZXnsaiEcS0l674nLBeY0QRiRJqGzjT4uEA7z2xkaFqNkKbMTa0tguekqsIgaLQhBIc0mt71OB+QMqNRjHXkj2nNvQqSk+/2+Nit/1Y7kKtnWW19XzLgdXeNvwGget045urG+4WYecVKjtqWp0tDpyyn3ZjTrhiyaN3QNWOMKF4bkSK0mHPkhVGDVoJvroYi3iMFK5/QV9YL0FYbBITAx1i2H9VjJALWKGR9Dbazv0ZrrDZopVGyIGaESFhtaIRENPV6C0mMESsjIYNUGq2KCQw5YYxGoAujbtiQq1GMqDKSQiqM0tXiCyRlNujXK8z4ACE1wiom3YhW6aK0TxEiMhqSKIDVwhuJdE0Rrc2x7LWhwPkFmVRJW61W/NmrodS19d91DLfFzsZjv7bn+5kBb2pE+hum5Gk7dBf1TJYZfoHiHBRby/GQOW6bou0iFJ2x2JwxBzOeO5zwT19/nZQKr7dTRRn+Xmf45mpgHQp/2AiqOUzhi+T8jkldypmcCjleVD6y1AIhi3KCFILGtoAoNZRWKK0RWpfRS6r1Ys4gJVpblE4I29QAlhCLw6aQGqEtOQZSWpVaVBamXMrlDtFKECtDTeRc0NFVIUtoCzmgmpamsazdQIiFhD9qu/JH1SbDpyL3gVLFjzRFhFI01Z1pPaxL90/RE3wfMLv+BpDJd635eD+74OverhtI3wTT32VWXd2BfzIkeu/pdLFVKMqmEqU0QmRiCvjk+J0H9/knbz7kSe9LBxw8t9qGz8zGHKgy7c/AcaO42xkOdWlCEttdcvnTYmWeiZyLhWtOJSOGgnRxrogHieqGK0Qp02WWSG2QlVguhUDZBt21yJxQKSJSROSEsi2ym5btRkpXdhQ+eFIuhKhyQxQLWSEKHGwr11H5oyAksh0xa9vSaedECMPVtkQai1RlTCSVQqQi2SuVqFSBwgYUlA2Q1ZrVdHSdkuizTrNrpxrfjeD7oAF43UB6uKYbdteQlerRB5/0CTPfMGtbbjWWg2ZUNFyEZPCRy77nG2eP+cLDM1wWPFguIaXqBK75+GzMJ2djJlqgc6KPidOu5faoQ4sScCGXR6zZ06fMECKbYaB3BfwZYiKEkjGUEBilEXkHGSdEBQ0IhFDF/DgliAkRI8SErMckvof1Jdn3xdsj+qtjWilVVoMxMnhfj8ci9VGVPcjVJIcUQVuOJjM6a/Gp6Iq4YQVVIkQIgTAt0jSoK4EjjZRl6Fz0GFXxTM4ZN+nei3Lr91as/nsVfN9OBty/c/o9jOA+VP9df0AWgmmGjz++YNqOOGwtWmmMVOWEoaCYU5a0WjNVkqkyPNo4JtZw1HWcdg0vT0bFmLBVnFrFkTEcN5ZWywpxL8dvrLTFWLOQEKVzDBWdkmKxVSVnYghsNitQqmxHtEXokp1RCmGbcszW/6RWhSCeU8mEQBrWJD+U470CLAqausZ1KgY0CWiMZDqe0M6OEE3JeEgNpkG1Iw67EUKosr8OCd8vEH4oN4OoiJqUkEq/8zKmAr0o6gpFzltMRqQqM/weazj/LM73D0IA3sQVXe1AdfY5ou/mDdeL8PLbT1ktew7HI8gBrcwV6jjERKYMk2dacWs8row3w/PTKbOm4aXpiIOqZvXCuCvkdwG9rySlyvYXVU+67IljJbKnqwYkUWDwg/dIpelGM0QWJROKoj6AbUtNuAVYKA3GFnLJjklA7Bfgh1LPCYFWdd88ONYu0PtY54YluYbKVRZqpwxPCaE0YnbC4WTKyBoWgycQEVKV3VIMICViG2BKI2ShdkptMLWpklUlKzWWYOvvKMXxtyW78oOSAbkGuLi6hqi8uZEnIARNTLz09ftYayuQVF4pSa0Gx7wf0EJyezLjlaND7o1HPD+ZcjTq6HQx9fvc4ZSJURy3DUaVzQRbt6AQCg00p6uMFSsIL+RUIEyp+MBlcslMMRKDJwdPDqFouMRSP5JzecFzIsdYArOa5bBtIpQCIjE6VsOSy9Wa+dohhaYzDa0xV7UgULpurUr8Rl/5IwliLDviKruBkKwHjwseVzPslapCpZvmWPbcBV2UkapkSSUEUmuiVt+x8NR3601/BxnQ74AW5zv7w8Welat+FwQtZ7IQvPzoggf3H3HwkReYX84R0qJkJETIWTLWLSfjCc9NxvTDgKm1TWs0h7bhM4cTfE6cNMUyIaVERGCqSGSmGLsELdFV9yWnUvRHkfEhFLlaXbrEGCM5VcKT1e9sszNFsIh6lOZUAAQpQork4PBuwAWHVIa12zA4z8pHrDFMm4ZR05LJrPuCuJZQ99JVWyZEktugjCX3K2hGCF187xqt2YSA2KwYNyNyElghkKZB5JpOBeVmqZkw54ipYkZET5byO5be+0EIwOt2iLsZ8KI6qs+riPnWUdPucEWuGjIBfPxrb/K1524zbVpiyszaEVO7JglNY2Lh0toWWd19UsxMm4aNC3RO8VzX0NZuMuWMrqT3mIs2c84UPxABIQqSkAhdakEXI8IHUsoYXTpdZXSVx4gIu+WMZUieXEjH5Bgr8TmCL93parPg7OKck6NTVs5xufGEkDhoLbbWpdTGI6RISBEfPYMfyOdPaJREqWKwI0xT+MzB1a1HgZAWZa410ZROvxWlycmI0hxVcfQCQyulhsgFH+mr7Fy+3lfj2/L3+EEIwLC3R9zNgttacLSnpK+2tWAWgtsbx5tvPmD66U/x6pPHvHh0wul6gx48B53EKs3dozs8CA/o46asmXLZhJy2LQvvWfhyRBoly6S0wvn7rdMjqjqvSzrDlcdcaXiqagIlswkyiHqcBU/edsIpVE8BhRCZ7IZSA+aEcwPWdhwdSy43G+b9wMU6oCiI6yAjViekqEGQEllIvI+sh01R1FcFRKGkxChLHtaEflO0i4CYC4XU+Z6UEj46XHDMJtNyWaUuJUOKeO/reKc0WjdYufzAvF1n0/BB3nYNDe2OrevWUXPXTV29KwuKMqFXm4EH924Xx3QlOJ1M6N1QCnmhOBhPiiXBZoNLA7PRmKHCnlxM+IpsaaW4yoRXnu2iqGhZVeuh6oMhK11za3eSEUgpkEIWTWfKsDqnRPauHpeZ7Dw5JYb1khxjkddwPYvNmqerBYthYONh5YoksRHForYosGX6UBT2Nz4Uxa3gSLFkQy1F0YbxA8NmTYiB1TBw0W/onSsNWgqsXQ8V+R3ryZBjLJJuOVevu3Jz+RTZ+MjR197EFomOvEe/XN+wA15fU8P/QAXgrlHNvq/wTbaumnc8SEo/JgStC3x90nLnzh2++vAtnjs65N7JCUqUi9kPa5SCOyd3WQ+e1pamZd4PpRCNBa4lEfXIooogCYxUXA4OW/1GtFTkXGeSFSUdcyqD4coXSSlerbL80EMqAZljhAwxuNIYbNYsN2v6GLhcL7nYbOhDGbNkBN+8WGJFOSz6MLB2Gy5dz8P1hrkbWPmBx+sNZ+tVaYpyYQz2g2fjHYjEg8WCLz46I8bAYWcRApaDw0WPUupKHCnEUG7KGOrxm/Eh4lNi6B23vn4fXXQZs/gBC8BvVyX/Jumu3W54q5o03nFW37V2FVuCzAuvvsXmxeeZjqb8s69/jU/fuc24sVgjuD2b4Yae195+gyAa/HzFc4fjks0EmMoHiTmjKKJHlrITzmQO2+adjCcoANYk0KIo8Deq1Fc5ZaJJdNYSZWK+nGO0orMtPni89whZdJxdGAqoIEfmmzUrN1wdnyEJbILnZod89fIpIxFpjeTtzcA3Lxe8uXbkLApRvGu41bU83jhemy95aTZibJrSeJP48vklpMSd4ymt1iQy1kbmfU9czLk1E/gUUULSNR0hJ3LKRcu6OiMNmx7pwxUq/EfpCN43M1R7WbC9xln92iw46x2/3yo+87GPcbHu+fLDB5ytVkQkLxwdcXp0jMyBx4sLnmwGprYgmVfe4+NWrqMcszlBp3Vl3BUer9UKLQtAQUtZXigpyamgUmRVwI8pVAL7OwvlFCMxZ4bgcN5dASR6H1i6gXk/FPWGZkRrDI02tLbl+cMjGmX5/z58my+fz3niPBlRRCOrXcVyCFwMA0OKpCx40vc8Wq952vd88WLBSdvxJz/2kSpklIprlBCcbwZWPpSLXvUIM8WqYhg8/eBIKeOih8WaF994vM0a+xlw1+Xo6Y7cxg/8EXyTr/CzakGz04y8kwWrDZSaL/ndWcPPvPQRpm1X4FZCMLaKFB2jtuOl0xMmVvDw8gIhFWvviRV9EEraqCrzspaABQOYKEhkHxMja9n44rxEJcXnVI7hXCfXW4No5wOJjAuurNEo2cWHwNL1PFmtyEJwMJrS2QYlNKOmxSjDxntmozHaFIzjhXOFSiAkUmumbcPEaoxWTHRxOpr7iEeRpKVtOj59fFzopKqQ27VSNKYgdy77vuhH1zVm2u6664C7d650y5crbj94Wm0m3iU0MFyj+beLA3Q/DAH4rCzY7NWBzY7f8LuyYBaCQx+5v1wxn414/uiEF05P2FTTwqPRmPPLC3o3sBw2vHZ+WTznZBEUKo1IKcxlPZa3BapR1UEp5Yqfk3VUUxqULUMk5UiMtYhP9cWMEec9ffAl4/Y9Q3BsguO8Hxhy5mgy42g8wRpLY1qkKKLkaEOUktl4zLjpEFKD0kQhi/AkmVgaa/qUixO8bbh7cMjpqOPF6bQ4wedy8wgkXWOxuiCwUxbMhw0iS4TIhBjpvSsgh1jkUFCK6VtPOX66IL8TgLt7/OU1opO7SvfxhyUDspPZzE4WbG9oRuT+XBAh+Oh64NfdBjNrGduGKCUpOsbWYLSld4618xitSzGeCih1i/dSsnh9aFHEgmL1F841EHVFUW81qFPtoAtYIF3ZRQhZaquNG9iEbYEfkVqRBZytNwwJnpsdcTiaoJTCmhYhi4a1R+AyFaxaSFNKKo67hrZiAkMqguvkjBCSW13HJ4+OuTce01Qh9JyLuY+SxbxHa11oqsDIWnwo60Wry1YmVJBuHwNDSCiluPvGI8bLzTYDpp0MuCu/8XQvANffrtza96oJuQ6i5Xfqil2Cy+HOYHpbD6p3zQWv4EiCX3zzCX9XK8KnBUJpcor0Q8+4HXNycMR0PCXlwOPFgm+en5cGIlNdKnNZ4dY9rJJFe1BSRcmrFmEmcTlEDpqinyK3ZQDFEHoTAiEkfCrmiZOuozUGJDy4mNNHeOHomEnbEBGQFaGKLw0xIqRBK4WLHu8dMgVOW0O2komEkRJc9or5IJkaw73JlImWNLKYU7fWMoSAEcVHWVZbsnkfaI1CpjIU72zHwl0wQdMawwZ/pQeTRMZlGK2H6+D4+2CE+GHIbHw/AjBfsx/e7NH7LmoATvcG02r3KN5aKrTAn3z1EX/VO372Ux/nTtuSha7ql0WPOWXJvaMT+hD45sXl1epta5UaU7F1yLmIVUop8SkVllS1BLt/uWB0ekhbxcdDLt5yMce6l04oJehUWYdJCY+XK54Ono8c3yIkwcKVY282KrtdH0LtxotNZacEnSp2scthYAgBjKQbW2IrUWLK8WiC0aYY7GjN2BrIgVzrw5RSCUatmfeOxeCuSFVWFhvpmDKN0bhYRkiQMUahB0+76t/ZgV4ffLvWG+F7iYT5MM0Kb8qCF8DBNQFodgLwyn19qy14DPxb9y/4P+tv8ouf/gSDc2QyrTYV6QtJwOFoRLdasfC+6CbXrUHMxa9NKUmOqcpziFonlDrx5eMpVpUGpYhZZlwKNFqVWgqBRNNZS2stPniebhz3Do5RSrF0Hk2pPxebvsDAculUBZIcIk3TYZXGkTloLCGWv8N7jwBm3ZhJNy7BW2V6rbEM/YreD8QYCTKhK/h20mgWQ652ZZGcJSNjaa2+QuAUAEaBs5nzBSrEffWW9AwoVvhO1a6+HwH4XlnwvAbfLkDB7hpd79aDEogCPpPhz7/xhH/QtfypF+8yiQ3BxivBobXb8Ob8/Mr23sUESqBqRtBGVgRyrluOsgmJ9XONUvQ+0GlJZxQrDzGWeZlPxey60ZrGaoyWPFkONMbSWcsQAyEWGJfVikTEiMLRbVTRpDFK02pZxjJKFxS2LCu/hERVO7DoPLrRNLplsVzw6PFZAS3UTOxjef7WKoxVNEbih0Cu5CxkYfEpueU/K0jFK0+v6viluHrelAFvCsAfqgx4Uxbczpgm7xGAYrchUbkE4c8nePz1t/jbfuAP3z7lVtcCiZUPPFqv+PW3H+OE5g/fe46YISSu0DClFqKShurqdssv2o5tRLnatn69MZpWay6HASFLx5wqD0MIwa3JlBAcj1cLQsrMmrZSfgRSFnk4ISQpJjZ+4NH5vHTUVQ54exDmgs/Hh1gZc4nONmRBqWmlIPGOZnZKqfCYrcIaySa6Ilk3nZBD1ZYRW1c8cdVkTS+W74fh6J9xBP9QZMDrsuCwkwUvauCNa0fc7Aymd49htQvY2Abhv+EzD956wl+/mDPRTaFd5kgrIhfOI2Rg7jxjU6iPLidGUuGqHp/VhSXhqiSbkbIayJQmJeSyEdFbUIIQGKXQShZ3ohhprSlu6AT64Pj6+SVCCCZmRUiKsSnWrr0vEP3eFTxiymBlmdMZVXShc61lG6UQlHlliAnBEiXLMboMnnUIZFHEz3MSbFLRMpRaYpTgY7OWO9O2uISa4keSMqSUsMpwuel5sQaguD749mvA62D4+YclAG/SG1nuDaW7nZmg2emGr82EMpda79/dZJwI/Aci8OVVopXwx0+LsyQZLvqBsZ0U6bWU8SJWs0BxlQGVLMCAPgVktQiLKSFFUeqStbAPqSz4dS3wodA6R41luek536zJCN5arHl74whZMoSISImDVqMyjLVi1hSTwM2mSA5PW8WyD4QEd2ctvh6Vj5cbTkYNJ9MxQkgeXV7wwq1T3povePlwysNNz//mN7+K95GY4aMTy3/7cy8zsYoYAtOuY9q1rPq+yIbUJY5abhjXBiSXwXq+wX5jP/v9UGbA64zthh3NkWYPHXPdTFDs14NbAHkC/ofrxCc6xf9irPj9IbIMmdOmmNtMjMHH/K5bXFYkik+VH1zDuqCv3xnVmJr5tJAMMSAlNFpfvXCJzOADJ5MpEhhi4seNhaz4f776GpcZbhk4NoqfO2wJSTC1gk8cj0EqHlzOuTW2nExmzDcblBB87qUXySkzaqd87c1X+eid57h75wWykLxx/zVefPHjrObntEryYLGEf/kqs6y4O2750y/d5mOHM0ieRhfjxZgiLhXtaisKKGP0dFmom9XV/X1wQb7nx+93IwOyR3rud7YjduexG4Bq7yjW+0G4JVb/6U3k40rw7xqJJzNSkoPGctAYVrHUanYLq8q57AbVOwKUBVVd1PG37pu1HKsIrroXEeVzUoqrVlBLyawbFazgesPP3b3F/3J0wH/y2gO+cHbGkBKbIFFK0DYdLxzextiWO5NjtFKcHp0gU0YSuPfcSwgpEdpyOp0VYrq2AHz8kz8GuiuzydAzXC75idmYn5sd8NLhhM8+f8zar4ixzAxySuQscbFMALKQuJh57my+C0J9VvPhniG3m3/Q8YDvNyvu743lTvDtBqG66TgW9WqdZviJnPnVVnLYNDw3mnBv3LHwniGmakhdLrmuR6uqzktKbKXO5BWIVVTd6JiLyvwWzuVSmcsJUZWodFnv9a6Ip0+M5jO3b/FffvklPjc94Eg1WKl5tOmZh8yf+exnuHV0wj9+9S1+7PkX+fhLH2HSjZk2Dd3JLUzbYdoG07RIZZDGopuGN197g9T3vPb2QxSJB48vmK4dHzuccTrpuH08QVBAFI0us8KQ4Gy9RgoBUuI3no9/5Q1UTFck/fpa7NswbE1nnuxsQbZiROmHsQbcTfPbuBn2wApmJyPqvVpwe7nsHmlKUL8wCvjJCH/UwxNTfNlGWtEoySIE+ljcMLUqmUCS0bLM/2LtfFPtBmLKVaelDJyhjmxyJueqG12JSa1WdMYgq93rtBthlaAPPT//0l1+/sWP8NaTpzxcrnjiHQ/fesJvnX2F/+gr3+D3H53xwhf/gH4IvHI45c//bDEM1Mby5ftv8fHbJ6WDVpp/8Hu/x8PlileXK358MuGPHN/mI7MpUikmnaUIx5YmRqlSUiw3BZigZZEdVk/PsS5UbnPmGeOXXZFR/91SQf1eB+B1R7Gsd53aASSYnfdyLwBvDMLtcfwXhsxfV7Iwy8iMteStdXFmDynjRaqi5OXrfc6VH0cNtC3EqazopHznsLJS4WVm5T1jY+h9YL5eY6YFdLAlEyklaKVm49a40HPr+JB7J6ccjkacXVxwZ3TIn/vYJ/jSgwd84e23WYWB3+vnfP4/foNx0yBEMaO+OxlzMuq4c3jMv/bRl/nim/f5lG64oxtijBzPJqy9w9riO3I4GTF4VwhNlNWhrg2XAO48vriOA3KdHO++zPJ3TYToex2A+2OZ3QZD7z2u64S/5Qi+qglrvfaSjxynyoLLZXCsxVYnuiz8Y4Xo+7oNEJQGI1EITEKUoXUk4yP16C5gBAEMlVfSVPRMQaWUvezgitL/qGnrzwz07pKkRzxaBMbjMVMhGY9GvHz7Ln/ycs7bF095uF5w3q+YjEcsg2NkDUrUoz6Bf/sJn0qabnqEbRsCmfmwQRtB16idjRoFdhUCLuUKL5MsVj2fO7vYBaDu0y/fS9fnh74JeVYQyj0gwrPGMGKPd/JOBhSCJmde9BGly8LeCEFbXTi1FMysRkGFaxWHJSkEQwzFOCZGZPUuiTGhqqkhVUfQqEhG4WMRLepDkextjSkrspRIfV+l2UzNtp6nqyfEINALS/QgYubOwYyjwwNeev4FPhoDq9WGJGBTv98aSyIzn89RjWV254CQE2cX5yz7nt55jsZNYb3l0niQy/B84zxZlC5eSMHs4TntELbbj+s0fa7TgnEf1On8hyEAbxpQi71mRO6t5MQ12ZCd41hsj5ZPbjyvVYK4EoJWCi5yqioIRZptiPFqNtaad0ymi6paFakUgk3Nko0qRn9QJHBjVVLoY6haMwXWH8ioDK5+XmqDMQaTMj4OLIcB5xIT0/Lw4oyHT59w2LbFWnU8YToeczSZkGJEWwNScXjnDpAZlisunjxhvtkwBMdopBh3tkjWpTJE36o+DKF4K2cBqyHwyv3HH0Tfe/OjnAGvuwDXgViv+//97Lh9ZK4sCOFTFyu+Mjh022AkjLUm9wPr4BkZjYslM1olC3klxjITqluJmCKG0hnnnIhZXun3NUoXZEwAqSQxlWAbUUQpB+/IQhahIgUyl1ljpyXJmqLTbCClgJaK0DuerAcECrta0hnLaNQxajvSskCuurZhcI6zp0+57Ne47GjHinbcIGWhqVL1/6jyHqGesgnonl5ydLnezX7Xyansu57eJC6af1QCcDcTbpuS647Z3WPZ7DUru11yFrnQOqcucOfpks3zlixgZCQzo3nSO4z0RTewdrUiJ1QuUhy5zgxTylhdKJmi4gVDZcGFGAsiWZavE4CrpHKRwWiNj5FN8DSVDG6NxajSkSMtOVVNmpzIjaQfBpb9CuEEndO0vUFJjVWqUAdSJOSITxGhoJ1YmrZBCTCyQMuEBJlK9nMhXu23NznxqdceXzVp7+H7vL7GC+S7JsP7gxSAPCMTXgfpb67ZmojdY/jHH57zj+8e0ojCm5hoxROK61GZA0KKhYIp6ghGbWumuodVUtQUXeQ3tFblBa5NiJLF7JpEsfkShaa5DWafA65mJmsaFGWG2IdErCu0LCSyaZBknq43PPED0sOBbZhKQ/CZVe1mx41l1FZRpFzoAqqisbdghsZonq43paNXCv32nLtn8/3a71mez6sdGwb3/eiAvxeD6Pcrfr5b46k9WL/dQVGrHS6JQAjGQ+B81CKOJuSKV+9jZOFjdct5p14K1U+DSl5PqYBVt1uQLTpaUDJirLB9cYUlLNTPtvrZhVSylVEaSWkKRBWi3Lq050oWcjGyDh6EKrJvSvP24Hk4OBYxcB4S51X4qDW2CK2TaRTFu0QKdB05bV3Wz1drfAKf4JNfep3ZZthC72+yYtgOnx9T7Fcf1/+ff7fFyL/fGfC6poR6YXaP3y1wYbyDIdwFsr7r7qwFIT/19Yf86vEU1WiaGDltGxYh0lcIVASsqrvdmDFS0FYEtc8FcdKiStOREoiMTlzxRzY+0BkFUpXfKSVN/VpZZT6KFWwii4wUqqiuSkVnqmOnKLYKy6rcFXKm0RolJT5lxkZxZDRKgMyRsTLMGo1RxeNEq+L+6WMhUm18wMeC4gkPL7j75FuyHzcIy693JPU230s11B+EALwpCLfzwaYG25SCpN4+doWO3smCVWNm5AI/+ftv8i9//GWMVHQqMzOas81AqFuD0lwIjKx7XlTlW0C7RRKnQuUcfEBbW7m2BWfnY2aki3qC80VOrbUGrSWD84SYMLZYyYZQsqKLRQzTikKUGxlD52BmyljnTmNptSHkcik6o7ASjICxNbRWXZltS0nVNizYxBBL4+F85A998+F+7ZefIR6wDb7Vs7Qcf5QD8DrkjL9GXeE6oaMtv/hKgV9UZ6B7Txesf/91fv9zLzEmMwuai8ExxFD2yClhpWSsFSZLcgpXSvI+ZYIo7LSJUfgIvXO01hBSpjUaLSQ+ZxSZpsrvGm1QOTJqO0IK5FiCA1OGyyYUd05RgwYkB12HEBIfMxsX2Pz/2ju33jiOIwqfvszshRRJy44T34AgkC3biWE7CRDkPUAe86fzkABBgMAODASxdY1FSaS83NvMdFd356F6lq1W71JKaHEp0cCClEUIoni2errq1HeIcG00ZJND8Bhqbq6HSF2tYv9SROoqkWUuDHEOcvXwCd6eLNZVP5/F7C4ykGiaev7SxXeRAtxk5U+Bl6XIgDrfJ5GxEt54dIIg7uEfN9/FwaDG3FgcLj2WZE9bGBSwozV83B+eW4KOQlTCY2Ysm16jH5AhWBLQbOOiACwMtzMHe0NoaDhvoVUFCB9T2ytY56GVWn2LlVJAENFjKAGhsD+W6IjXTJlVyHQH7wneE1rTQkg2yHL4DLtynAtonMPCEn793cNNHEcqZMHNEmxKW0hBCq+LALEmCjbF/qa5FXuxCqbH8Grc2R/HHz6cQFrCX26+i+ujIRaWcGx44cj6eNv1HOtaSU5SpxCgvIB0QAeBJTmOkggBQ61xZzLD3rCOmXEWg9EYQVVYGIOdeshL5wig4LFbD/lhtq4Zj2GZklrrKppkNS+vKw2hGLHrDWfB8QgwIHgFZwX0iL1+EHzx6MFDxvKkY+/RCX4yW26qflTIAZkWUMp0URXwIm/B6xbb01vwaA1pS5WW2/sx3fXG4O2TJR7tjaCGFTpymFtaYTxc8OicR+d5tktxwZ1ivrAQ4ESluNo56rfOpAQEN7GrSkMICSkVRvUAWkm0lqMfBlWFQT1AFY/pQT2A1vXp0pDkNCfoiiNF4zRGRpCkSGLERIyb6HuV87aF9cDxssGnX93GKLpe1oTQtMl24hGAh8nt94ckC86+zgLMRZjatoaZmzo3ssqSb9ALgWudxS+O55iNBzB7Y+aykIcNbsURdHGs1psSKPSxDXJFGW2cQ630inJa6Sru4jpoXUWMh8O4HoKx0gG1rlBpDj+UUkJUNRCh4aKuAclZJEJXceGJb9ai7zQDMUqCGDWiKwgIWMfk1ZmxcHcf4ZN7R+yAKd9808Ww4yi8/nUUn7EXLwtCtO0CxBrGTN6UrtcIUJQqYe09Pnwyx9ADj/fG6BBgLDeQKXCP0Pi4+BMxHTbGKNRKoZKnYTecvK7gAze1tdIwRJCRluW8w6geoNKKM0HIQSsFVcUUTgg0bYuubVFpDVFXCOC4BakV4BwCEUSl4YlZhKpiJqDz/KaZNy3m1uK4afHR17ex29mzqt88Vrq++h0mvb+egnUhE5BtrYCiQNuqEuFVGwT4jAghmEf2zrzFh9MGi3GN6aCCRYBwIQbFcC+w89w37LyL0we2X8lIWmWsh48WLz62G/Kw0ZmiwXvIHoBSGl088iuhVtgQ39OrBOCMAVnDdCv0QPQA6gykUrzTTBYdERamQwgCTdfCCwnz/TE++e4w3/fIq19Pvuqr32FS/SbbUP22rQJijVNGvYCHEOuq4S45fD5p8J4LeDyu0WkJE2e8LnBFtKHPYuOjl0IMuvGRZCUkOs830ACgCx4UQxEDeKyHuNy0NAadc1CS57whcFqSgGAav+K/uoyTGWcsvOdsOL8icxmeTUuFxna8KuA83vnnLeyfAoeet/o9LEw+0hswXncBlgQkC2KUZ5hYRf5n9mGJAsDbHeG30w5KSNwfavi4sC6B1aWDfEAXHJbk0HnPldH5mMLpV8+NPbUgAFgS40EaG+Hmcfn9eL6AsRaqN78GjoiwRNBKRfqqQWvaSNLX6EwHKRWMI7S2Q6UUTpoGFgHTJ1N88s0dNlgAz1v9egEeRVH2LRhKZvO4qoAo5eoVK1xJbJt+b7WbE4RA5QM+Wlp8sbRwWuJwWEFInqlihfINUXweDTnYwFRUvsDwly3j7y1jYqYFhySS50BGBgt5WEdorYG1BiFCNA1ZZjqHgMZ0mLcN5k2DabMABY9l18I55iNSCKve496/7+OnRyfJd3Qu1S9cCbAsvrDh47rFGbHp81MhAtdcwOcLi88aQqskHtXMEJQxwFAy1QgUeB94bi0WZEEuYEEeDTEUPACYGUIAMI0pTDYe3eQ5MnbRdUxLQOBRngCnqEsB6wgCajWSI8+JUSaO+Ixj08NJ0+KXX99CzcDx0r7Hpap+21oBXzRWyhdSfs484vvZaRDAG+Txm4XFl41DqwQeDDSquBNcg32CIXJknPdYEGHpCC54PqbJofW9E5ttVdYHLJ3Dg+USDVlIybTThekgAtA6ZlxTfK4b6IqX6REwbRosDR/pxrPt3gP42Td38N7xSclweimr3zYLUBRElQfruQwl4Z9jnPTMsdw/H0IA+1GIXzQEKwSONCcrBQjUQUDGLxQCp7dm4ptz5whLZ2EcYWYIE2Mj8s1jSYSHiwYza9ESN47JcfunsWxYaIhgnMO8bTFtLZaO4D0wtYSJ7aDuHuL3tw5Xq5avQvW7DBUwrIHqlMielHxNyN7d4bmFCODABXy5tPjdgjAC8EMl0cS9C+oXmpViL17waD2hcYTWEibW8ufOonUE4ygyZwLmhjCzhLmxWDgChYCp6TA3Bi0RrPOYWUIXApZEeNA1eLCc4+d3H+OP9x6zIzrgPG++F57bIML2ii9vyVSJX3A3zobfAPMs3wLwZvx4Pf7/fZwi4VIqV2kb7ylRhp642tvdpcDfdyv8eVThX0NebDKRJx1CQBDcwHbeowmnGUxaCKhIxqqFQiUF6ngUawhcHwwx1hWvZMa9Fc4dZJfMG4sGfzha4Mulic+Mz5CuUvH1E48HAO4BuA3gLoD/RCFOMvp9uBLgi1H40xiIYWJa3U+E+GZ89SJM+dTjxFNYrUGBPCXG/hlRJv9I9wcKf92p8behxmHFZK3+pupiYLQPPNbjxHOenETkDCoIiAhEqpXkhKd4c94JHu954Ebn8Nmiw686TtYMzx67oTBym8Rj934U3p348TBWxH7uSxc5+cCWuWFe5Aheh5gwhV2HeWK6XGTVcJiF56yriJy9GU6FKALwfufwftfgT0Lg24HCV2ONb2uFB5XCNApKCsB4iS5mdqgEHcxh2gHXXcDHjcWNzuED8jjwwIH32M9awl6w3WyD3Son0k6S1yyZeFi8RPTuqyLA3DeY34ZdYrhsEz9hKsLe0nWQiHBcgGXqwiroU0JMj2cdAm62hJstY30nWuL7SuJ2rXBYKzyWAk80j+/qAEgf8BZ5fGA9PjYeNzqHkStrwXN6CkRYVd/SG9BmINA08+2HKMZ58txHF+X5u+wC3CREl4kwrYTz5AfTv/aTI3kncVkPs3nzWlJXvAQ8k4F6QB4H5PFpQ//39ymf3mrLW1Eusdkvk0iMJ/EZsBQ4s5XV77IJsHQk+8LWf5vtP6QW//3kOL6WCXGcrYFuek4UL/GNhkL7ySS33kkU3hFOUWuT5Jmv29bqdxkFmP+ARPLuzrFjbXY89Unu6SsVYnpRyb2HuoARwTkLsXTM+gLTObXYT2PFe5S1XE6Snp+9aMPBqybAs35grkAB6CvhbrbumQpxLxHiqJD0qQpCxDkIMRSs9KEAEs8vXH316/d8e7vVkyzz121r9bvsAiwRF8IaDl6bHcc7BTHuZ9VwJ4Oq1wU7mDhHAZ5FsM8fL2aJAI+jCHuv3zyrflvbbdv2PuB5pHfqpH9YJ5eOcRIfca1wJO8UjuS8dXMez4SlC0YuvC6pfPmbKb35ThKn84Xu+76uAtzkrs4d1ml8xDgR3W7hcvLcOynnUP3S49ZkJNNUgIvk+TZdtWwui/heVQFuEmJO4KqTI3aciHGc/Hq05ij+MQVo1wiwzVpNTUa66jLY5EtjPV8J8PmFWELB5RnH6SZe+utS0/q8ngHXVUCTiTEXZSq6CwGNXwnwfxPjur2TPNOkLixFqR9RgKULSB4ok3/uMuH5M7yRVwLc8uN5Hc1fbVgJPQ/TrV/TfsktaCUvZLgsVe9KgGcfz7Jwecnh6uJHEGBIRFUSWS44v2Ft4VL8918qGen5fsmd3QAAAABJRU5ErkJggg==",
    "aywen_pink": "data:image/png;base64,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",
    "aywen_cyan": "data:image/png;base64,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",
    "aywen_orange": "data:image/png;base64,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",
    "aywen_scared": "data:image/png;base64,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",
    "aywen_flash": "data:image/png;base64,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",
    "aywen_eaten": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAACgCAYAAACLz2ctAAB7lklEQVR42uz9ebBt2XkXCP6+tdae9z7zueObp3yZKeWgKSVr9myMwTbQBjuAMJPDVWIKaAyubhOYaqpoM1XZ3XQXNBiqiGK01S5kg4WQZKXGVEqpISXl/Mb77njmPe+1vv5j7XOtIuiKKrCklPVWREZmvvfOfWf4zlrf+n2/Abi/7q/76/66v+6v++v+ur/ur/vr/rq/7q/76/66v+6v++v+ur/ur/vr/rq/7q/76/66v367Lbr/FvzH18XLV31FONvp9cunP/2pWwAw7vacbhiZF+/d5TddvY7JaknnH3mcvvzUJ7A3OW4A4OGHHv6R6XTycFWVz3W7/dkDDz50VOT5qiiKRZFlHpFYPv3ZTx9+1fvP9wvwW+8105uuXsenXvgK/wcFQABw8cLF6yB6Qgphev1BYoyhk+OjT9y8dfPT7Z9zANRf/UM7UfSodJyf83z/u6QQ8H1fO8pJB8NRVdWVY7S563nePzDGvAiiAsxPffJTn5h8qxfht/wO+Kar18WnXviKWb8XDz74UCfPsuGNmzdeBoCd7d3O5tbWw0WR/xWl1BTAX3/nu777+a98+QuPLRbzs1IIMV/MH6zK6s/0B8MIMJXv+cZxXZ1n2UzrZlsbJsdxCMyvCCH+H41ulkTi2HXcT37kyQ/f/VYuQvoWe518/YHr20o5Z1zPdcIw+fKTT35oemV7V754767eGYxUZzy64jreDS/w3p3n+Q9XZbmKwujfhHH8HXme/yHlOP0sS/d0o8/6gS8JgBASIGLf8+rFYi7LskSapuy6rgyCwHS7XQ6C0NRV5ZZl+aFGN+/1/eDFqipzIeVnPvmJj8+/+jl+KxWj/G382sSli5fDfn/gTmfTCgCuXb12xXGcLTam8YOwX9fl2/v9wbXnXn7p85cuXo7CTvLOMIyGZVX8gfl8/vOe779pOBieB9H3A3grCfKOj468uq77Wjesm8ZkWaaXy6VeLOZU15UYj8fEDBRFTovF3BRFQXVdU13XrJQS/cHw+S985uk/F3WSY93ot2vdePv7+y9/deG96ep1cf2Nb5bf9o530xeeefr+DvhN9Fp4fVnYOnu23zSNkFJ1q6q82NR1Txv9wZu3bh189WMee+x1f76qylAQvciM7zmZHL/Lc92z2ztntBCi0Vp7ZVVitVzCGMNZlhkAzEZT0unCGENFniMIQ2itQQA63S5vb++gLEssl0scHh6AwYjCiM+eO68IeDKK4+995eWXNwXRH/yzf+S/+K9/4R//v/tVXfuj8ejk/e9/f/7VL2y9Q/8f7XMBmPsF+HV+PU+86c19bYz76U9/an/9iw8/9PCPVlX1owRo1/P+ZX8w+A3f98X73//rr7z5zW+9tFjMPqKkvHtwePBGpRQeee1j1Z27d8Th4YHY3Ng0Bwf3SBuDsiyhm4a6vR6CMMRysUAcJ3A9D5sbW5ymKywWc1RliSiOcfHiZeR5jvl8hjzPEEYxjNaGmZ3hYPhvDg7u/esgCH+qqqvPEdEdz/XCqip9x/X2ur3eCRv+8itf/MJ72+L73+oT6U1XrxMAtP3sf/SLeb8Av0av4cr2rujvbm8oqc7WVRW4fnCWhLgcRdEt1/Xq1Wr5h9N0dUaQuOq4nsyz9F6WpbeVcv6J1s3rpVJvnc/nl5eLeX312nWqqpLu3L6Nbr9P08kJpJQoioJ938dgMCSjNYajMWbzGdLVCr1+H0ZrRFHMeZGDSEBKgcVijn5/iOnkBBsbm9BaI45jrFZL09SN47gOgiCEEAJlUbxQFMUrQtC8afQyiqNPsOHvBXCuruuf+9RTn/znO4OR2psc6yvbu+KRd7wRn/+Np7D1wAV68kMfbb76/Xj9695wjYRQn/70p77UFt+rtgi/2QvwPzxqnO/49u+6bIz+ycOD/T/kB0EPAIIwxipdIl2lOkkSdj1PLRcLRFGMIs+wXC3N5ORE9/p9MR5v4JWXX4Jhg6osiYQAG8MkBCVJB91uD1o3GI3GSDpd3L1zG0EYQhBhMjlBknTAAOqqhH0sc11XKPIczAylFK4/+BCkVOb4+AhVVVFT12DmLI7jl5QQn2KiSGv9jz/+iY+9/81PvOUvad38VSL6/4w3tv7i+973K9P/2Bvxvd/zfQ/VTeN94APv/ywAvPH1b3yDYX6sqspf+cIXv3D4ai1C+u3Q873r3d/xzuV8/oNJp/NuInokXS2pKApzcLBfe55PW9s74s6dWzQYjiiOYj4+PuLxxhbP51O4jkNSSgKIyrLk+WyK45NjdLtdSKmwWMxJScWbW1skpcJqtURR5LyxsYWHX/MI9vbuoCgKWi2XWK2W6HS6cBwHIAKYkRc5g5kI4EZrlGUJYzSuXruOXrdPJydHODw8QF3XRETU7XQR+H6mHOclAv9gWVUPE+jNJOj78iz/F91e/xfzLH1MCPFmBieu642ZeRdEXzZaf8kw7zR1/YFPfuoT//6xxx6/KIX4wbpq/u7nv/i58tVYgPKbFbu7Oznm7/3u7xuONzb/UZHnP9fpdN7sOM7WbDY1WutmMjlBnhdyOBqL8XhDLOYzGo03sFjMcfbcBRFFkdBaizhJQESktYbjugQwdNOAmaG1AUCkHIe63R5nWUpaa7iuB2ZGFEWQUmLv7l0IKSgMQxCI5/M5los5NVpzlqZomoYGwxG0NrS5uY1Ot4sbr7yM4WhMruciCAIAzMxsVqulBpFHoE3f93/Qc93jumk+RoRECPn7HVf9JLN5fZamz2itrxFo3xjzq0brQVkWlwXRoCyKP761tZ0/87nPfnB350zXcdX5u3t3X7qyvSsnqyXfL8D/zJ3v7uQYly5ejiDw0bIsHw78YEEk/CAMTVVVdPPmDVlXNeIkQRTFcFyX0jRDU9fsOC56/T7dvX0LSin4vk9FWQLMLKSE53lUVxUp5aAoCtR1jW63i+lsiqPDQ8qyFI7jkHIUhWEErTWMMciznO7du4s0TZGlS1RVRXGS0PHhAaqqxNb2DgaDIe3t3UHS6VDgByjynKIwYqUkMYPquoaUksqyNHVTa8/3B1qbRzzXfctqtXpHFEWqLst/I6V8v+f5j8dx8uEPf+TD/83tO7e/cPvO7fef2d19ThB9n5TyDAg/eP3Bhz5QlPln4rjz7hs3XnnqyvYu3Z0c3y/A/9ye74d/5AfFcp7+q6osVzu7Z/9GWZb/J8dxZV3X4kvPfgGO4xIRUa/XQ1VVkELS0fEhl0WBXn+A2zdfQV3XiOOE8jyHMQae76PIcxRFjulsSmm6QtPU3O31KEtTFHkBrTUREbRuACL0+wMopfDlL30RVVWtnyLVVQUhJbI0g3IUJUlCZVmiaWowM1zHheO4ZJhRVSWYmTa3trFYzBEEAYSUFEcR+X6g9/fvhZ1ub0MI4QqiAyEEa938oaoqX59n+eu3t7bze/v3Pv34Gx5znv70Zw6TTuffuI7zu5XjXHWU4ygl3+f7wbe/9NKLv3F3cvyq6wO/qQqwPUKMI/2fcF33z3p+8L11Vf2poshem2Vp8/LLL8qyLBGGEcIwpNVqBc9z4bouMQAYgzzLYNiAiCCVRJx0aDQa49y5ixTHMbmui/lshqosQCRQVRUtl0tIJampawRBiDCMIKSElJJ8P8DBwT7quoJSzmn/x8z2v0G0XC5htKY4iuE4LtV1jSzL4LouRVGMk5NjGg5HSJIOqqqi4XBETV2jaTSNx2OzWi71ZHLCQlA3CIJLWus7dVV/V1WV55WjvmMwGBx9/nOff/b6ww+4X/nSV7JuGP2aF4Q/Nt7YfBBMg6qs0hs3Xnnyx378J8QXnnn6fgH+p0w1rmzviqws6eLlqy4IP2eM+feO4/B8PvvT+/fuqfl8Juqqhut5FIYhPM+D53mYTieoqgqr1QqdThdKSmrqhsIowtbWNogZYRgSwOh2ezwcbWBzcwtFWWA2m1LTNKjrCkZrElJiOByhripEkT1+l4sFTk6OoZRCp9MBMxOzISKBdnelJOkgCEI0TUNVVSGKYrieC88PyHUcUkqiKiuQEAQw8jxHFMUklYIQREQkXNdFWZV13dSyaZoPPfX0p//OA9euj0C0qJv62+Mo/l/6LKtwMAgeeu3jeVHk3+Y47uPM/AY/DP9fzz/3la888vgb7hfgf+LiyWrJyzwzW1vb20abJ0B4rqqqn723dzcqq0oDIG00zp49x47jIk1TlGWJLMuxWi4RRRGKPENZFmSMgVKKjo8OablcYjGfY7VcUlVXZLSmqqooCALSxlC7UwEg+J5HSql1YcEYA4Axn8+RdDqYz+eo6ooAQEn71rquS0IQtNZwHJfzPMdqtURdVegkHfJ8H01Tc1mW2BhvUhhGaHSDXn8AsMGdO7ehmwZKKUipxGIxF51ud3ju7LmrTLim6/r7hBBXtra2X3ny6U99fjI5qQe97oWmaX5sNN44K6U8qqry7775zW+f/JN/9Pea+7fg/wSY6HWPv/6xMAzffOnSlYtSSbfRzQ8aY94ym83OzGbTxvV86fsBhsMhPM8ne/wuMZ/P4Ps+/MBHknSRFxmKoiClHBhjoLVBVVW0Slc0n88wn88wn04hhAQzY2M8BhFRmqYIQruD5XkGpRSqqgQAlGVBRARHObRarWCMJkECrudSt9sjzw/QNDXm85ntO5MESilyXY+kUqjrGrdu30SWpXA9n5bLJZgZ89mU8yyD1hqr5RJ5nmMwGBJAuiyKDhF1wzD+E3mWPkAkXgeid4xHo8fOnT133hjzFjbm+yDIS5fLZrVYvHD79o2Tw8PDCQBxvwD/D+B8j7z2kd8ppPzjURT/riLP/8swjn9fo5vrB/v748Vi3sRJR8RxTEEQoNPpcFVVtFjMMZ/PiRlwHAfGaKrKEq7jom5qipMEabqC63ooqwqO46Cua+R5gazIkaYrDPoDjuMOnTl7DgRQVZYQQhAIEELA9TxUVQmtDYQgrFZL9Pt9uK4L3w9IKYXVcsmu61Kv1weRQFHk5LoegRknJ8ccxzGKIqeyKCjPc7p75zY2NzfRNDVPJxMQEQAQgxFFMY6PjzAab1BZFOQ4TlWVxVQK8WDS6VxcrZZeXdePuq7zPULId2R56hZFITzXu1eVxSelcr5j797er3/1JWQNZ90vwP8/xffWt74zyrPsH02nk++cTidnmUiVZRHfvnXLZOnKBEFInU4XrutQp9tjpRSyLKO7d29DKYUwDBFGETzPozzPaLFY0GAwxOTkGMvVysIwQYAsy21R2eLBcDjC4cE+jcZjOI7ChYuXUdUVPM+nKIoQBCEuXLyE8jdhGhoMh+S6LoIwbPE9D71en05OjtHt9ZEkHdRNg7IoOE1XlCQJGTZUFgWklKjrGswGYOb1TZsBSCmp3x9iOj3BbDalpNOhpNOlKI59z3U1Mx51XTeRUpg8z7UxrOum5tl8BqM12aNb3hBS/f6L5y8Ut27fempnMFLLPDNt8Ymf/tmfoo988KN8vwDb1b5BfPbMmbculou/tLd316xWqXEcB0Weazu5gBiOxjBsqKlreJ6Huq6RZiksjid5OBohS1OsVksSQti+TRuUVQXPdRHFMeKkg7quuKpKxEmHAEBKhXS15PHGJvr9IeV5hl5/QI7jIAwjbGxu4e6dW4jjBL1eD8PRGJubW+h0urSzs0tg5qauAQKU48DzfOp2u1gs5mipWegPBtBNgyzLUFUVkk4HW9s7KMuC6rpCknRQtL3marmg4+MjevTx16Ouajuhmc9FXhQPZHmWZHlm0nRFUZSIsirFyeSEmqYhz3OF6/pLNmw2NjcfyYv8uy+cO/87t86c+WMXzl/83msPXM9eeunF57bG5/vnL18wLz73vP6WL8A3Xb0uvnL3lgaA4Wj0D/b27l7odns6jiM5mZygqmryPI+STpeKPCcpJEslAQKOjw4xnUygHIe0NoijmKqqRJquqGkauI4Dx3VBJKAcBWMYWjcgIVgpRVJKKosCxhg0TQ0waLFYoK4rHB7so8gLMACtG2it2bG7Cy0WC+RZhroqMZvNwMzo9voYjzfQ7w8wm06IpIBpQesoTrCYz9A0DYIggJQSYRSxUgpxlJAQAmVZku8HVJYlHR4d8nA0oiTpggRBOQpRFGGxmDeDwZABUJplaHRDk8kJijwHEeHSpSs8X8wdw3z24OBA6EY7Ssk9EuKvZll6bAz/5Plz598F4AUB4bzwwnPT93z/D9GnXvjKt24B3p0c8xvf9MTlc2fO/dztO7d+WGutz527ILI0het55DgOMRvUVUWbW9uoqhJNXaMoChRFCcdxkKYrdLtdaN1QlqZERFBKwf7bARFhuVxBOQobG1tc1zVVZYUsXSEMY2JjsFyuMJ2cUFUWmExOUBYFJifHmJycgIggBNHk5ASO6yGOIrieByEkMRjMTEWe08nkmNgY8n0fZVmg0+nCaANjNAshkCQdSCkRBCHleU5lkVMUx+gPhlTXNU5OjrGYz7G5tU2eZ3+GoxwYbdDrD8BaC0GE+XxGUgo6OTnBarWisqpw4cJFxHGMqqyU1topy4IdpUQQBId+4P9fP/KRj3zClfJXPd/7w57v/5+lVM8///xzzySXrqhXXnrefEsW4IPXHwp2trd/uCrL371YLt4zm07rS5euiIODfRg2CMMIfhDYS0NVkZT2tppnGeq6gpQSVVVCCAHHcVGWJdVVBaUUlFSom5qNMQQwhsMhAILruDSdTuA4DnzfR11X7QiuAjMDIFqtllgul/B9H1EcQUkBgBDFERV5hvl8hoP9fUxOjmGMgZSSpJBIVyvkeQYhJVzHhTEGdV3DGE1BEKIoC5RFQSQISaeDIAhQliWqqkS6WsFxFC5eugwhBPwgQCfpwLBBWRZMRFRVJVarJXm+h9l0hsVigaIo0O8P4DgKy8UC21s7FIUhj0ZjKvJc+2F4xmhz6dFHHvtUXVeeIKFA4ns8zzv/Iz/yI7/4i//g75lvxSNYvOnb3q4k8G5HOXeVUq5h871RklCn26VXXnoRfhAiimP0+31KOl3y/YCN0cjS1H4oRUlZlsHzPSilSAhBdmQG6KaBMRrdTpeCIIDr+RZcZEaSdNiCvxm0Nlgs5mgaTcwAEYEIqOua4jhBHCcY9AcgIszmM0xOTpBlKYwx8IMAg8EQvu9juVqCmclxXYAZUkpkaQrXdZEXefucGUREQko0dQ2tG9RNg9l0grIsMRgMEIQhVsslXM+DkhIkiF3HhRACSikyxqDRGrP5HIdHhzBac7fbRRwnmM3m1Ov1sFjMYbFGDddzaXNrmxvdXJ9OJ7/Pdd0/LYT8SBhHcVkU31YU5SeeffYLz//Yj/+E/HoB1q+GAhQAzLDXf6dUys2y9Hc4nvvXqqqm0XiM+XxG2mhcu/YgXbhwkXw/QFM3qKqKfN8HCQGtNZqmpsFgCEECzCCtdQu1uCylpLppUFc1SAgsV0vkWQbfgsAIw2hNqaemrqksSzAb6nZ7cF2XNjY2kSQdbO/sAC3vTwqJCxcvYTzeRLfXQxwn8IMARATHUSAQKUchCCNMTo4t9sHAmbPnsFwssVwsoK3c01560hWaprHPJQgxn88AItR1jaauUdc1tNa0pv2XRUHaaL63f4+mkwniKEYQBBgOxwSyxAZBRNpoFGWJg8N9bG5tg5sGbIzY3N7pG63dQX/4M1VVvbxcLn84z/PbN2/e+MDG5rb8eh3D6lUAt5jHH3/dSGv9mqZpLhPRe3q9QeO4vjw6PBBSSr527fop9YmNQVWVyPOMHcel1WoFZsO+H3BZFpRlGcIwBDOxlBJaa+R5zgCIHUZdVzh37jyPxxtgw0SCcPPGDaTpElprBGEEAPD9AKbt34iATqeDuq5xcnyMXrcP13MxnU5weLBPRVGyUooGgwF3uz1IKVGWJUspoZSibreHumkwX8whhMCFi5dwsH+Pjk+OeWNziwhAUQhLTEAEqSRcz8PhwT4GgxGUciCEgOd5EFJCCIHbt2/x5tYW2efqo9vrcZ7ndHh0gCiKuWlqpFkGIQic5+h2e+S6LnzX49u3b5IbhFXS6bp1Vf3c5OT4v6p1Q2z0CAC+/NQnvmWOYAGA4yh6F5H4qNHNQ91e/4I2urtaLilOOhQEIXq9PpgNppMTmkynuHXzBibTCZqmget61E4oKM9zeJ4Hx3ERtoUEAkVRRBfOX+AHH3yILl+5husPPkyB56FpajIMEIHKqiStDbIsxWAwbNktDN/3MRyNkaUrHB0eQhuDsipxcnyExWJhb7VRTFIKFEVBi8UcgR9ASFtQYRQhjCJyXQ8AY7GYwxiD0XgDjlLY2NgCCUFJp4PBYAgAKIqCiQhxnEAKSZ7nIssy2F1N0Gi0QfP5HNPphDrd7rpvJAKgtYbneRRGMVV1DWMMhWGE3TPnKM9yKEfR3t4e8jyjKOmIsii6ja77q9XqNVLKX7+3f+8Djz7xuLh14/a3xA5orl65Fmpdj7705WdvPvbo4zc8PxjfvXNLbu/smvl8Bt1oKvKMV8sl5os5FosFkqTTUqkyzGYzxHFkaVdSgtlSOy2w7CBUARylYLSmxXLBVV3T/v4e7u3tIYxCzrKMBAkEYYitrR0c7N/jpmloY3MLzAa9Xh/pasnz2YwMG3DTgIg4S1M4rkvtbgy0H34QBHR4eIBut4dut4fVasm2f4zhui4ECayWSwghsFotsVwtMRqNYYyB67htW9AQAZwkHcqLHFVZwnFcGDZ8cHCPPM+H47o0uXOblVIUJwnu3LqFwWCA0XgDeZaiyDM0dUU7Z86i3xvQYjFDWZYWi2xqpGlKe3dvG0fKOM2yP7BcLpHE8ccBYP+5G/ytsAMSALG5sSmllP/1xnh8fTjeePjwcP8NUko+Ojqk2WwGYzT29/dQFAVVVQXf9+G5HpSSSOIExmhMJhN4nmfxvZaVMptO4Ac+gWFnt02DNE1pPp/j+PgIRAJlWWA6mVLd1FguFlwUdiIipKRut4soSpClKU+nE4AIeZ4jjCJazufkeR4W8zkAJq+91GhtYNhAWqqWnZL0eqSbhn0/gJSSDDMEEdIshet6NJ/NKMtSpGmKo6MDFO0lpaoqKoocVXsrd12P8yxFGEaUZRkcpfjo6BAEkOd5KMsSnW4Xm5ubICFgjMa5cxegmwYH+/ewXC6RrpZ22gJLFyvLAkRkJtMpwiC4efXaAz/15S9/qf56sqa/EQVIXzWD5KtXrz26XC7/W8P8ztls+vjB/j1T5AVOTo7J8zzM5zMYzQSCpVi5LkgIeK6HTreH17z2UQRBgCxN7egtDFFVJYgIeZETyO5MRVlgtVpBCILRho3WGIxGZLRGnmeQSqEocvieh/5gCMdxiAi4fesGiAhpmiJJOsiylJRy+MLFS8iLHGCGYYaQihgMIkJVlTh3/hK0biCFhOt6yLIUm5sWt/Q8jwiwtK44sVhmU0NrjaquEUURhJBI09Wpai4MQ5rPZ1RVFaqqxnA0ppOjIziuQ03ToNPpotPpQCqFMIyQZSkEEVbLJeqmwWI+g+8HqKoKbKEcNE2D5XKlpRROHMX/1Yd+40MfW4/pfrsWIAHgu5NjPn/xYq/f7e3Udf0nAbwxz/P88GAfTdNQWVUIgoDst7Rk5VgQ2VEO6qYhKST3BwNEcUKdTge9Xh9xkiDPMxR5zo7jwg8CFIV9k9MsIykEd3s9KooCJAhN09B8NoXn+xafq2pyHIe8wEcUxSRI8GzS7nwtK8XzPZAghGGEsshx7vwFBEGIe3t3qT8YoK5rBH5g9b/GwPM8K9k0hsIopuOjQ4w2NrBYzCmOYgBAEAQcBiF5rv2zvV7fHre6gZQKvb49VtlYOGe5tGo+IQQfHR2SLSiGJTwQPM+H63kIggDL5RJ1XbOSknq9npUO5LaX9DwPy+XSeJ7nDgbDjxhd/bmL/bH5yt1bv21xQAGAH374NZd3d3Z/UpL42bppfro/GL6dDetbN29IISXFcYwkSRAnHTLagMhCKsYYLFdLyw5h0NHREYQgOI5LZVEwG4PLl69Rt9fDcrloSZ0RckuzpzAKLRbmupBSwHU9skelgqMclGUBP7D9l+t5CFvC6XQ6RZ5n5Pk+CIS6rjAcjVHkOQGgs+fOkxTC7jhCoNfvoyxLpFY9hyhOECWJ3d2qikgQsjSl/Xt7KMsC6WpFAHMcxxRFUTst0RBCYjAcMhtDcdKB53kAM9tda47ZbAo2DMd1CKD2yG/Q6fbWPET4fgDHdaF1Y+fRvT6OT064rioIIZkIcjgcfnFnd/cHPvHJT86/EZR9+fXc+R575LHXkKA/XNVV4ijnDULKbUFUHx8fke/7iOME0+kUZVliNpuu9RwoigKO40JKCSGI6rpCx8IKpJsGTdNQnCRkmNn3A2xvbdN8PqPFYkF+4FOSdLidQpBlP4MAhuta1nRRlqibBp7ntXPcHjqdDh3c26PlakmGGVEYIU1XkFKSEIKGwxHKsoTv+djc3MJ0ctICvg1WyyWyLAWwhn0uYD6fQimFNE1JCIEstyQEpRysVkvKsgxFUeDg4B6apoExBulqBW005rMZad0gS1McHuzDdV1oraGNISLBVVWiyHNsbe9Aa02XLl/hu3dvY2d3l3TTUF3VVNcVds+cBRFhPpvBGMObW9tyNBr98v7+vY899thj9cWrD/ErLz2Pr2cRyq9X8b3m4dech6DHwXg6T7MkSpJ3OK4b3XzlJSjlCBKCjo4OIYTAmvKkpISQ0u6IcYztnV1ce+BBGo830Ol00O8NcO7CBcRxB01TY7Vc0nw2w3w2o26vh16vB2aG5/lYLhcIw5CCIEBR5BgMhtjc2kYYRUhXKYjsn/P9AL7n4eDgHqazKZq6hut5rHVDxph2JlsiiiLs7p5Dmi7hOC483/5cOysGzp2/ANdxAQCL+Qyj0QbyPAcBmE7tpSkMIxSFtYFRSmE2m1gyLGBHd2yIDVPT1Fgs5kjTJSmlyGunLXmeEbOBFBKe75Pn+fA8D1EUgQ1jPp+R7we4cPEyFos5ut0+a2NwsL+Hra0t8j2PhZCvS+Lk+4o8/8JvfPjfvwSAv/PbvzsaDkai2+26x8dH+pu+AN/2rrcqXfO7XeV9OM9Wf9zxvB9mNpcWy4XRWgtj8TfWTYNer4/RaIyjo0Ockj9dD4PhCEEQUF3XyLMMeZ6B2eDunds4PNpHukphjL1QLBYLlGWJwA/okUdfB60bIiKKk/gUqun3h9je2QUAHBzcQ13ViOMYRmtMpxMsFwtUdQ02BsyAsM4I3O32KEk6UI6DTqeLxWJOWjfY3NpBmedQSvLVa9fp4sXLWCxmuHdvD0SETreLwXCEqqqQpSsGiFzXQVkUa7o+hBBomgYE2IsUgDRdoShySGnZO2m6AjNTVVXEzOy67vq5kFKKfN+nvbt3aGf3DM1mU0gpWBBhY3OLptMJAYzlfA7HdcHMGAyGMMybSafz+gevP9S/fOnywPf8yb//8Aemb3nzm/uveei1u1/+ypdPvlYmBvLr0fdtDDZfa4x5R91UP1aWxR9Wytmt67qZTacijmPK8xy+H0CQgOf7tGpVaESChBAUxTEVed6SAhZYC3dcz0eeZSjLAsZo1HWFpm4glcL6aL5z+xZLOxtGFMX2thxFp2BwlqV46YXnceXaA2iaGsZoaK1RNw20NiylsLRkApRyoLXGzu4ZiuMEVV3B9zzy/QAAWlJEQ51OB8989mmcnJyAmbFczNEfDCGEQKfTwXK5pMViBmMYICCMIlRlxZ7vk6MUDDOM4VNsUykHVVVCCgltNLa2trFcLlGWBSmlSCmFoigojhOEUcTLxYIOD/extbUNISVuvPISlFTY2t6hZ7/4eZpOJlQUOcqipCiO0e319WKx2HZc5zscx3lHWRbehQsX4snLN57ZPH8+efx1r/c/97lnVl+LIpRfYxmlmKyWvL2z+/0AfirLsieiOP4XVVX9xnw2e0vTNFoqJeq6PjX5cRyHHMeh7e3t9pg7gwcefAjD4YijOKFz5y8wM6jIc3iez1GcIAojCCGQZRk5yiHf90lrTSQEqrqi+XwGYwySOMF0OkFZVUzWOoNu3HgZnu8jimIsFnN0OlbBtlwuLWW/LNE0DcqyhOMo7OyepSiK1hOLdg7doK5rLBdz+L6Pe/f22scULTM7wmwyOb1gjDY2cLB/j4s8J9fzkK5WWK2WpJTiIAioripYBwYXURTb3TwIQAD6gwGKIueTk2OKoqil+hfw2xagqkoEYUDLxQLKdeE6Dnr9AR0fHdJ0cozZbIp0tQKIqKkb+IFPGxubYjQa67zIG2buxXFysa4qCvr9Ua/fe9n3g/otW2ey1tL4m6oA6e7kmMej0Z+rqurbhBCf91zvTy0Xi/dMppOdMIqMMUYAwMaG1ToIIuimwXQ6gZASRZFjNp2gKEq0N1Eq8gwHB/vodLrkOIqm0xMqi5Jcx0UYRdja3kWv10OarrBczLG5tY0sTZG3BkFZmiJJEppMjjGdTOC4LqfZijqdDs6du4CiKDCfzcDtKM4YBrNBvz+gwXCIxWKBIAxRlgWYGavlkjudLu3v28IrCvvrsu3ntG5O+8Y4SU4Vc6vVkqqqhO/76HS6WK2WdHJ8BN8PEIZhS3DwoZRCHCfY3N6GFBJ3796BFBLGWv+2HEegrmusVkv0+gNq9Sao65oECTiOg8ODfWjdoChK1HUNp50xExFGozH5fiCWq6UWUvQGg6HTSTrvY2D75Oj4tf/4X//yM99UO+Dae/mhBx/8DiHkLhE9rrXeq+vq9zRavzHLci2lkFmaotvtoSwLns/nWDM5WkyLHdelxXyOqqmIAORZSnVdcRBEWCvZZrMZ1XUNANzpdKiua6TpCnVdw/cDrFaWaCCEQJquGAzyfA97e3fBzAgCH67j0vb2LsYbW8jzfM2kISFsG+Aoh8IoguO6qKsKYRQjzzILtURJSyA9QtM0iOMETV2jqivUVclaaxARjDG0sbEJQcSuawXqy4WdTlgWjaX8E5EFoKWA5/nc7w8gpaTReBP7+/dQVSUlnQ4B4LquSGtDRVGS1g0BIClE6zdDCMLQAumrJYwxYDZI0xRExIPBAEEQIGmlCE1TQzkOEYk6DKMd1/Ve88pLL/4PQtADV69cTV548YVXvmkK8O7kGG9711tVU+pHhZQ5G353XVeDuq4vZnmu4zgWUko4jsN5nqFpGjJaU13X6HS6cD2/Re2ZGEAQhCBBlK5S7OyeoYP9PaTpCp7nI10t4Xseut0uDYcj2AIG4jiBEAInx0coqwp2lBeQoxRmsxkAWE+/PKdut48z586j1+uhbiwbua5KBEGIjY0tgIBer4fGDvjhui6IiF3HI6kkjGHMZhOwsRZs2s6M4ThuO9kQSNPVepxIvuuxEAJRHJNuNPI8R55nIBIQQkDrBv3+AHEUU13X5DgOlsuFvRS1DJiiyAkAWweHEkEQUMvAOZ14DAfD0+IuigJGazCj3T0VAIJSkoxhULtT9np9UdVVbYzZCQP/DYv54ueVcq499PBrbz333JeLb5ojeHO449RN9ZAgenfT1L8qhOgIKc/HcaLDKBZExGVRQinZFpr95lel7WnSNKWmqdsZrwQb5s2trdYSLUfS6SJNVyiLgkbjDTu6m01RFlbMU1UVZ1kGKRWtlosWR5Sn89o4SbCYz8l1HJw9dx7dbg95liHLUlhXqxqOUuj3BzDG8JorSLBjwSLPqaoqCCFQFDlWizk8z7fwEREC3zv1jyFYQL2uKmRpyiQESQs5kee5HAQB9Xp9SKk4CEI6e+4cRqMxlu3PnM+mWCzmCIMQnU4X08kJstROaOq6JqUcAoiTJCHHcVqMUYHZthHMjOl0esr0bom7lltYVsjznAaDIaIwQlEUICIqilybpjkbxdGTL730wvuUUK955eYrt74pCvDK9q784vNfrkfD4TuVcv5LIcT7ZrPZt+dZNqh1zUZrEsJqpJumAZGgXr9/OvIqCnt0KeVQp9uB7/kAiCYnx2BjcO7ceYRBgOViDhBRp9NBWRbQ2tieqtvFbDbDwcE+ZrMZ+Z4H2y/ZsZ7ruDg8OoQf+AADYRgiCEIsFnO4rouqLNA0Go7rwtiLBq3xOiElR2EEZkO+58GwgdGNxSzjGCBwFMUUJzGiMGrtN6wswPM8WBdVQqNrauqGCUCv26VBf4DA9ykIAjR1jdl0anmE81n7WP90p4zjBHVdwXU9FEUB0RIQiASYmYajEZIkgeM4mM9n8LwArt0F2fd9KvICeZbR+qYd+IHV0vT6VFqpACaTE9M0tazKMhFCfoyZz966fesr3xR0rDZNSFCc/PNVuvq/KMf76yD4aZYaT3vU1A0zM3RLfSqKAov5DFo3CAcDJEkHvh8gL3KrIPMb5HmOfr9P585fWO8k8DyP67rmwo7eaLlcIoqT9e2VrD7E4SzP1x6AAICTyQnCMFzPY9ujVaOuShjdIIpiNI2dx8p2h3NdF0EQwnFckq2OWGsNozVrranb6VpczRgSQkA5DlzH4m0kCCcnxzg+PrITkdUSSjmIIlv4Bwf7LJVD0lL0eZWuqCjK9ViNi6Kg/mBg2xPHCqvWu5vjuJRlGfu+DyGIwjDEbDqF0RrdXo9d16O9u7fRaM0AkKYp6rpCGEbodLuIwgie5yFNVzg+Pmy1MExlkcvpyTGiKHq7UuonteYPfDPdgunu5NgM+oOOVM7va7TeTdNVU5WlkEpZYU4YnhI1V6sV2FiWBkDIsxR+EGD3zDnyPR9HRwdQSsFzPRhjLC+w08FsOkXT1Oj1+kg6XXJcF67j4mD/HmazGZSjkMQJMRiN1nBaTE21thhZmkJKif5giNF4A2BLGq1b6hcISOLkdNd0HAdVWSFOEnQ6XXaUIm00RWGEXr9vGdUEeL7Pm5vbtBYUtbAPorboszxDp9OhdvZMgR9QmqbIshRFXlBVVQxm0lrDthGS/CBgrRuSUnEcx8haWcFyuUSn06EwDMn3faRpipYCRrPZlA4PDwFr94E1Vd9xXMRxzJ1uF0SCyrIkz/cQRTGIBB0fHfJqtWQhhFRCzsoi/5hpmpN7BwfPfjMUoABgHn3tIz+ulPNPhRSXDg/3m7qupSUYEEAgPwiRZSm3PD5aLObtLRCYzxeoqhJ379wipRQ2NrdO9a5VWSJsYxEcpWhNgRoMRrRcLLiqK7JCIR9VWWE2m0IKAddxUNU1HMfhuqpaxZyDXq8Hx1FwHQee60EbDT8I0e/3cef2LVugfctScRwX0koqOQhD6nYt3DMeb7TMbUaSJKdza9d14boeOp0OW+csBhGsQZJUEELQcrlAEITc6XTXkxEiQSSEhJKSfd+n1HIEkWUpdTpdDIdjOtjfQxAE1DQ1WSP1nJumJmPsyTKdTXm1WlFVlTDGsJISumnIcVwADKUk+YHFDKfTicUeHRee79EamySAlJLsOu4/ZeYz9w4OnnxVF2DL9TNvesOb/ojWzf8N4LppdLKyMIDVMAQBptMpJpMTRGGEpNOhPM+4KAowQFobSCVPR2BHR4coywLj0ZizPIPv+eRa7z0A1Ip1GhoMhlgul8TMUFLBaZvwNY8wLwp4nseBLXwiIsRRBMd10EmS01mwo1Q76gOKPEcY2saf2WAyOcGlS5exsbFJEITxeAOz6RR+ECKOYvR6Pdv8G0ZR5rS5udOC1jl1ez1EUdw6s3q0WCwQxzHCKKTJZEpEoCiKyXPd01trWZVUlRVbsXxDzMBgMKCyLLBcLml7ZwdlVcJojYODAwBEcRyvd2xSSsEYAyGtM4Ql3AryXA9SSiwWCzAzuY6C7zgtTLOCINHyBRfkOG7W6/Z+qW7q+t7+/mdfzQUo7k6OzaOPPPZQXZU/EUbRnychv+PmrRvbgR/oTqcr5rMZgiC0TBI/gDGaWokk1U2NpmmotkaQJKWg2WzKYRjCcRxazOcUhhFprSGkRKfbRZaukHQ6qMqSs3RFSio4jnNqnTsejaGURJqlLVNZoMX2oKSEVAq+52Fzaxubm9vIixxGa1ZK0d07t+E4DobDEYrcsqUd1/5/nMTY3NjEwcE+kqQDgHHmzFk7CpQK/eGICATXdZFmKUbDEba2d5EkHfv8jLFa3SKHoxySSqEsilZQxaeO+iBCWZUEBuq6gu972N7epdwKjeAFAfIsw3w2a5nTDhmjEUUR5ou5/VCkAIGIiKgsCvieR8Zo+L7PSRKTUg71uz0Me31K0wzL1RJSSaSrVaO1Ub1u73NCyl9q6uqT+4eHq1dtAb7tXW+Vt27cNmd2z/x4XuT/otftP7FKl3+wbupqMpnI7e0dGo5GpzgawCjLEkIQXMehPM/R1A15vgejNVarFcIwRLfXR7ZaEYjAxiAIA3aUojzLEQQ+VkvbD1rrNQWtGyRJgo2xlVOuVksQCFIIlLaxp14bNhOGAcajDcRxgn6vj4ODfVR1TUmcoCoL6KZhEKHT6RLA2N7exebWNqSUp2blu7tncfvWLbiOi9FoDK2b9WTjFA55zSOPwfN9eJ6P0cYmr1YrDEcjklJSmq4QhdZdwWiNVZpCa40kSVAUORzHQSfpUBAG5DoubW7vIE1TKEfBcV3kWbZmVJPv+WtHMBui49qLkOd5KFuxkzGGoihiIQS6nS7CIEAQhsiLgrM8g+M4WMznTZbnXjdJ0Ol0/gw3/BtPf/6Z2av6EuKWhiarJW9ubPzOJE6+Vxv9XzRao8gLKsuC7G7jo9vrYTAY4ujoCErJUwDUGG1nlI2FNAB7BMdxTEVesG4aSKUoiRM4rns6ylJKodvr02qxgMUNCY89+ji2t3dwcnKCPEuhHAdLa1RJRVnAdRyAASUV4jiGNhrL1QpGNxgMRgAYQkgsFgsKggDnz1+kRmsMhyMMBkN4ntUU+0GAXr8PJSWef/4r0EZzUeR46aUXyHM97J45g9c++vj6tgwSAgTbA87nc+r3BwiCEFlupypEhPFoDCLCYrGA53lrTBOu60JJibPnL2I2ndjphtYIo9CSNJjhuC6apkFVVXCUgyiMsFpZRo3n+QjDCMZo+C11K88ytjYmGgcH+/bX8tzUTe3GUXTiOu4fT0adX/r4Jz5ZvepHcYOkIyarJe/u7r5HSfl7/CDUaboSs+mUhBBYLVfwfR9xkqDIc1RVAWZQGIa0piLlWUZokfsgCFr3qtqyU4yG67oUBAEqa/pNQlg7jsODA7TkA3Q73da/RaBpapRlaa07hEBVlqe7gi16g0Y3cBwHURxjNN5AVRWIwsjS+a2jAZVlieFgiM2trdPZ8Ea7EwJ26nLp0lU8+4VncHR4gPMXLuHRx19Hu2fOwfU8EBE2t3dPmdbUCpMEEbnta23qGtPpBMPhyAbhJEk7RbGvhQAknS6ausbhwT24rgetG1ZS4ehwH+sj1tjLmR0JtkB+O5KjosjRvn82fqLXJ0GC+v0+up0Ol3nOSkrEUfw/dbu9H93c2PxilZbm1t07+mtBVP0tLcDJasmPPfLYGx2lfpSEHIOEKIscIMJ8MbeYnFJwXRdZloJIUJ6la/dSyrIMQRBSXVVMQpD1awmYmSnLsjWYS6t0hW6vi6ZpaLGYQ5BAWZbI8xzj8QYef+x1KIoCy8UCBEAqBQajrEoAhK2NTXiBj62tbeyeOQciiwUqJTEYjNoBvUAUx5hOJ1gtF9jY2GwdqRbwXBez6dQSDqSE67owzOh0e3jTm99Kjzz2Orp67ToNRmOEUYTVysowd8+ehxQCzMx1ZXUZq1ZmUBQ5RuMxkqSD/f17kO3OTETo9/pWdddoqFY+kFvcj+bzOaWrFXZ3tu1suizhKIc63S5G4w2sViv7ZSSBPMs5ikIoqcgPAiilMBgMUJYlptMJN3WjlFLSMOeBH/xLrXUxnU4PnnrmM8tvCj7gu9/97mFTN9tKqYfrprnOAEklSTkOtd540O3EQBChqioSQqJurEtpayQJx3FPjxPX+qtQEPgo8py0NlBKYbFYoKkb0lqjKOx4stfr4dLFy5YPqBsIKWD1FC729/dR1w3O7O7CDwJEcYxef4DLl69ge+dMqwsp154t6PX68IMAW5tb6Ha7rU+M3YmkUugPBkiSBEmnAzAj6XQQJ0nLUrGcwiiKsbG5jTjp8GI+R1WVNJtOIEhSU9ckBMEYDaMNjcYbqJsGSWx3vaoqsVguebm0hkNKKmR5Zme90jKgsyzj5XJBvW6X4jiB79mRG8OQtSgxGAwG1hqk1UqjtRMmAhzlYDI5sa+JSHqef2yY5wQapml6QQrx9z77hc/ffuPrn/D27t1tXv3CdMa7wyh6w2q5uBzFiSirqlkuFqKuawwGwxZkzXFycozd3TNkcqt73djYRFXVWK0WUMph+2E7kELC9z3MZzlLpawQvCytqQ+J9mhykCQdjMcje3SNx1guF1itlgh8/5Qx47kuRsMhXNeDo5TF8Dod2xdFEZI4Qa9vHRisFYZEFMdYLS1bRQhLDJ0v5ihyCwB7XonFXKM/GMLzvNPZq+s4cDwPggSolYWeO38Bnh/g+HDfUrPiCJ7vURiGXBYF9vbuII5jlEWBKIqglMK2UvA8j7K8QJ5nSDodNlrTyckx6rrGxngDVVWui9aeEI7iNE151uqNiQhbW9s42L+HoiwgpcU7pbBEENt+KOF7/herqvy1Rpt3+Z53pMF/4NPPfPbL73jHO0IwXADl1yJv7re2B+wmL2ltDlzH+b3L1XLs+r5hYygIQuR5htVyAcf1wGxgwwIjSCHJcRykq5VlRUtJvu+DjcGVq9fWAhq0g3zyg7BVebmnfZvn2RGZIEISWwWZ6ziQUmF7awebG5twHct9U1KyUgqu61EUxeh0u7ZYhLAuVU2z9vqDaY/YOEnQSTqQUqDT6aLbtTfo/mCI8XgDURzD933oRkMQIYpiZsPwPKu8K8uClOOSkgKdbg9xkpw+X8/3yYqgLAhdlgUarVGVJVarFbTWBLJ4ZJ5nlKYrGGPaKDqmsiwRRxEGgyGklLwGwmezGRqtaWkvMry9c+bUfk63c20hCFJK9vxAeL7/ySLPHSXVsVLOL+7unvn07s5OZIzpsjKTr5VVx29pAV5+8CrBsALodxHR2VWamtVqRUWe2ew1o9FYtwAQCVrMZxBWZYaibF3niwLKcRCEATqdLmbTKbTRlt4kBHELpqp2akGwfsq+H8DzfXS7XXCrf5VSotPtgUDIixyCCFJahnIcJ9Tp9ayrVBieMmVcz2fXdUm3WJpyHKDF5JwWIE66XXS6PXiuaxnPLd3KUQ5bapMhECjpdqGbGkZrgGFBaMeBMYyw/TuTThfMlm4WBAEcR8Fx7BcqjmOqW12KUgq93sCK8j0rdCcAYRRxHMcQUhKzgeNYwkPrnUNCCMzmM6qqci1epxZw5/a2T1VZmiiKrgspHwbzbYCzoixcMCQ75uX/IA721XsEv/z55xD3OqrT7Z6AhN0VtEGWraipG14zN5q6we6Zs5hNJ2s7WgjbnMNxXZRlQa7rYLVaQirFxhhAcZtYpFq/PwaYTxkoVVkCSQI23IKv8j/oJT2urCWfLV7fg+/5TEIQ2F5C3NbUUjkOR7ohR1n3fBFF1sEIZIuJwEZrcqMYURyvMzxYtAQBO2oUrJuGyrLAeHMbRlse33w2wWhjC3VV2v6WxKmtiOdbDM91XMznU+hGIwxDGGMwHI4Rdzo4PLiHw/19JHGM+WzKdaOhmS11zHHIUYoZgCRCWRScJAkpxzlV5ynHYbZaFLNczOHYvDwsZrObUsqbDDwjpfy867of/+CHPzTFN5M5UX9j3C2K4seM4e26KQxJRUWRQymHjWGcHB+hPxiCmbF/7y7CMIYxml3Pw2w6oTCKuCwrEAFVWbU0It9eIu7dg+f7qMqSG6vhJdfzTm/VSsp29Gba292wVbRx66qgyBgNx3HJdV1IIVGWVrwulbR/xnXhuC7CKCbTPrYsCtidxUWW2iGAHwTkeT5c17HMESYOwwhhO2bTukG6WpE2BlVRoipLKOUg6XS5NxiQILBuasSdHgkpUJeWtWzVb9JKQ4MAi9kUnW4XSafLFy9fpaa92NRVZT1ksgxbO2M888xnUdcltrd3wCBylGLX8+D7loJWVpUlukq1nnWLdJVKIST8IDACEI1u3lc1zXsBLgGcfPDDH5q+5/t/iH7hfb/M3zSyzG7SVcY0X3Ycda0syzdobZqmaUSe5zSZnJDjuuQ4DlzPpXS1QpamqJsaeTto18YKuYMgICKidLUiEgTdWG8X0d5ChRDo9wfQxpDnuvBagXm304VSClEcWwZ163Bqb6YGxtj8Ntf14AeBFTTFMXzPg5CKwjC0u6XnwfN9+EEIx3UQxYndCaVEGMUIw6jd9SwEs75VO61EUgiJIIio1x/wxvYOdXs9hFEEqQRJQXAcItfzoBwFQQKO51KRZ/CDAK7rcxCG5HnWBiSKYsuyiSJaa0nWftbMDCsTTejevT3M5zNMpxOcTE6oLEuq65qkVKcOEVprjpJEwPDScZwXTdMcGK1rEAoAQknVIaJp0zTP7B8cVF8LEdLXdAd88ZWXlq+9/oBm5q8YY+q6quRyabUIYRTB9wMwG2rqBmEUYzo5aT80ga7nIcvyU5uztTSyKqvTeAUhJMIwgjaalssFu64DJSMwG3Q6XSv6iRMEvh0tVS01XQjr0UwgeL4H1/MRhiF8z/rCgIE4jk/NKYWUaBqNIIx4MBxDKknLxbzdDS0HT0qFsp1c+H4AqRwSQtrLh/19e3N3BCuHIAgkJKGl5IEbkNHMShFcjxjcQbZK4QUBlOOgqWtsCAGj9TpGFo3WSLo9bGxto7CmmzDM/ODDryXXcXBweIDJ5ASDVgL69NNPodPpQAjBsm/Nl/bv3cVwMBLG6F9mNnuO697o94dPpatFlKZp9ZnPPbOPr+P6LSekVnWzqU39b8MofNdkOv0BY0wthJDKcaync5YRQKc2a6vVkjzXs1ELsE6kVVWhqS3HbzabQtl4BWqahouyQFPXEEKQlMGpq0AYBhBSwg8Ci8dJBdg20Yp7yD/FFe3xZI85IQTquiatbfZbEEaIk47ViyQdEkJyWRaIky4Aguf7EEKwbhr4QUjGGFDL7C7ynKSUcD2PlXIQxoKW84pdz4UUBFcSamGxDCmZm4bABjCGEcUCnhejKBhNXbNu6vVli9ZGRdxe0oSQEEpBOg4kiFzPR384Rtzp4rVhiDiK8NzzX0HTNOx5LpWlnUcHYSR8P9BElLiu1zGu99998qlPnbQf3cl/mESPr5Nh0G8pCVUqVQeB35VSfjkKo7L1YuFua5ojhWRrCN6w53lWxthahTmOQlM3ECRgmO1s1O4CqMoSvu9T3YqCtNbtZcQgSSyex8zwPQ9+ENqj14qebH/ouvB8n5XjsFKOdbKXkgjWKJxhG3kplb0pRwmaRmNioxK4LCsEUdy63DPVdY2yKi1tDIAQkh3XgxcErT+fwfHhggGi1aKhojBYphpVyagbBhuQ0SBjGHmqrfZdAE1dIUttXpxyHEtfa4Ox66rGarXCdDrBYrkg1wuIhMDLL7+ExWqJw6NDzBcL1PZ94TiOLDQDRpx0oLXGop1IAfj1T3/6qZPH3/DYb/Lavs7F97XYAflLzz13B8DdR17zmrc7ruM4jkOu55n2g0NRFoiiiKWQWK6WHIYhgjBCWRQEBiaTEwaAzc1N1E2Dpq4pCEOArXaEjSEQIY5jOC01vdNOI8IwbLXDaGEVAakkmjZtsjn163NaNo59y9ek0V5/hKqurJ2GENDa8Goxt493Xdb2+aCuSoqShFSLEfp+QK7n2x1VthSqIkddVtCNthriwl5o/CBggEg5AkoRVsuCqrJAWXpgY8gYzUZrim12sJWn+j729u5g7+5dHB0e4MYrL2N//57VArf2bK7rIvAD3L51E3t376DX60JKiVWaYryx1XL+HNPt9qTW+kRKuXzbu96qnvzQR2t8A5f6WrGhtTH/FIzPOEr9967nX18sF3XTNEIKafUWdQ0pBMbjDSsNlAJpmmI0HtNgOMLJ8THK0kIVUggGUasB8aG1zd31A3uMSqlacDeA63po6hpeEEA3zSm+V1Ulry8PNubAaWlhHjw/wGq5xP69e5hOJzg6OgIzI4xjDIdjYjDqqkZdV7xczKAbzWEUUUttsjfnIMTOmbMYDIbs+z46raUaCUJmUzRBRMxsoBsNYzRcz7fB2dJCS1o3NuLLEljRNA20YRyfHOOZp5/Cs89+AXt7dzGbTeH7AcrSkibG4zGY2caUtd5/89mM5vMFJ50OFXmOwrqhUhhFuiqKjhTiDdXdk4+uP6/fTgVoAIhnv/Slm9/17u8oDo4Oab5cWkZKVQJgezwqCc+3ZoqCBMIwQBTFYGbO0pSUUohafUVVVajK0nrkwfZMnucDzOw4LlkbC8+aM1q9rt397FHIUikAfKqKg6VnwlEuwjjBYrHAwf49KMdBmqZYWaknHxzsY//eHlzbq6KuK2JjWDkOzaYT69lSV2inHuh0uxgOhuj3B9g9cw5xkmB7e4dd1xoP+Z5HzAYkJMqywKqlUMWdLhhYp3pyXdd8dHRI89kcs/mU79y+Rc9+4fOnoiZtrMh+zd6u6hq9bg+u58L3AqTpEovFHAzQYj4HkcCZs+cwm01Nulo5YP7k2ctX/t6/+tQnzdeKZPCNVsUxALFM07EfBPkqy7BcLhEEAbmux74fIEtX1gdwOqHhcLT2WeGTk2O4rstCCPIDv3W9MjDGUBu3cAp9aGtbxuPRmFzXUp6slFNBtjtdVZbWQbQ/sMeQa4tYSgnXDzA5OeHnvvIlKssSaHejqrL0LbfVGdd1jaqqWuE4KM8yzvOcVm2aERgoq5Jd19q09Xt9jEYjBEFIVy5fxdVr1zEYDtHt2T5YOc4pIZeEQF1XAIjtv0GTk2M+2L+H5WKJmzdepudfeI5v3niFjG7gug46yRBxHGO8sYnNze3WETXEYDQ69ScErJhqOptakm1VspSSwiC8s1qtPvqvfulfrr7tiTe6H/vkU9VvtwIkAHz1yrUgiuNzeZ6fm8+mLIQQRmurgWjR/bzVs9Z1feqpstYL2wgGF46jmMHUFihZXa9AVZbsOA6SOEZdV0hXS4Sbm6c4ob0BM5RyaJ2tsebVSYvhsRCCDg/u0XRywp7vI8tyKgqrAel2utS6X8E0NULfQyeOWjmkQVM3KNc5dS3fcDqdoSoKWsynqKsSGxub2Nu700oEGhsBMRrBcHvitRl2AFBbIRXnWcZN3WA6mfCzX/yctRQG09WrVzHsD9AfDNDtdBF37DhQSAtNrS8+utE8Ho0xHm/Qxz/2JIqiwGg0QpwkqKta1XX1guOo+LUPPfwnVsvsXwKYfCMuH19zXXAc+F6RZ68py3KgHKceJ4nwPJ9nsxmklOj1+9bVoCzR7fYwHI4wnU7IcRQODw+xubmFKIpwdHhIggiRpYzb3jGSlnxZlpznOUYjhbzIIYWEao9Ztr7PUMoKbZRj6e5aa0jloCwroLQeL1cfuA7AMrFdy7SGbjR834PWDZra3rYdR3FVlsQAGd0AzCir6lTsUxQ56kZjtbIthzG20ObzKfwjH8q1facgwUYbeL5PTWM9ZJq64TyzgPzh4T4mJ0dQUvL21had2d3FYj5HWeQ4OTpCkedYrpaYTaeIogh+ELK9DPnkeT6BBJqm5m63i6OjQxJScp5lQgr5iuu6h8aYQaObzbzI8t+ORzADENEwWWazzGij2fM8JhLI8xxlYXufbrdLjuMizzMEQYjp5ARx0sHR0SH7vo/eVxmK+16Epj0SF/M52pgCeJ5H8/kcZ8/yqcBct9pfoRSonS8bw6irEtLKIG1qpqNoPpuDmdHvD60NsOuAQOgPBgCI11kbFgjXyHPL1k6XCxR5bm12y5Jta2EVaN0kQb/XAxtGrRsYbVAUBbI84zzLsFwsIEggThLEHZuWWWQZ5tNJG9k1oflsCiUVOkmCl158gff29kgqhaTTxWC0gfnBIc9nU8rTFeIows7OLs6cPUdnzp5Dp9eHsi0KSaXY8zzWjcZgY8MEvq+KLHu40XqRBL0//7kPfzBfm0j9tuoBr2zv0pMf+mjzhsdf/7E0twHSy6XNQhuOhjDaZnuwMZBCYLGYQWuN1WrJTWODAZmBzGZpwFEKgW9tdj3fP00q91oaVVGWiOPEXlLIkjyVdOG6zin93XL6BBMJlEVBQRQh6XTWzBLyXBdhHJ0e3WWRo6kr1FWF2fQE+/v7OD4+4mwdarhcWEmj1nAcxb7v48yZMzToDxEENi4i8H17C5eSCUBjU9EpimMkna6Vi/p2nhzWMdIsxWq5QFnkuHXzFbz88otwXQ+7Z89BSHvZ2Nu7g+ViARtJFmC2mOPo6BBNU7OUkpgZnf5gPY2hqir5zJmz6PX6zMacrcqSuWn+woc+/MGbAL6hxfc1K8AX7901AGhjY+PZxXJ+w/O8i1qbuqoqwczwAyuisQxe0w7XS1at60AYRtYiwjAnSQLXdUgbhuv9pg9KbdkfSOKECYDjuhBS2CRMw21ur7HG4XXNzO1guL2olEVhlWTtsdtav9kgxDJHked0cnKCl196AScnJyiqylK6hERVV1guFiiLwhocrVLM5gssFgs+c+YMbYw30DQ9+H6AtYVuVRaoqqKdsCTo9rvwPILvEowJrLtrU2Nv7y5/8fPP0GQ6xc7uGQipaJVleOmF5/Dyyy/hnd/5fbhz5zaKdAXPdZDnBTtJjKOjQ4zGVt0XhJEVH2kNYxhN04g8TSfL5eI98+nJv37+5VfWbqff0OL7WkxCTo/hK9u74lf/7a/NpRB/1VFOs7a50NpgvLFJvucjShIIKddRCKirEo1u2pgCgTRLrSeL5/NwOEISJ+j2+hCtmU4URdjc2qLBYEhBEEIph3TdEAmyO6eVTbJyLB3LOtwTdXo9a1NmrEuDnT6ssJzPsVzMMJ1M8MxnP4MPf/jf43gyAaREXhTww4jyoqBbt27B9QM88NAjNDk5afUbCTGD7ty5g7t37+LgYB8nk2OkWWaLva4hWhYyG4YgIHIJLhGSWCAIQjo5PqaXXniBwijBQw+9Bk2jASHx+BvejK3tHUhpzSmJBDmui+FwhCgMoBwXi+USi8WCydL17UWMcCpLLfLMVVL9xvMvv7J6+NwF5xt16fh6FeDpLvg73vX2/9Fz3dsAO1JKs7m5hcV8DobVJGitLZdOCGolkCyVQt6qs1zXQ1WWlOc2cyNNU8Rx0poX+djc2kYUJxBkrSxIWN4eEVgQMQEQ7ZDJ4oMSdVWh9adBnqVIV0uslguslgsc7O/h4x/7CN+6fROD4Qh5USAvSrz+iW/Dm9/6Liil2HNdpGmGNEvXhkDo93uW0BCEOJlM+N7+Ps9mM2R5DiEVkRBEZL8YSbfLg0SyImICwWsjXrMsxbXrD2M8GuNg/x7OX7yMb3vbO3Hu/AWEUYztrS0c7d2C7yoMx2P0BkNEQQhBwM7uWRqNxzQcDhHFMeKWG5lmKYNBDByGcZwCoGdv3WjwKllf67BCfvKzX7iilPpMnudnk6QjbFYZswVIiVoHACqKAnlhNQsEYt00SJLEWnAw4+jwwPr6CYGysLpezwusVqP1w7Np5VaXoZuGXM8SB0AEIYiKPG8llWyjEFoTTABMQlCWpXjl5Zfhej5iIfmVV17GaLxJj7/hCVy5dh0MYDQaI/RcTOcLHB/cw2DQh+sF1NQaR0dH6Pf76Ha7qKoSWZZB6wZMBMf14LdhNwKAJAGAYdpYdmOYk6SDbn+E556taDTeRpJ0OIwi6g6GeOCh12AxO4GrFOdFQd3+CE888VY83+vjzu2bSKKYx+MNOI5DNgIiQLfXQ5auzLDfR5Fnn/r4Jz8x/0ZCLl93dywA6CRJoHXztHKcHyvLMkjTlanrRtjxVoU4DGk0GMJ1HdR1zQBT3TQUBAEJISClYBKCtMW4UNVVS1Yw6HRbfYYfQEqBJE5aAJpO32UhBEklyaYK2SmJ61lflLWRJQlCmqY0OTlZJxohzwucv3ARV69co43NLXiej/F4A0EU096dW4jjCN1OBwDRA9cfxnw+tdEOVYXA93Hm7DkMhiMKghAbm1sYDCx4nCQdhFGMpGOLsYUNKCsY8+kEL7/4HAhEnudznqVUlxVYa2xt76LfH2Fj+wz6gyGdP38BR4cHIAK96Ym3YGt7h3RTW0/CNt39xisv83Nf+bJQUtWDXv+P37pzZ++rcvp+2++A/Kar1wUM7pae+2hVVVFVVXUcRWK1WkFKRRfPn8f21hZvbGzh8OiQHOd51FUFCEK6WkFaYTnFbdSVklaOCQCJG6+T07FmL89mU3Q6HURRBJBosV5au3HZnk/8Jm1eSgXXta4p1iEhgR9GeHznLJVFgSCMoFtfZdM0yNMUly9dQZXnRMLmsuVZCgEgCkOc2T27loNSt9tHp9NFnMQYDkfrLDeCZVlzWhp0PMvC0QwEIVGcdLB79jyausZyuSRjbEackpKhG9rZ3oHWDeXZEGWRo9/rIUk6CHyftnd3uKkb668YhhCCKIpillIqpdTNqxeufu7JT3wcXw+S6avmCL5zciz2JsfNax586Hq305VZntdZlgmpJF7z4MN47NHH0DQ1ree8165exfHxsZ2CtEwXKSWiKLIxCKsV+oM+8ryAaWGapvViJrJ5bUnSaaMLcoRhZHs9rSGFtLYYLSTD7f5TNzWCIECn24PrBfCDgP02ECdLUwRhjDyzho57d+9gtVzg0qVLViTemoovFzNce+C6pZXVDfIis3JOYz2ae70e4qQD0XoULuYzjMtNwANKBsrCwGjgzLnzuHvnFlbLJWaTk1OFHi8NydbpIIkibGyMT/UjbDTYMKtWbEVk8+yKokB/MGgVfuSmZRoAqPEqW1/LAqS9ybF+3aOPbZEQD+mm/sdxFP3obLFgz3HxxBNvhq4revGFlzCfzdiwwWi0Add1OAh8Go9HYNi4Ua01ut0+6rrh+XwOPwhoPpsijmMcHR6grkpcuHAJ3c7AgsnWgYGbpiY2Zo3FwfVc219qvW4PECUdRFGMteOW1oaqlp/oKsuk2dg4b3NMul2sPaHLskDd0qWQ2N04STooigJ1Y43WwyDAcDhEFEUIw+BUH1KonNJlimGnCwVCYcB1zeT7Pvr9IaqqRtzpYLVctnKFoo1YzaGbCtlqYefJngfXdTEcb1CUJMzG4FQ1KCVHUcQtUePuX/9bfyP957/8r15V/d/X5RIipIyIxN9dZfNjgL7XaD16/PHXmySJ6alPfNQyiz0PvcEArufTOr0oThK7y3VT64LaShOLokDU6jEODw+4LAokndeSHZvpUxYMK4eEECBh563hmj8IgpCC2TC5vgfXcaEc1bqhWjeBpiqwmE+RtfEOB/futB7Mxhr/rMNrigLKcZF0e4iTXuuMGqDb68N1FIIgsFFRbCcpALipa6rrGvfu3kZvkKAfSkhpoCTQaAObmJkgjDvoD0bWfCiOoZumTWZn6KaxUAsRVCvtNFrDcRz4QYgiz7BczKnb6ZrdnV3ouv6lixcv6p3BSO1NjptvlQJkAPj0Z55+CcDLb3z963dWy9Uznud+94XzF/RiNqXVYoE46SIIAmxt7dJgNMJsOsHk5Aibm5twvQD9Xg+u6/KtW7fhui46nQ6Oj49PDRdbl3zOspx8z4doez8hhGVMawMn9KBkOyeWimxO2lfdmOsaSiro1lnL833snj0PYwz27tzGwd4dZCs7ySFBEFIhCCNsbJ9Btz9AbzC0GGaj25GgB0GEpiqhm6bNd7OUZ6kkN43Gcj6nmy/d4t5rLyLwbI/apDhV+LlKWocF12PHcQEiGm1s2PAbixxwXZUIwpCsvYcmrZuW6qagjeEojp0ojPIXnvvyPweAvcmx+VY6gv9X66mnn7774NWr/wMbfutgOApmR/vGdT3q9voYjjdw5do1VsqlKIpRVTVu3byJc+cvQCqF0WgDs+kMZVWuHT7RCrapqRu+desmjUYb2N7ePjUOV0qhaXUVnu9BOS6UTZVsHa2IjdFkRd9Om8mmWAhJ3f7wFBQPggCXrly1GKJUKHJLFLXez9HaYYvdlusnW33I0cEesrJsxexuy+a2Oua6roiVwnIxx6LU6LgSjaOZQ0lBGKGuahR5hsFwzGHSsfoWIvaDkCyMBW51MfD8AHVZQLgesnSFIi8gBEFJZQLfd86cOfvJD374gzc/8u8+Lt7+nW/51i1AADh7bvdXqpfqO71e/4FsNtG+H9BotEHD0ZjjuAPX8znudEkph1uMjBpr24vt7W0oR+Hu3bsUWyF6mwEi7QUDOM37JbJpk2u4Zf1h2ZEbMRsGEdtwxNCaRjquaycppmEhAM/3KZTytGUSglBXGp7rcmMvIOS4FoRmZgoCBSJuafYNdF2D28datoyEE7jEli5ufbEdB/NJjs52TIoI0gN6/QF7raAfAJSUCMKg/UkMIuKmrhHHlqyraw0nTuzFyhgQ0IL7kn0/wFvf/o73/o//5B/zczeela+G0ds3qgD5p3/2p8Rf+5m/3jzymoc/FMfxA91en/uDEfrDIUslIaVsvfMM7567gN1z5+mjH/4ADBtmw+R5Hnq9PjbGY9y5e4fzokAUJ1BS2KwPsHUfsGcd1m6qxhiURQHY3GBueYEklQMhCEEYtzFaGsrx4QpJnrWmARu0PDu2Lq6eghckFATEDECA0BiG0YBSBF8IVBYEtwB5K91cfykc10Vd11gztH/T4wVQZJ2Ko9hBFMe0XC5RVxXrpkHc8UAEGM2sNZC3rHLlAEpJNDXgugJg68C/XMxOfQu3t3cFAHjeAK/GJb5ef9FXnn2OAHAUxb+UZ5kJwlAkSQdhGFtNiOOezmXrqqBnPv0JfOzJD/Pk5ATdbu80ZPry5cuIwpA81yOA0e/3sTHeQBzFrI3VWrBha/XRMlCMMczMrBtrD1dbYRGaukGR5+1tVrSRrABbfy54HsF1ANclSAFErkAnpPVmZHc4w4hdQigFJAkYxikuuQ7OWZNOtW5g5ZYWXlpnEZ/+OACxL+y82xIuqKoKqgpDRKDAF/B8QuC7cF2ANQgGcF0wGKwUMZH9R0jZWqPoxwDgbW97nL+lC3BnReY93/9DdLC396miyF/odHpyMByabq9vhUdSUpHnNJ9N6cXnvoTPf/ZpaG1o/94erS1loyjC+fOXcPHCJQ4CnwlAURQ0GI4w3txsgetm7QBlCQdtv1QWpYU1sgxaa66riquqZALz2uHAmqUD1ikYYBAECNLuTjDM0AzSDaOpub1YgAvNyLSGZgOt2XpLa4sTOo6lWzV1jTzL2/AbudauEDOTaU3JNQOCBDa2dti6m9oLa7paoa4YpsXV/VCQ7wmKIwGprNOCcghC2sJWjktSSmrsUXwFAC5cuGC+pQvwF973y/zYD32/fPn27ZkU8u93en3q9gfG2nW49pNkO54zhuH5AcIgQBiEfHJ8jChO0BsMMRwOsXvmLGwq0QD9Xh+dTgfdbo883z/dbYwx0MagrkpooyHbiK6iyNG0EgBdN6ez4bqqsJjOoRxi5QC+IrgtWO2A4EsBRXaOSwR4LrGyTxla2yMxrQ3yjCGV4nVUQ93UMO3s2e6AGsxMfhDQYDTGxlYMZQFykkQkQEi6Av3hiElIiytWFa/mK5SFgRR2N16rv1rpsPUhbJiIiHw/gFIO2dTNYOcf/uI/8YmI3/P9P0TfsgUIAM/88vv0e77/h2jv7p2/v1gu7g5HY8cYbZTjEhtj6e9N3WbtCoRhyOONLTiux67r4czZ8+j0ejhz9izFcUyOUrS9vYOgTVsv8hyL+Rxaa9t3tYVotEFVlWtdcbtzWUllnqXIsxRSOegOunaGzXbnE0RwSMD6Z7VNMxE8KUj+r8XcWMwaVMXaQkRAOYq10UgXS2SrlSXRVtWpEdK6F2zrx86umSGIEEuF8eYYcRxjOZ/DGE1CKrABmoYhAaiW1OAIQEqCkIDnEbueVQcK0Sa9SzlIks4AAH7+X/8SvqUL8Bfe98v8xPf+TvE3/s7fmM1ns5/x/EAo5fA6aK8qS6wWCyzmM0ipsLG1g0tXr2Frewc7Z87ycDSGH4QI/ABXrz1watzjuC7VdQkiq6ctivwULKb1hYQNkXXgpyyzmJ5qj0djDNd1hbJoUBWMumI09hZ+epOVZJ3fGmZIG/R0+rq0ZijH9n91XfJiNqWT42PMJ1MIa4lh/WOkPJ1DOJajaL8k/JsMnTVz1nGIpJQAEZbLhZVxLjIUmYEBoMFQ7XPQ1mmhnXezNT0SElIqo6QMhJQdAHjyA5/41t4BAeAP/sk/qv/yT/+s/HN/4c/+w/17ex/q9fqO0VoLoVrsrgEbIAgj7Jw5R5tbO+h0unAch5RyEAQ2N+TK5as4f/6CzYhLOqy1RtPo9kO1W1bTNGi0JjaG2NhCM8awPp1m1GTjIKhlQhfQGnBc+3j+TUTdwicANADDgAazZuayYF7Oc0yPJ0iXKyxmE8rzDFm6Ii8I0Ov1Md7cxMb2jp2QeDZnWLYhNAaAZsaqZhiAGzZsmOF5NmvYD0LkeY7Z5Bh5nnGaprxaGdSaUbVfD2vpwUREkLYvYM/z4LguE5HUTePhVbrUN/Dv5puvvPgXBqPxJ5JOj5qmQa8/RJwkAAkEUYRub2AdRFt1mW6a03Qk37f0KIv9mTWx1VLujYZgycZo6KYm7ThcVdV6fkpCSJRlCRKCtdbwPJ/shSGEMQytmQMl6PRSAoYAkQFDa4aQYM2MsmAQQPPpCfZu38Tu+Yu8XCxoOp2iKiv0+v21NgNK0SkMYwkYBfIsxZ0967alHILRgO8LeADKktsd0wZJl2UJns8QNnELNSVw2yBOC3ATjGFiZm6aBu28WxMJRzfNEABOeHl/BwSAv/LXfka/9/2/Lv/vf/tvPDWbTv7l5vaOWsxnzWhjC+ONLfQHQ+ycOYfBcITzl67avIu6tp92G7swHI3RXVPrmdvbpmkBPFiyQN0AIFRlSVVVnvZrzKbV9ta0zq8DmzV1i7UGKmaumVGDURlGYUFeJgLnhUHTAEaDsixHGCXYOX8R08kJnRwf4eToCFVpiQdVm9vR5vhCa81rl6vVco4sXWG1WiJLc2RpQ1qDCjZYLSsYrXntuF8WJc+mJ1guZjSbnOBo/xBFYVCVpt3tGU0NFEVFTdOQsa8PRDgN/bm/A37V+uwHPwEAODzc/9vjza3fqxxXTk6Ocf7SFegXnkNZWto8M2Nz5wxuvvwC9u7cws6ZczZQ2nFswpFNDIejHLAxaNCspZdkrFc0R1FM65RN1/UAKRkAaWMfS8itsWTrihBGMQuhCACamuF61Nqv2WJdTBfsuB60aZCtVlgsZphOTlAUBap2jEatBZ0xzMYwvCBAWRZUlQVVVYWmabBYzNHt9dpkzkHrOSjbwrNz7uVygbqqoFoP6DxLkXR66BjDOATCKIaU1lD9dP7d4pDGGFEUBeu6mQLAkBK+X4BftQsyMxHRUz//3/3dp69df+gNz37+s82b3/ZO+fgT34a92zcxnUxw9+bLlHR7ePixN/LdW6/AsEHS6WI+a1PA3RxVVdkidFroo7K5I8p1Ti80cRy3/nq5nQs7Ni9YNxocMJzC5hQLQe3x1aWqLCGlALN/2uRXZQXpuJjPJsiyFMZonBwfYTY5gTHtGEwpvvHyS9C6Rpx0kKVLCGkNkqaTKRljmTF1XVvz8X6ftnZ20esNmA2DAQqjEPv39vClL34e3W4X5y9eAhFhOVmsKWHU7qin/trrHJDWd7tNO69yrfUUAJ784ufv74BfvX76T/0FCaDZ37vzNy9fvfZPe/0hPvTrv4qHHnkMcacDz/ewc+YsstUKzz/7OWISqOoSZ86es1QkJdvkIOtCsN4FRNscMTO6vR6tyQdEhEY3FjQDWBsb7tfGW3FY1wjjGEZrOj7ch+t5iKIERV6iKguQECiLHGWeU0sqwMwmKbFUDnzXo6axR+b2mXO48cpL8FwFPwhwdHiIm6+8jP2DA2ZmjDc2MGhDsk+Oj3D71k2cPXceUZRYHQkzXnz+ObAx2NzaRhAEMMzwwwLz6RRaa2ztnLFwjhSIO100TQPDBulqBQKhLAvKstXy8Gh/BgB/8U+/k//Sn3l1FeA3vCltWRri7/ytn3/y7e/+ric++dHfqO7ceElGSUKjzW28+a3vxGA8wCvPv4AvP/sFpGmKaw89hPl0iqPDA6xWy3WeG5zWci0MQ2s4WTfWBT4I4LgeMxsEvnVVdX2f2Jg2m0SwFUMBQRhSFMUQ0lq4SWEjXYvCCtIFCS6KnOq6wmq5wHRyDCJbAI7T3gqERBx3+MbLL+H9v/r/xXR6grUqDsx8atvB1s63PxhSrz+A6zptKLaDyWSC3TNn8a7v+G7keXrKjs6yFLdeeRl1VWFjaxu9/gCu7yPwQ5AgFHnOWZpCOY4pi9xZpennfvRHf9/jRMSvNkHS11qU9L9rnTtzXnz4Ix/Uu9vbzxLw49/2jnebuNOjqqyIGYjiCE1dI+n2cOWBBxFFEe7cvAEhpfXdaxPY66a2sQ1iHXtgtSBKKRi25udNbV1Oc5sdTGv6uj3GiAAQM7M2mgBrMmnY2JCYLINhgyxdUVUWWC7mODrcZwZoMNpAHCUspULc6ZLrepxnGfWHI3L9EJOTY8wXMxRFDgagXBdJt0dRFMP1PArDEFFkUy21sfZtYdzBtQcfhmEDR9mR3jrAUbVZdVo37YRnTZat0TQaUkrkWWq0NlJr/dQjjzz8PzMfib/yV37uVdcDfsML8MMf+SD/5Z/+Wfm3f/5v3drd2kIcxd958crV+uLVazLLM9RNjeFojIO7dzhdLbGYz+jGyy9at1Ol2IZca8vFkxJC2KTNNgTb5o4UxamBkO97AGxmrm6swRDApLWBbmo0uiHdNNBNw3VVochzyjO7Ay3mM+R5hjzLMJ2eoK4qGm1uYzja4CAMKQgjklJBSEXSccEg9EcjSro9CKkghIIBrPjeaDLMJJVN+1wslojiGNtnzmM0GmP37Hk4jnuq0luHJ/pBiKTThdaM+Xx6Kryq69oKpKQk3dQoisIIIVVRFr/03vf+qw+cPfuA/JVf+RVzvwf8j19IzF/+6Z+Vf+Wv/czPSilf57jO7z5/6WrVHwxVulqgqSp0en3MZxOURYHN7R2cHB2BwQSAlZJr7xfrhgXAdZxTKKQ1MicpJed5bnfFtVs9GxijUXMFaun8sCIoqsqS1yM9qRRc3wMJiePje9DaYPf8BQyHY0ilyA8iMIAsTVtYREM6ClI3GAzHdP7SFYw3t3BydMCHB/vWrSBLTzNIRqMRLl15AOONTRhe8w8ruG1uXJqm8IMQdd3AcR1s7+6iqgoui5xOkwUaewNvmobKsqIwFFBKfQ6v4qVeJc+DTz73WdP2g7/fD4JfNsZ8r3K9Sje1SldLdHp9bO2exWA4hjYa+3t38fILzyHLM/rqmyDay4kx5tQfmgRBOYrX5FSAsZjNkXQ60Noq6qQUECyhHMV5llFdVZbU6rqc9HpkPfgId27dRFXXOH/pKrrdHkzrvrVaLa1OpCwhlQPHdVEVBYo8B4zGYDBAr9eF73nkudb4cjGfIYoi7Jw5x2EYwnVtiE7rmX1KrCAhoBwX8/kcQRBAVqoNqk6wmM8QJ0AUhWumz3qkJxutjR+EzwPAAxceflWyYV5VyPhXWYUNft8P/Z6Pf9f3/cC18XijHgxHMk4SOI7DLdOFQMBzX/oiXnnpRWgLa0C0YK/ne6e2H8YYCClhLE2fqW32nv/yl3Dlges2+byu1sc1CyHWwYhQjkIUxegPR6SUwsH+PRzu38Olaw/Zea5r7eX6g5EtuLJl3kjVzn4tzp+nGS+XcyryDOlqZXepuoaUEsPxBlw/AGvTBnQnNjkeBM+z/oRFnlu31vncuqm29DDHcbB/5xZ6/T42trZ5MZuSjcQ1DIJkpv2o03ngB3/gexbMXyGi6/dxwP+t9akXvmKubO/KF+/dnfzqr73v95KUH/yhH/6RQZalGmDhByFJKS2fnpkGwzH27+1Z6abRgIDN3zX2GJZKAa1+w050ceoPeP7SZbiudwrf6KaxUkzPoyLPuNUkUxjFHEYxl2WB6ckJnblwCcpxsFwu0OgGddNgNp3YEEKtrWUcgLoq4He6cF0PSkrq9XvW3JItQ5sI6A9G6PYGtnjbMO0w9LCYL61TV1OzbvRp1lvS6WCxmKOuKtR1daqYa8MSyXFdNFpDAMbzfFkUxUs/+APfs3jP9//Qq7L4XnUFCAAv3rur2/iALzz91Cd//2Aw/NV3vPPbqa46XFcVAZaEt1otcPvmy1gsFiDYJhwOrBqtaaw9mTHc6n2tcRER6cZibK7noY3H4jCKkK5W1DQ1QOA1adQPAqxjs44O7rEfhojipNUElyjyzCYYEaCkgOc68H0PrutZ3+Y27ivwfdR1TUraLDtXOVBtZm9Z2J40CHycHB7j5osvYDGfsdYNtDZoajsR8gIfnh/YyNVWm6yUglEO1jxI20pIgAQnnS7Kqv4CADzx+/+g/IX3/XJzvwD/d64nP/TRpi3Cf+d+8N/9RLpc/IPHX//GajQcCwZTlq5wdHiApz/9STYMvPEtb7WyRCHg+D4TiFpOIJEg5vYYXvPfiQi6ZRubdgastYbreeT7ARbzGTvSgef7rHVjJxcksLm9i6oosL93B9oY7tjwHQK36ZyuTb3UWmO1WODOzRsw2s5km6oCrBcT1mq8uizbWK4GUZwALZ2MLJfvNBVqPe8OohB+ECAvcvZcl6LtHTRVcWpnZ2coBCHQ2gPzJ/EqX+rV+sS+qgj/oe97D7zwwnM/5Qdh6bquZGPIUZIXS2t3u1osrI+LblBXNfnBb+4Sro1zaBMrFZTjoK6qUwzN5tI1p6J1EgKO45KUzikEsk7BJDDKMscrL70AISSFcci61qe/n2cZiAh5mlr2ShuOaB28LB655v2vXf2FENYPBza6wnFcZFl6KkKvW22zhWKsw77juTh//gJv7eyQVDZdk35TOM+e58vZdKJXq9XTAHBhe9vcL8D/tCLUP/wjPyh/6Z+99y++8bHHotu3b77nxu07xlFKv/F1rxOu6xEz82w2pTCK13EO7XFMEFJaAg1R6wdo2khU1YbFGNZCQEpF64G+ZZBYLJHb/Ky6rpEkCc1nM54cHwEg2rt7m4+Pj8hqQEoYrbnb61oavB8g6XagpELW+hnG3Q6W8znppsH2mTNgsr3n/t19DMdjHm1ukRAC927fwsXrD2Lv1k06f/kKHx7s4+f/9t+0rBpjcObMLn7kR/8QxXHMVVmi2+uj2+9jOZ9bqzmGEUROVdfP3X7pxnMA8PbvfAvfL8D/RHjml/7Zew0A8dQzz/zJd73tbV8iIf7bg8OjTpZnTd/rUxhGNnmpqU+P1PVgno3dOdqgGDbM5CiXjbaNvTaaHNdjIQQLQdQUpU2/DAKGnZqRMRpFlmFze8f6S1cl/DBiIsKv/tqvIisKdDsd7iYJts+eYaMNdbodXL56DUJK7N2+hfHGJkZbO5hPTyCEwOvf8jYYY9Dp9vH5T38CDzz8KK49dA0kCV/8zBfx2Jtei/29OXzPw97dO/h//sJ/j1gqbG5t4x3v/nZcvHwFbDT5vr+2IEZVV1YOIIURUjIb8+Rf+Ws/U73yyivy4sWL+n4B/udZfPCbrl4XH3ryyb/7ptc9/rGyLN+rjTnneZ7pdLuUdKwp0JoXKKTEum9bq9Lapp2VcrBczi1buKkJhBb2sFqNdaNojNWlcAtWSaXQHwzX7Bd6/A1P4C+Mt/j9//bX6ItffAZVq7xTjoMo6eLcxasIohhbu+fgOC52z18EG8MExvXXPkhKEVxF2NrexaCvyGmpmW97y6MQJCB3u2gag1deqXDt8jU8/ODDOHv+Ah59wxuwWs1tTwk+DeWuqxqNbuBKj6qqIsP4twDwgQ98gHC/B/wtg2jcT33ms5+7cvHCH1RSflAph3r9ITqdro2AKMs2jssBDMP13LVJJagNsDHGwA/CFjLxea0Mr+vqVBKgm8ZGuMY20y7PM5R5TvYCbgkEnufzlWvfjW//ru/DJz76G/TFzz/DZVlgb+8ObmiNP/DjfwKdXh//8y/+fXzX7/hdeNPrrmFVM2Wp5lEobb8JIBi0z5GsEOqZ5/eQdLq4+cqL2NzcosO9PTz+2kdx9vxFDDbG3B8MSUhCXZXWWKmNC5vPZyAhmNk4WVpM66b6MAD80T/6Nv3H/tj9Avytgmiq9mLy5BOvf/2vRHHyw/1+vw6CQHquhzRNrX2v60JJD3VVY22BIUmQ1poJBNM0rUxSn/pF+76/NjWiRjTtrlKiqSqwsSyaMIrIUsAU9wdDuK6HPM/wbW9/F7/1Hd9ON158Aff27mKxmOPFZ5/F5z/3Wfwv7/0X+PIXP48zZ88jS1NcuHSZ/vBP/CTyvITve3jm6adx/eGHYTUchPf+s/8JB/f2cPfObVy+dAWPP/p6nDl7Acp10O31ba/a4o3r4MX5ZMa60eR6SruOJ9M0e/KP/ZE/dPiRf/dxQXTd3N8BfwvXxuaYAdBgOPqbruv+LsdxBQD4QYD6sEIcx615kDw1CrI7XG0dSolPCw0AO66zDrDhlg3TJm42SNMUURQjzzJM2nR3PwiBln2iHEWhsBhiXdU4c+EiLly5hsFohHu3b2Nzaxc/8Lt/Lz739FP4wjOfxmI5xxc+O8Gf+WMftwkBQsIYzVvbuzQYjrB74RLe8s7vwGc/9XHsbmyh3+2jqSts7OwgTZfwwwBSSYzGG8jzzLpAAMiyDFJJ6+dgc5J/CQCeu/GseDX6wXxTF2B7KeHDe3c/u3vm7B3HdS8QoVFKCinkaYANM0Nb27K1ETkIgBcEME0D1c5YrftAc5q8/pvMYljoRio4jr1B1xbLg6McZKsVAOKk00EQBAQA6WoO3w95f+8udfsDDMYb6A86eOi11/Fd+9+P2zdvYP/eXcymx+gOR8jSlXX4l9bX2lEODm/cwEanD39jG1HSaR1Vp3A8F1Ecnco37fN1bDxYXcNxXAaRM5/PF1mW/ttvhuP3m7IAAfB/8/9r79xjLqvOMv68a6299u2c833zzQzUGcDgpeUSU4FYwDTRpLHGoBEI0wHEQswQoJQONTYUQsGZAAVqZWwxceKgpjUK0XKZltQCtiq1WExMDCUd03IpDDDf/XLOvq7L6x9rn1NsqklNm/AN50nm3znJ3u+31l7vet7fc+CguPnGa6pz3/srzyVJ/NNgeCWViOM4sKWlRK+vICgE2oTQwQToCPtRR9WXShF1Nx9CyHGSOJRSiCIdVk4bbPN1VaGqKqRZBhNsWxhurIG9RxTHLIQg7x3m518jZyyOKQ3bGrDz2HHyyThxx0k48xfPwhm/8G5eW1kGAzRaX2fPHkmaMTNj8dgbNPNTPZy4Yyess3j91VcwWl5CVRTob5kJg8lj2GV3fVgWBYhASilLRKrw7u+uvXbPG48++YQkOs1h2oj+8evbzz4jAPg8731Nqui3GOhSkjSGIdeXnXMggKy1QMdcSdKuYduZWDuPIAnBqKsSzGFE0nQtHR3HnbuE0TQ1O2ep47yQ9x4E4rZtAgdGa447tvSwXUe5voq6LNHrD/DqSy/glRe+i9m5OY7jBLNbt9GWbdswM7eVrLVIU81SEU591ykAgJXFAq+8+F2sLS8FWuzsAIPZ2dCYNgbOBbMCd2ZZFXqWshiNfF3VDwDfH/qaFuBPQCeddqIHgEjHf18Wxb5+v9+LIu2zNKNFv4CiKJDlebeFhrAbz378HRi2VGbYNgAkx4GG4ysv7z2SJIF1lsfzxs55apoGvf4AKgpbnxCSuoxflj4A1saBiQAQp0mHztWoi4KXFo+BIGhp4RiyvI/B7Bb0w2gpCSHQH8ygLAscffklrK0soTUNBltm0Z/bEoj+cTgohTHPYGy14bccwUVNU//Tddft+bduh3DTAvwJ6a7b7hl7B1+9Y/9dT0opLgbg0zSVvbyPldVlrK+tIU2zAGz0jskRCeHGg8Hw7OGtg45FYKuEHGE2xtA4wzjSustbC+/SdNN3AFjHCZkujCZOPFlrkKQZIh0hjjVIDOC957ZpyHsHFccoRxvYWFsDGEiSFEuLxyawcaUiBCd2ACfJSGFm+zb0+oNwRdedeIUgOEHwntHUNdgHx2zTNKjr+gAAPv3MU8VmeZebsgAB4KmvPtlhofBHTdNeFEURqShClmdYXVuhYjSCUhGEFNy0DQI/mSZjjGOzpzUGUgVmi3MOgogjHYX716aG7PC9gog9c/h2FBLOGGYGOWu4qRgNmJx1SLIMBHCaJlRXNVljwu0MmHSac2wMrywt0rAYgogwGMygPzPDpjWoqiLEMfQHyHo5dJIEbkwHcg9N8zCInmQZlpYWAbCXUkXra+vPfu5PDnzxkwcOigt/7f1us7xHsVkLcN9dt7mnn3pG3PqJW55xzj2c57mK48TOzMxi0B90aUdhfsO0Bk3ToBiNJlustYHE5byD6+Di1rThG6+DGnFXoMEa5UI6elki0lEotO66LqQzSW5NGN80xpB3DlpHiJMAIGqbBqPRBgmpqD87h6w/wEZR4MWXX8KLL72Ao68fpfnFRZR1yEDpmt8gMJI4hlQS40OSjmOw96irmp1zqKsaTVPf8ex3jvjTzzyVNtN73LQFCIRBa+Yj1DTN3tFotKK1jrTWfm5uaxhGaho0TUN1VZExFtY7ruuarTU8TksKNvoazlmoSMM5S9aYgLfokpXqsgSznwRgCyGRZTl0nHCSpJP/i0hwOEXLMZkVWZYhjmP0ejmyLIN3Fk1dwViLOI6RZjmMsRRFGlu3bYeONMAeWZpiZnYGaZp0oEsdoJadobYsS1hrnJQq2thY/9e9e6//0mZb/Tb1FgwAN994ja8X9st9d9322n33ffZKIeVjgSiVcq/Xo+WlJbbGUJwkGOcHKxWFbzrGxA6l4xjWOVB3+jVVFdImXfCs+K6RHZrQ1J2YPfK8h1hrlEXRJS5lJGVI49Q67vg0BkoK6ChBmgZDab/fR9M02LZ1K5IkC8PyALIsCy0gpdDr95FmWZfsxJBSTA434z8cZqa6rr119lYAXC/Mb7oFhXAcaN89d6vbb/q4vefuT/3ezMzsA0VZ2IX5eX7t6CuiqWvoJKFw+tXI0hRRpMMQkpCT+RHq5onzvNdRWh2neZhJ1nEMJdX4yo56vQH3Z2YQxwm8dySVmmzV1BGUlIq4bRo4awMoctxjjKLQnzQGRVGgKkvMzs0FwDo80iSZ2PuJwlyI6JKelIpQjIaQUmJlZdmuLi/r5eWlJ66//ppf76YK3WZ7d+p4KMDbb/q4PXTokNqzZ89f3HvPp1WSJAdnZmfccDjrFpt5WRYFx3FCBKBgjyzlQCdVQFEUUDLcBQshMBoNobUOTMAu14M9A0qwcx7WOYxGw7Bi7ehBUQRr2hDz4FU3GJ9wMEboCY1Law0wda7lsI3ObTsBdV0hjmNIFSHWOsSFWQvnDMpiNFmhpQxkfRUpWGO5ripRVqUry3LfZn53EseJDh8+7A8dOqRu+MiH//3cc887onV8oYqUrsrKNG0tvXeT770xN2Y8MWedHYfXwBgzMTSMg2COfu9lePbU6/dR1zXlvT7FaUree9I65s5CD2sM8v4gBCz2+4giTd47aK0RJxniJEGa95DnPfT7OQazGW8/cYA4ziiOE6RZBK3lODMZcRxCdaSUE1tZVZWoq8rVdR2trq48fuPe6+/drKvfpj+E/KD27NljDx06pP5w320PNW3zPiXVCzt27oz7vb61xrBpg2mzLEusr69hbW0VZVGgLkuMRoHTN+ZLh39A27bY/o53QKlo0sgui6IDTVq0pqU0zYLFixnDjXUOW2dCWZ5jdm4rZufm0OvniHSMKJKQkmAtICTItKBIEyINxAlBqsB8jhPdFZ6eTPKF1c/AOSeGGxu2LIo7N/tnlMRxpsOHD/sPXn6VOvCZP3753Pec+2AcJ+/K8/yMqizRtq211oqxdT/QUAMty3dkASDY9wNlNKyYkY4xRurqOCF0Ma/jqzprw1CRs3ZMXIWOEwrwcIEkEV1OMSHJQjPZM6Bj0VEQQtFJAoexZYKxjLYxky2YiNA0DRtj3PraevT660e/8vsfveHep596Rlx59RV+s74vgeNQn/ubv7K337Jf3nPv3Qv79t/+21JFH92+/YS63x9oMFtnrTfGoG0bDhDIdRTFiKuqwsbGOoYbgbSPrhdYlUU4FIQtmtu2ZQBYW11BWRa8trqCxfljiJOE8l4PTV1jZXkJTWOgVMebZmA4HGH+9TW2lpFm30fvK0lwHqhqJgKxMaGtkw8CiMh2M8uj4QaGw6FYX1/jYjj8FAB6K2J339YrIN4EPWI+Qkbm4s59dz5z3nnnf1Ep9XNSqXd674V3rhWBWUahGFtq2wZt24Tt14eZ3DFlSwiJ1rTkuiQm07ZUVeOxycClCSdZpiiKUFUVnHckVRzIpR7sne+8igplYagqTJjGE0BncMFoZElpCe+ApjZo6gqj4cYY/+GYOVqYn//mjTde/4lPHjhIV//Obr+Z35PCcayOBsDdR/pzAN7/oWs/dKkQ4s62aX6mKEYh/IhZhpHOFkopds6jqirK8xxJUSBNM7S9BlnWQ9PUFFwzIUDQdAmeRTFC27bo9QdclRXVVYmyLLrbi1ke9+6klJNDjgdgusSlprJg8AQn4tw4oNqG9ksxgvOe2raF9/5+ALy9J+Vb3XD6tl0Bf3A1vGX/TeLd2Qn407/9/LfO/+Xz/9o77wH8khAi9uw9EbyQUngfBsmNaSkwnwNhK+A0CGO+MwmCtY6FkGAwyrIMwTdFAQRENYwxWJh/A3VZkRTj9ooLlNW6QaQ1NXWNqqwD1ZQCSb8YjSCkQNs0KIsRtNZYXVlia61cmD92rBhu3PDlLz/enuIkP/udI5t7kcDbTG9uWVz6gd1nEHCTseYK55yo69p77x2YhfeeAjUh4C6yLEOaZtzrhRuKNM3Iec+ia5HkeQ9xnFC/P5hYvKIonJyTOEGWZ9BRzHmvhziOO2C6howiauoa5WjYpWcS0izvcMNh1Yy0xurKipVS6NeOvvrpq/dc+Qdv9XHL6Qr4f6yGH77gIvrVC94nDz7wlwvfev75R88+6+yvMPstBDo9iiJFRCyE8N3cCHkfbP3FaISyKskYg6qqqCzKMI/MCM1pImysr5HtgnDGvUffoTrqqiLvPdV1RUIQhRhYSW23jVtnwUSw1mC4vo6qLNmYYKQwpqXV1VVTlKOrfpaitVcM4R//4Uu86T+T8DbWe37+NHHS2afRww896gDgst2XntM29cc88y5BJNpgKGi988KzF6FH6Lm71qM0zUAkOATNRON+ICspKe3udYfDIfI8x8zM7DgwGzOzs1Dd9V+e9wAwev1BAGUag9XlJTRNDaUiJiHgrDNSyWRxYeHWvXuvu3MzN56nBfhDdMv+mwQQjK4AsHvXrnOstR9xzl0kpeybrhDDzLATRCDrXDfHThxpjSiKKIo04iTp0G6K+oPB5CFba5FnwRGz7YQTEes4jItKxZGOKNIxIqVQlQVGwyGMaREnqW2aBm1T69W11YefeOjBXb+x63Lad9dt/q0GG58W4I+pEJ/6/GPoIJnYdfHFpxLRHuf8Fd67U8LNh/EEGBDJpmmEcyHylYJLhUkI0jrM7KZZBh1pJB2ZP2SISPR7feR5D4OZWTDAUgbAUJKm3LYNO+u4aWoajYbRaLiBqizvO/jnf/Yx5iP+ht+8Gfc//ggfL898WoD/SyEeef6/Jlvz5ZdeNmNMe0nbmt9l9u8VQsgQjG2sZ+/BEMFHaGGsDVHX3eFFCIGoi5BQSkFrPXZl+9ktcz5NswCXjCLhPUuicKdc1xXKsviPuqru+MKjjzzSEU5xvKx80wL8f3wjAsDuSy45yzp3qTHmQgDvVCrqco4trLUuEIQ9nLVknSUigvMe7BlEYCmkl0pJIpI60qHJLSWstV4QbWitXwLRN4rh8PCTX/vqUwDGAHd/vBXftAB/hOd08e4LxXgoHgAuu+yyuC7L8wBcwN6fB9DpzH7b2DgQbldCKLUQ1A03+Ymp1DO/ysz/4qz9JhF92xhzTEVq/p+f/vrim3+4w9O54/bBTmvrR9+eX/zPI+LBLzz2P5C3H7jkkp2mbc8EcI4Q8gxr7cme/U4iSghonfMVEb4Houdirb++Y+dJ3/jM/Z9d+WG/8cHLr1Ijt8ZvLvippppqqqmmmmqqqaaaaqqppppqqqmmmmqqqaaaaqqppppqqqmm2iz6b+k4apC5zgdNAAAAAElFTkSuQmCC"
};
var fuzeImages = {};

var fuzeAssets = (function() {
    var ready = false;
    var callbacks = [];
    var keys = Object.keys(fuzeSpriteData);
    var pending = keys.length;

    var finish = function() {
        ready = true;
        var list = callbacks;
        callbacks = [];
        for (var i=0; i<list.length; i++) {
            list[i]();
        }
    };

    var onDone = function() {
        pending--;
        if (pending == 0) {
            finish();
        }
    };

    keys.forEach(function(key) {
        var img = new Image();
        img.onload = onDone;
        img.onerror = onDone;
        img.src = fuzeSpriteData[key];
        fuzeImages[key] = img;
    });

    if (document.fonts && document.fonts.load) {
        ["ArcadeR", "PressStart"].forEach(function(family) {
            pending++;
            document.fonts.load("8px " + family, "Aé").then(onDone, onDone);
        });
    }

    if (pending == 0) {
        finish();
    }

    return {
        whenReady: function(callback) {
            if (ready) {
                callback();
            }
            else {
                callbacks.push(callback);
            }
        },
    };
})();

var FUZE_HEAD_SIZE = 19;
var AYWEN_SIZE = 18;

var getHeadingAngle = function(dirEnum) {
    if (dirEnum == DIR_UP) return -Math.PI/2;
    if (dirEnum == DIR_DOWN) return Math.PI/2;
    if (dirEnum == DIR_LEFT) return Math.PI;
    return 0;
};

var drawFuzeHead = function(ctx, size) {
    var img = fuzeImages.fuze;
    if (img && img.complete && img.naturalWidth) {
        ctx.drawImage(img, -size/2, -size/2, size, size);
    }
    else {
        ctx.beginPath();
        ctx.arc(0, 0, size*0.4, 0, 2*Math.PI);
        ctx.fillStyle = "#FFFF00";
        ctx.fill();
    }
};

var drawPacmanSprite = function(ctx,x,y,dirEnum,angle,mouthShift,scale,centerShift,alpha,color,rot_angle) {

    if (mouthShift == undefined) mouthShift = 0;
    if (centerShift == undefined) centerShift = 0;
    if (scale == undefined) scale = 1;
    if (alpha == undefined) alpha = 1;
    if (angle == undefined) angle = 0;

    var heading = getHeadingAngle(dirEnum);
    var hx = Math.cos(heading);
    var hy = Math.sin(heading);

    ctx.save();
    ctx.translate(x,y);
    ctx.scale(scale,scale);
    if (rot_angle) {
        ctx.rotate(rot_angle);
    }
    ctx.translate(centerShift*hx, centerShift*hy);
    ctx.globalAlpha *= alpha;

    if (angle > 0) {
        if (angle >= Math.PI) {
            ctx.restore();
            return;
        }
        var apex = 1 + mouthShift;
        var r = FUZE_HEAD_SIZE;
        angle = angle*(1 - 0.35*(1 - angle/Math.PI));
        ctx.beginPath();
        ctx.moveTo(apex*hx, apex*hy);
        ctx.arc(0, 0, r, heading+angle, heading+2*Math.PI-angle);
        ctx.closePath();
        ctx.clip();
    }

    drawFuzeHead(ctx, FUZE_HEAD_SIZE);

    ctx.restore();
};

var drawClassicGhostSprite = drawGhostSprite;

var getAywenSpriteName = function(color) {
    var c = (color || "").toUpperCase();
    if (c == "#FFB8FF") return "aywen_pink";
    if (c == "#00FFFF") return "aywen_cyan";
    if (c == "#FFB851") return "aywen_orange";
    return "aywen_red";
};

var drawAywenImage = function(ctx, name, size, flip) {
    var img = fuzeImages[name];
    if (!img || !img.complete || !img.naturalWidth) {
        return false;
    }
    ctx.save();
    if (flip) {
        ctx.scale(-1,1);
    }
    ctx.drawImage(img, -size/2, -size/2, size, size);
    ctx.restore();
    return true;
};

var drawGhostSprite = function(ctx,x,y,frame,dirEnum,scared,flash,eyes_only,color) {
    var name;
    if (eyes_only) {
        name = "aywen_eaten";
    }
    else if (scared) {
        name = flash ? "aywen_flash" : "aywen_scared";
    }
    else {
        name = getAywenSpriteName(color);
    }

    ctx.save();
    ctx.translate(x, y + (frame ? -0.5 : 0.5));
    if (eyes_only) {
        ctx.globalAlpha *= 0.45;
    }
    var drawn = drawAywenImage(ctx, name, AYWEN_SIZE, dirEnum == DIR_LEFT && !scared);
    ctx.restore();

    if (!drawn) {
        drawClassicGhostSprite(ctx,x,y,frame,dirEnum,scared,flash,eyes_only,color);
    }
    else if (eyes_only) {
        drawClassicGhostSprite(ctx,x,y-1,frame,dirEnum,false,false,true,color);
    }
};
//////////////////////////////////////////////////////////////////////////////////////
// The actor class defines common data functions for the ghosts and pacman
// It provides everything for updating position and direction.

// "Ghost" and "Player" inherit from this "Actor"

// Actor constructor
var Actor = function() {

    this.dir = {};          // facing direction vector
    this.pixel = {};        // pixel position
    this.tile = {};         // tile position
    this.tilePixel = {};    // pixel location inside tile
    this.distToMid = {};    // pixel distance to mid-tile

    this.targetTile = {};   // tile position used for targeting

    this.frames = 0;        // frame count
    this.steps = 0;         // step count

    this.isDrawTarget = false;
    this.isDrawPath = false;

    this.savedSteps = {};
    this.savedFrames = {};
    this.savedDirEnum = {};
    this.savedPixel = {};
    this.savedTargetting = {};
    this.savedTargetTile = {};
};

// save state at time t
Actor.prototype.save = function(t) {
    this.savedSteps[t] = this.steps;
    this.savedFrames[t] = this.frames;
    this.savedDirEnum[t] = this.dirEnum;
    this.savedPixel[t] = { x:this.pixel.x, y:this.pixel.y };
    this.savedTargetting[t] = this.targetting;
    this.savedTargetTile[t] = { x: this.targetTile.x, y: this.targetTile.y };
};

// load state at time t
Actor.prototype.load = function(t) {
    this.steps = this.savedSteps[t];
    this.frames = this.savedFrames[t];
    this.setDir(this.savedDirEnum[t]);
    this.setPos(this.savedPixel[t].x, this.savedPixel[t].y);
    this.targetting = this.savedTargetting[t];
    this.targetTile.x = this.savedTargetTile[t].x;
    this.targetTile.y = this.savedTargetTile[t].y;
};


// reset to initial position and direction
Actor.prototype.reset = function() {
    this.setDir(this.startDirEnum);
    this.setPos(this.startPixel.x, this.startPixel.y);
    this.frames = 0;
    this.steps = 0;
    this.targetting = false;
};

// sets the position and updates its dependent variables
Actor.prototype.setPos = function(px,py) {
    this.pixel.x = px;
    this.pixel.y = py;
    this.commitPos();
};

// returns the relative pixel inside a tile given a map pixel
Actor.prototype.getTilePixel = function(pixel,tilePixel) {
    if (pixel == undefined) {
        pixel = this.pixel;
    }
    if (tilePixel == undefined) {
        tilePixel = {};
    }
    tilePixel.x = pixel.x % tileSize;
    tilePixel.y = pixel.y % tileSize;
    if (tilePixel.x < 0) {
        tilePixel.x += tileSize;
    }
    if (tilePixel.y < 0) {
        tilePixel.y += tileSize;
    }
    return tilePixel;
};

// updates the position's dependent variables
Actor.prototype.commitPos = function() {

    // use map-specific tunnel teleport
    if (map) {
        map.teleport(this);
    }

    this.tile.x = Math.floor(this.pixel.x / tileSize);
    this.tile.y = Math.floor(this.pixel.y / tileSize);
    this.getTilePixel(this.pixel,this.tilePixel);
    this.distToMid.x = midTile.x - this.tilePixel.x;
    this.distToMid.y = midTile.y - this.tilePixel.y;
};

// sets the direction and updates its dependent variables
Actor.prototype.setDir = function(dirEnum) {
    setDirFromEnum(this.dir, dirEnum);
    this.dirEnum = dirEnum;
};

// used as "pattern" parameter in getStepSizeFromTable()
var STEP_PACMAN = 0;
var STEP_GHOST = 1;
var STEP_PACMAN_FRIGHT = 2;
var STEP_GHOST_FRIGHT = 3;
var STEP_GHOST_TUNNEL = 4;
var STEP_ELROY1 = 5;
var STEP_ELROY2 = 6;

// getter function to extract a step size from speed control table
Actor.prototype.getStepSizeFromTable = (function(){

    // Actor speed is controlled by a list of 16 values.
    // Each value is the number of steps to take in a specific frame.
    // Once the end of the list is reached, we cycle to the beginning.
    // This method allows us to represent different speeds in a low-resolution space.

    // speed control table (from Jamey Pittman)
    var stepSizes = (
                         // LEVEL 1
    "1111111111111111" + // pac-man (normal)
    "0111111111111111" + // ghosts (normal)
    "1111211111112111" + // pac-man (fright)
    "0110110101101101" + // ghosts (fright)
    "0101010101010101" + // ghosts (tunnel)
    "1111111111111111" + // elroy 1
    "1111111121111111" + // elroy 2

                         // LEVELS 2-4
    "1111211111112111" + // pac-man (normal)
    "1111111121111111" + // ghosts (normal)
    "1111211112111121" + // pac-man (fright)
    "0110110110110111" + // ghosts (fright)
    "0110101011010101" + // ghosts (tunnel)
    "1111211111112111" + // elroy 1
    "1111211112111121" + // elroy 2

                         // LEVELS 5-20
    "1121112111211121" + // pac-man (normal)
    "1111211112111121" + // ghosts (normal)
    "1121112111211121" + // pac-man (fright) (N/A for levels 17, 19 & 20)
    "0111011101110111" + // ghosts (fright)  (N/A for levels 17, 19 & 20)
    "0110110101101101" + // ghosts (tunnel)
    "1121112111211121" + // elroy 1
    "1121121121121121" + // elroy 2

                         // LEVELS 21+
    "1111211111112111" + // pac-man (normal)
    "1111211112111121" + // ghosts (normal)
    "0000000000000000" + // pac-man (fright) N/A
    "0000000000000000" + // ghosts (fright)  N/A
    "0110110101101101" + // ghosts (tunnel)
    "1121112111211121" + // elroy 1
    "1121121121121121"); // elroy 2

    return function(level, pattern) {
        var entry;
        if (level < 1) return;
        else if (level==1)                  entry = 0;
        else if (level >= 2 && level <= 4)  entry = 1;
        else if (level >= 5 && level <= 20) entry = 2;
        else if (level >= 21)               entry = 3;
        return stepSizes[entry*7*16 + pattern*16 + this.frames%16];
    };
})();

// updates the actor state
Actor.prototype.update = function(j) {

    // get number of steps to advance in this frame
    var numSteps = this.getNumSteps();
    if (j >= numSteps) 
        return;

    // request to advance one step, and increment count if step taken
    this.steps += this.step();

    // update head direction
    this.steer();
};
//////////////////////////////////////////////////////////////////////////////////////
// Ghost class

// modes representing the ghost's current state
var GHOST_OUTSIDE = 0;
var GHOST_EATEN = 1;
var GHOST_GOING_HOME = 2;
var GHOST_ENTERING_HOME = 3;
var GHOST_PACING_HOME = 4;
var GHOST_LEAVING_HOME = 5;

// Ghost constructor
var Ghost = function() {
    // inherit data from Actor
    Actor.apply(this);

    this.randomScatter = false;
    this.faceDirEnum = this.dirEnum;
};

// inherit functions from Actor class
Ghost.prototype = newChildObject(Actor.prototype);

// displacements for ghost bouncing
Ghost.prototype.getBounceY = (function(){

    // NOTE: The bounce animation assumes an actor is moving in straight
    // horizontal or vertical lines between the centers of each tile.
    //
    // When moving horizontal, bounce height is a function of x.
    // When moving vertical, bounce height is a function of y.

    var bounceY = {};

    // map y tile pixel to new y tile pixel
    bounceY[DIR_UP] =    [-4,-2,0,2,4,3,2,3];
    bounceY[DIR_DOWN] =  [3,5,7,5,4,5,7,8];

    // map x tile pixel to y tile pixel
    bounceY[DIR_LEFT] =  [2,3,3,4,3,2,2,2];
    bounceY[DIR_RIGHT] = [2,2,3,4,3,3,2,2];

    return function(px,py,dirEnum) {
        if (px == undefined) {
            px = this.pixel.x;
        }
        if (py == undefined) {
            py = this.pixel.y;
        }
        if (dirEnum == undefined) {
            dirEnum = this.dirEnum;
        }

        if (this.mode != GHOST_OUTSIDE || !this.scared || gameMode != GAME_COOKIE) {
            return py;
        }

        var tilePixel = this.getTilePixel({x:px,y:py});
        var tileY = Math.floor(py / tileSize);
        var y = tileY*tileSize;

        if (dirEnum == DIR_UP || dirEnum == DIR_DOWN) {
            y += bounceY[dirEnum][tilePixel.y];
        }
        else {
            y += bounceY[dirEnum][tilePixel.x];
        }

        return y;
    };
})();

Ghost.prototype.getAnimFrame = function(frames) {
    if (frames == undefined) {
        frames = this.frames;
    }
    return Math.floor(frames/8)%2; // toggle frame every 8 ticks
};

// reset the state of the ghost on new level or level restart
Ghost.prototype.reset = function() {

    // signals
    this.sigReverse = false;
    this.sigLeaveHome = false;

    // modes
    this.mode = this.startMode;
    this.scared = false;
    audio.ghostReset();

    this.savedSigReverse = {};
    this.savedSigLeaveHome = {};
    this.savedMode = {};
    this.savedScared = {};
    this.savedElroy = {};
    this.savedFaceDirEnum = {};

    // call Actor's reset function to reset position and direction
    Actor.prototype.reset.apply(this);

    // faceDirEnum  = direction the ghost is facing
    // dirEnum      = direction the ghost is moving
    // (faceDirEnum represents what dirEnum will be once the ghost reaches the middle of the tile)
    this.faceDirEnum = this.dirEnum;
};

Ghost.prototype.save = function(t) {
    this.savedSigReverse[t] = this.sigReverse;
    this.savedSigLeaveHome[t] = this.sigLeaveHome;
    this.savedMode[t] = this.mode;
    this.savedScared[t] = this.scared;
    if (this == blinky) {
        this.savedElroy[t] = this.elroy;
    }
    this.savedFaceDirEnum[t] = this.faceDirEnum;
    Actor.prototype.save.call(this,t);
};

Ghost.prototype.load = function(t) {
    this.sigReverse = this.savedSigReverse[t];
    this.sigLeaveHome = this.savedSigLeaveHome[t];
    this.mode = this.savedMode[t];
    this.scared = this.savedScared[t];
    if (this == blinky) {
        this.elroy = this.savedElroy[t];
    }
    this.faceDirEnum = this.savedFaceDirEnum[t];
    Actor.prototype.load.call(this,t);
};

// indicates if we slow down in the tunnel
Ghost.prototype.isSlowInTunnel = function() {
    // special case for Ms. Pac-Man (slow down only for the first three levels)
    if (gameMode == GAME_MSPACMAN || gameMode == GAME_OTTO || gameMode == GAME_COOKIE)
        return level <= 3;
    else
        return true;
};

// gets the number of steps to move in this frame
Ghost.prototype.getNumSteps = function() {

    var pattern = STEP_GHOST;

    if (this.mode == GHOST_GOING_HOME || this.mode == GHOST_ENTERING_HOME)
        return 2;
    else if (this.mode == GHOST_LEAVING_HOME || this.mode == GHOST_PACING_HOME)
        return this.getStepSizeFromTable(1, STEP_GHOST_TUNNEL);
    else if (map.isTunnelTile(this.tile.x, this.tile.y) && this.isSlowInTunnel())
        pattern = STEP_GHOST_TUNNEL;
    else if (this.scared)
        pattern = STEP_GHOST_FRIGHT;
    else if (this.elroy == 1)
        pattern = STEP_ELROY1;
    else if (this.elroy == 2)
        pattern = STEP_ELROY2;

    return this.getStepSizeFromTable(level ? level : 1, pattern);
};

// signal ghost to reverse direction after leaving current tile
Ghost.prototype.reverse = function() {
    this.sigReverse = true;
};

// signal ghost to go home
// It is useful to have this because as soon as the ghost gets eaten,
// we have to freeze all the actors for 3 seconds, except for the
// ones who are already traveling to the ghost home to be revived.
// We use this signal to change mode to GHOST_GOING_HOME, which will be
// set after the update() function is called so that we are still frozen
// for 3 seconds before traveling home uninterrupted.
Ghost.prototype.goHome = function() {
    audio.silence();
    audio.eatingGhost.play();
    this.mode = GHOST_EATEN;
};

// Following the pattern that state changes be made via signaling (e.g. reversing, going home)
// the ghost is commanded to leave home similarly.
// (not sure if this is correct yet)
Ghost.prototype.leaveHome = function() {
    this.playSounds();
    this.sigLeaveHome = true;
};

Ghost.prototype.playSounds = function() {
    var ghostsOutside = 0;
    var ghostsGoingHome = 0;
    for (var i=0; i<4; i++) {
        if (ghosts[i].mode == GHOST_OUTSIDE)    ghostsOutside++;
        if (ghosts[i].mode == GHOST_GOING_HOME) ghostsGoingHome++;
    }
    if (ghostsGoingHome > 0) {
        audio.ghostNormalMove.stopLoop();
        audio.ghostReturnToHome.startLoop(true);
        return;
    }
    else {
        audio.ghostReturnToHome.stopLoop();
    }
    if (ghostsOutside > 0 ) {
        if (! this.scared)
            audio.ghostNormalMove.startLoop(true);
    }
    else {
        audio.ghostNormalMove.stopLoop();
    }
}

// function called when pacman eats an energizer
Ghost.prototype.onEnergized = function() {

    this.reverse();

    // only scare me if not already going home
    if (this.mode != GHOST_GOING_HOME && this.mode != GHOST_ENTERING_HOME) {
        this.scared = true;
        this.targetting = undefined;
    }
};

// function called when this ghost gets eaten
Ghost.prototype.onEaten = function() {
    this.goHome();       // go home
    this.scared = false; // turn off scared
};

// move forward one step
Ghost.prototype.step = function() {
    this.setPos(this.pixel.x+this.dir.x, this.pixel.y+this.dir.y);
    return 1;
};

// ghost home-specific path steering
Ghost.prototype.homeSteer = (function(){

    // steering functions to execute for each mode
    var steerFuncs = {};

    steerFuncs[GHOST_GOING_HOME] = function() {
        // at the doormat
        if (this.tile.x == map.doorTile.x && this.tile.y == map.doorTile.y) {
            this.faceDirEnum = DIR_DOWN;
            this.targetting = false;
            // walk to the door, or go through if already there
            if (this.pixel.x == map.doorPixel.x) {
                this.mode = GHOST_ENTERING_HOME;
                this.playSounds();
                this.setDir(DIR_DOWN);
                this.faceDirEnum = this.dirEnum;
            }
            else {
                this.setDir(DIR_RIGHT);
                this.faceDirEnum = this.dirEnum;
            }
        }
    };

    steerFuncs[GHOST_ENTERING_HOME] = function() {
        if (this.pixel.y == map.homeBottomPixel) {
            // revive if reached its seat
            if (this.pixel.x == this.startPixel.x) {
                this.setDir(DIR_UP);
                this.mode = this.arriveHomeMode;
            }
            // sidestep to its seat
            else {
                this.setDir(this.startPixel.x < this.pixel.x ? DIR_LEFT : DIR_RIGHT);
            }
            this.faceDirEnum = this.dirEnum;
        }
    };

    steerFuncs[GHOST_PACING_HOME] = function() {
        // head for the door
        if (this.sigLeaveHome) {
            this.sigLeaveHome = false;
            this.mode = GHOST_LEAVING_HOME;
            if (this.pixel.x == map.doorPixel.x)
                this.setDir(DIR_UP);
            else
                this.setDir(this.pixel.x < map.doorPixel.x ? DIR_RIGHT : DIR_LEFT);
        }
        // pace back and forth
        else {
            if (this.pixel.y == map.homeTopPixel)
                this.setDir(DIR_DOWN);
            else if (this.pixel.y == map.homeBottomPixel)
                this.setDir(DIR_UP);
        }
        this.faceDirEnum = this.dirEnum;
    };

    steerFuncs[GHOST_LEAVING_HOME] = function() {
        if (this.pixel.x == map.doorPixel.x) {
            // reached door
            if (this.pixel.y == map.doorPixel.y) {
                this.mode = GHOST_OUTSIDE;
                this.setDir(DIR_LEFT); // always turn left at door?
            }
            // keep walking up to the door
            else {
                this.setDir(DIR_UP);
            }
            this.faceDirEnum = this.dirEnum;
        }
    };

    // return a function to execute appropriate steering function for a given ghost
    return function() { 
        var f = steerFuncs[this.mode];
        if (f)
            f.apply(this);
    };

})();

// special case for Ms. Pac-Man game that randomly chooses a corner for blinky and pinky when scattering
Ghost.prototype.isScatterBrain = function() {
    var scatter = false;
    if (ghostCommander.getCommand() == GHOST_CMD_SCATTER) {
        if (gameMode == GAME_MSPACMAN || gameMode == GAME_COOKIE) {
            scatter = (this == blinky || this == pinky);
        }
        else if (gameMode == GAME_OTTO) {
            scatter = true;
        }
    }
    return scatter;
};

// determine direction
Ghost.prototype.steer = function() {

    var dirEnum;                         // final direction to update to
    var openTiles;                       // list of four booleans indicating which surrounding tiles are open
    var oppDirEnum = rotateAboutFace(this.dirEnum); // current opposite direction enum
    var actor;                           // actor whose corner we will target

    // special map-specific steering when going to, entering, pacing inside, or leaving home
    this.homeSteer();

    // current opposite direction enum
    oppDirEnum = rotateAboutFace(this.dirEnum); 

    // only execute rest of the steering logic if we're pursuing a target tile
    if (this.mode != GHOST_OUTSIDE && this.mode != GHOST_GOING_HOME) {
        this.targetting = false;
        return;
    }

    // AT MID-TILE (update movement direction)
    if (this.distToMid.x == 0 && this.distToMid.y == 0) {

        // trigger reversal
        if (this.sigReverse) {
            this.faceDirEnum = oppDirEnum;
            this.sigReverse = false;
        }

        // commit previous direction
        this.setDir(this.faceDirEnum);
    }
    // JUST PASSED MID-TILE (update face direction)
    else if (
            this.dirEnum == DIR_RIGHT && this.tilePixel.x == midTile.x+1 ||
            this.dirEnum == DIR_LEFT  && this.tilePixel.x == midTile.x-1 ||
            this.dirEnum == DIR_UP    && this.tilePixel.y == midTile.y-1 ||
            this.dirEnum == DIR_DOWN  && this.tilePixel.y == midTile.y+1) {

        // get next tile
        var nextTile = {
            x: this.tile.x + this.dir.x,
            y: this.tile.y + this.dir.y,
        };

        // get tiles surrounding next tile and their open indication
        openTiles = getOpenTiles(nextTile, this.dirEnum);

        if (this.scared) {
            // choose a random turn
            dirEnum = Math.floor(Math.random()*4);
            while (!openTiles[dirEnum])
                dirEnum = (dirEnum+1)%4; // look at likelihood of random turns
            this.targetting = false;
        }
        else {

            /* SET TARGET */

            // target ghost door
            if (this.mode == GHOST_GOING_HOME) {
                this.targetTile.x = map.doorTile.x;
                this.targetTile.y = map.doorTile.y;
            }
            // target corner when scattering
            else if (!this.elroy && ghostCommander.getCommand() == GHOST_CMD_SCATTER) {

                actor = this.isScatterBrain() ? actors[Math.floor(Math.random()*4)] : this;

                this.targetTile.x = actor.cornerTile.x;
                this.targetTile.y = actor.cornerTile.y;
                this.targetting = 'corner';
            }
            // use custom function for each ghost when in attack mode
            else {
                this.setTarget();
            }

            /* CHOOSE TURN */

            var dirDecided = false;
            if (this.mode == GHOST_GOING_HOME && map.getExitDir) {
                // If the map has a 'getExitDir' function, then we are using
                // a custom algorithm to choose the next direction.
                // Currently, procedurally-generated maps use this function
                // to ensure that ghosts can return home without looping forever.
                var exitDir = map.getExitDir(nextTile.x,nextTile.y);
                if (exitDir != undefined && exitDir != oppDirEnum) {
                    dirDecided = true;
                    dirEnum = exitDir;
                }
            }

            if (!dirDecided) {
                // Do not constrain turns for ghosts going home. (thanks bitwave)
                if (this.mode != GHOST_GOING_HOME) {
                    if (map.constrainGhostTurns) {
                        // edit openTiles to reflect the current map's special contraints
                        map.constrainGhostTurns(nextTile, openTiles, this.dirEnum);
                    }
                }

                // choose direction that minimizes distance to target
                dirEnum = getTurnClosestToTarget(nextTile, this.targetTile, openTiles);
            }
        }

        // Point eyeballs to the determined direction.
        this.faceDirEnum = dirEnum;
    }
};

Ghost.prototype.getPathDistLeft = function(fromPixel, dirEnum) {
    var distLeft = tileSize;
    var pixel = this.getTargetPixel();
    if (this.targetting == 'pacman') {
        if (dirEnum == DIR_UP || dirEnum == DIR_DOWN)
            distLeft = Math.abs(fromPixel.y - pixel.y);
        else {
            distLeft = Math.abs(fromPixel.x - pixel.x);
        }
    }
    return distLeft;
};

Ghost.prototype.setTarget = function() {
    // This sets the target tile when in chase mode.
    // The "target" is always Pac-Man when in this mode,
    // except for Clyde.  He runs away back home sometimes,
    // so the "targetting" parameter is set in getTargetTile
    // for Clyde only.

    this.targetTile = this.getTargetTile();

    if (this != clyde) {
        this.targetting = 'pacman';
    }
};
//////////////////////////////////////////////////////////////////////////////////////
// Player is the controllable character (Pac-Man)

// Player constructor
var Player = function() {

    // inherit data from Actor
    Actor.apply(this);
    if (gameMode == GAME_MSPACMAN || gameMode == GAME_COOKIE) {
        this.frames = 1; // start with mouth open
    }

    this.nextDir = {};
    this.lastMeal = { x:-1, y:-1 };

    // determines if this player should be AI controlled
    this.ai = false;
    this.invincible = false;

    this.savedNextDirEnum = {};
    this.savedStopped = {};
    this.savedEatPauseFramesLeft = {};
};

// inherit functions from Actor
Player.prototype = newChildObject(Actor.prototype);

Player.prototype.save = function(t) {
    this.savedEatPauseFramesLeft[t] = this.eatPauseFramesLeft;
    this.savedNextDirEnum[t] = this.nextDirEnum;
    this.savedStopped[t] = this.stopped;

    Actor.prototype.save.call(this,t);
};

Player.prototype.load = function(t) {
    this.eatPauseFramesLeft = this.savedEatPauseFramesLeft[t];
    this.setNextDir(this.savedNextDirEnum[t]);
    this.stopped = this.savedStopped[t];

    Actor.prototype.load.call(this,t);
};

// reset the state of the player on new level or level restart
Player.prototype.reset = function() {

    this.setNextDir(this.startDirEnum);
    this.stopped = false;
    this.inputDirEnum = undefined;

    this.eatPauseFramesLeft = 0;   // current # of frames left to pause after eating

    // call Actor's reset function to reset to initial position and direction
    Actor.prototype.reset.apply(this);

};

// sets the next direction and updates its dependent variables
Player.prototype.setNextDir = function(nextDirEnum) {
    setDirFromEnum(this.nextDir, nextDirEnum);
    this.nextDirEnum = nextDirEnum;
};

// gets the number of steps to move in this frame
Player.prototype.getNumSteps = function() {
    if (turboMode)
        return 2;

    var pattern = energizer.isActive() ? STEP_PACMAN_FRIGHT : STEP_PACMAN;
    return this.getStepSizeFromTable(level, pattern);
};

Player.prototype.getStepFrame = function(steps) {
    if (steps == undefined) {
        steps = this.steps;
    }
    return Math.floor(steps/2)%4;
};

Player.prototype.getAnimFrame = function(frame) {
    if (frame == undefined) {
        frame = this.getStepFrame();
    }
    if (gameMode == GAME_MSPACMAN || gameMode == GAME_COOKIE) { // ms. pacman starts with mouth open
        frame = (frame+1)%4;
        if (state == deadState)
            frame = 1; // hack to force this frame when dead
    }
    if (gameMode != GAME_OTTO) {
        if (frame == 3) 
            frame = 1;
    }
    return frame;
};

Player.prototype.setInputDir = function(dirEnum) {
    this.inputDirEnum = dirEnum;
};

Player.prototype.clearInputDir = function(dirEnum) {
    if (dirEnum == undefined || this.inputDirEnum == dirEnum) {
        this.inputDirEnum = undefined;
    }
};

// move forward one step
Player.prototype.step = (function(){

    // return sign of a number
    var sign = function(x) {
        if (x<0) return -1;
        if (x>0) return 1;
        return 0;
    };

    return function() {

        // just increment if we're not in a map
        if (!map) {
            this.setPos(this.pixel.x+this.dir.x, this.pixel.y+this.dir.y);
            return 1;
        }

        // identify the axes of motion
        var a = (this.dir.x != 0) ? 'x' : 'y'; // axis of motion
        var b = (this.dir.x != 0) ? 'y' : 'x'; // axis perpendicular to motion

        // Don't proceed past the middle of a tile if facing a wall
        this.stopped = this.stopped || (this.distToMid[a] == 0 && !isNextTileFloor(this.tile, this.dir));
        if (!this.stopped) {
            // Move in the direction of travel.
            this.pixel[a] += this.dir[a];

            // Drift toward the center of the track (a.k.a. cornering)
            this.pixel[b] += sign(this.distToMid[b]);
        }


        this.commitPos();
        return this.stopped ? 0 : 1;
    };
})();

// determine direction
Player.prototype.steer = function() {

    // if AI-controlled, only turn at mid-tile
    if (this.ai) {
        if (this.distToMid.x != 0 || this.distToMid.y != 0)
            return;

        // make turn that is closest to target
        var openTiles = getOpenTiles(this.tile, this.dirEnum);
        this.setTarget();
        this.setNextDir(getTurnClosestToTarget(this.tile, this.targetTile, openTiles));
    }
    else {
        this.targetting = undefined;
    }

    if (this.inputDirEnum == undefined) {
        if (this.stopped) {
            this.setDir(this.nextDirEnum);
        }
    }
    else {
        // Determine if input direction is open.
        var inputDir = {};
        setDirFromEnum(inputDir, this.inputDirEnum);
        var inputDirOpen = isNextTileFloor(this.tile, inputDir);

        if (inputDirOpen) {
            this.setDir(this.inputDirEnum);
            this.setNextDir(this.inputDirEnum);
            this.stopped = false;
        }
        else {
            if (!this.stopped) {
                this.setNextDir(this.inputDirEnum);
            }
        }
    }
    if (this.stopped) {
        audio.eating.stopLoop(true);
    }
};


// update this frame
Player.prototype.update = function(j) {

    var numSteps = this.getNumSteps();
    if (j >= numSteps)
        return;

    // skip frames
    if (this.eatPauseFramesLeft > 0) {
        if (j == numSteps-1)
            this.eatPauseFramesLeft--;
        return;
    }

    // call super function to update position and direction
    Actor.prototype.update.call(this,j);

    // eat something
    if (map) {
        var t = map.getTile(this.tile.x, this.tile.y);
        if (t == '.' || t == 'o') {
            this.lastMeal.x = this.tile.x;
            this.lastMeal.y = this.tile.y
            // apply eating drag (unless in turbo mode)
            if (!turboMode) {
                this.eatPauseFramesLeft = (t=='.') ? 1 : 3;
            }
            audio.eating.startLoop(true);
            map.onDotEat(this.tile.x, this.tile.y);
            ghostReleaser.onDotEat();
            fruit.onDotEat();
            addScore((t=='.') ? 10 : 50);

            if (t=='o')
                energizer.activate();
        }
        if (t == ' ' && ! (this.lastMeal.x == this.tile.x && this.lastMeal.y == this.tile.y)) {
            audio.eating.stopLoop(true);
        }
    }
};
//////////////////////////////////////////////////////////////////////////////////////
// create all the actors

var blinky = new Ghost();
blinky.name = "blinky";
blinky.color = "#FF0000";
blinky.pathColor = "rgba(255,0,0,0.8)";
blinky.isVisible = true;

var pinky = new Ghost();
pinky.name = "pinky";
pinky.color = "#FFB8FF";
pinky.pathColor = "rgba(255,184,255,0.8)";
pinky.isVisible = true;

var inky = new Ghost();
inky.name = "inky";
inky.color = "#00FFFF";
inky.pathColor = "rgba(0,255,255,0.8)";
inky.isVisible = true;

var clyde = new Ghost();
clyde.name = "clyde";
clyde.color = "#FFB851";
clyde.pathColor = "rgba(255,184,81,0.8)";
clyde.isVisible = true;

var pacman = new Player();
pacman.name = "pacman";
pacman.color = "#FFFF00";
pacman.pathColor = "rgba(255,255,0,0.8)";

// order at which they appear in original arcade memory
// (suggests drawing/update order)
var actors = [blinky, pinky, inky, clyde, pacman];
var ghosts = [blinky, pinky, inky, clyde];
/////////////////////////////////////////////////////////////////
// Targetting
// (a definition for each actor's targetting algorithm and a draw function to visualize it)
// (getPathDistLeft is used to obtain a smoothly interpolated path endpoint)

// the tile length of the path drawn toward the target
var actorPathLength = 16;

(function() {

// the size of the square rendered over a target tile (just half a tile)
var targetSize = midTile.y;

// when drawing paths, use these offsets so they don't completely overlap each other
pacman.pathCenter = { x:0, y:0};
blinky.pathCenter = { x:-2, y:-2 };
pinky.pathCenter = { x:-1, y:-1 };
inky.pathCenter = { x:1, y:1 };
clyde.pathCenter = { x:2, y:2 };

/////////////////////////////////////////////////////////////////
// blinky directly targets pacman

blinky.getTargetTile = function() {
    return { x: pacman.tile.x, y: pacman.tile.y };
};
blinky.getTargetPixel = function() {
    return { x: pacman.pixel.x, y: pacman.pixel.y };
};
blinky.drawTarget = function(ctx) {
    if (!this.targetting) return;
    ctx.fillStyle = this.color;
    if (this.targetting == 'pacman')
        renderer.drawCenterPixelSq(ctx, pacman.pixel.x, pacman.pixel.y, targetSize);
    else
        renderer.drawCenterTileSq(ctx, this.targetTile.x, this.targetTile.y, targetSize);
};

/////////////////////////////////////////////////////////////////
// pinky targets four tiles ahead of pacman
pinky.getTargetTile = function() {
    var px = pacman.tile.x + 4*pacman.dir.x;
    var py = pacman.tile.y + 4*pacman.dir.y;
    if (pacman.dirEnum == DIR_UP) {
        px -= 4;
    }
    return { x : px, y : py };
};
pinky.getTargetPixel = function() {
    var px = pacman.pixel.x + 4*pacman.dir.x*tileSize;
    var py = pacman.pixel.y + 4*pacman.dir.y*tileSize;
    if (pacman.dirEnum == DIR_UP) {
        px -= 4*tileSize;
    }
    return { x : px, y : py };
};
pinky.drawTarget = function(ctx) {
    if (!this.targetting) return;
    ctx.fillStyle = this.color;

    var pixel = this.getTargetPixel();

    if (this.targetting == 'pacman') {
        ctx.beginPath();
        ctx.moveTo(pacman.pixel.x, pacman.pixel.y);
        if (pacman.dirEnum == DIR_UP) {
            ctx.lineTo(pacman.pixel.x, pixel.y);
        }
        ctx.lineTo(pixel.x, pixel.y);
        ctx.stroke();
        renderer.drawCenterPixelSq(ctx, pixel.x, pixel.y, targetSize);
    }
    else
        renderer.drawCenterTileSq(ctx, this.targetTile.x, this.targetTile.y, targetSize);
};

/////////////////////////////////////////////////////////////////
// inky targets twice the distance from blinky to two tiles ahead of pacman
inky.getTargetTile = function() {
    var px = pacman.tile.x + 2*pacman.dir.x;
    var py = pacman.tile.y + 2*pacman.dir.y;
    if (pacman.dirEnum == DIR_UP) {
        px -= 2;
    }
    return {
        x : blinky.tile.x + 2*(px - blinky.tile.x),
        y : blinky.tile.y + 2*(py - blinky.tile.y),
    };
};
inky.getJointPixel = function() {
    var px = pacman.pixel.x + 2*pacman.dir.x*tileSize;
    var py = pacman.pixel.y + 2*pacman.dir.y*tileSize;
    if (pacman.dirEnum == DIR_UP) {
        px -= 2*tileSize;
    }
    return { x: px, y: py };
};
inky.getTargetPixel = function() {
    var px = pacman.pixel.x + 2*pacman.dir.x*tileSize;
    var py = pacman.pixel.y + 2*pacman.dir.y*tileSize;
    if (pacman.dirEnum == DIR_UP) {
        px -= 2*tileSize;
    }
    return {
        x : blinky.pixel.x + 2*(px-blinky.pixel.x),
        y : blinky.pixel.y + 2*(py-blinky.pixel.y),
    };
};
inky.drawTarget = function(ctx) {
    if (!this.targetting) return;
    var pixel;

    var joint = this.getJointPixel();

    if (this.targetting == 'pacman') {
        pixel = this.getTargetPixel();
        ctx.beginPath();
        ctx.moveTo(pacman.pixel.x, pacman.pixel.y);
        if (pacman.dirEnum == DIR_UP) {
            ctx.lineTo(pacman.pixel.x, joint.y);
        }
        ctx.lineTo(joint.x, joint.y);
        ctx.moveTo(blinky.pixel.x, blinky.pixel.y);
        ctx.lineTo(pixel.x, pixel.y);
        ctx.closePath();
        ctx.stroke();

        // draw seesaw joint
        ctx.beginPath();
        ctx.arc(joint.x, joint.y, 2,0,Math.PI*2);
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();

        ctx.fillStyle = this.color;
        renderer.drawCenterPixelSq(ctx, pixel.x, pixel.y, targetSize);
    }
    else {
        ctx.fillStyle = this.color;
        renderer.drawCenterTileSq(ctx, this.targetTile.x, this.targetTile.y, targetSize);
    }
};

/////////////////////////////////////////////////////////////////
// clyde targets pacman if >=8 tiles away, otherwise targets home

clyde.getTargetTile = function() {
    var dx = pacman.tile.x - (this.tile.x + this.dir.x);
    var dy = pacman.tile.y - (this.tile.y + this.dir.y);
    var dist = dx*dx+dy*dy;
    if (dist >= 64) {
        this.targetting = 'pacman';
        return { x: pacman.tile.x, y: pacman.tile.y };
    }
    else {
        this.targetting = 'corner';
        return { x: this.cornerTile.x, y: this.cornerTile.y };
    }
};
clyde.getTargetPixel = function() {
    // NOTE: won't ever need this function for corner tile because it is always outside
    return { x: pacman.pixel.x, y: pacman.pixel.y };
};
clyde.drawTarget = function(ctx) {
    if (!this.targetting) return;
    ctx.fillStyle = this.color;

    if (this.targetting == 'pacman') {
        ctx.beginPath();
        if (true) {
            // draw a radius
            ctx.arc(pacman.pixel.x, pacman.pixel.y, tileSize*8,0, 2*Math.PI);
            ctx.closePath();
        }
        else {
            // draw a distance stick
            ctx.moveTo(pacman.pixel.x, pacman.pixel.y);
            var dx = clyde.pixel.x - pacman.pixel.x;
            var dy = clyde.pixel.y - pacman.pixel.y;
            var dist = Math.sqrt(dx*dx+dy*dy);
            dx = dx/dist*tileSize*8;
            dy = dy/dist*tileSize*8;
            ctx.lineTo(pacman.pixel.x + dx, pacman.pixel.y + dy);
        }
        ctx.stroke();
        renderer.drawCenterPixelSq(ctx, pacman.pixel.x, pacman.pixel.y, targetSize);
    }
    else {
        // draw a radius
        if (ghostCommander.getCommand() == GHOST_CMD_CHASE) {
            ctx.beginPath();
            ctx.arc(pacman.pixel.x, pacman.pixel.y, tileSize*8,0, 2*Math.PI);
            ctx.strokeStyle = "rgba(255,255,255,0.25)";
            ctx.stroke();
        }
        renderer.drawCenterTileSq(ctx, this.targetTile.x, this.targetTile.y, targetSize);
    }
};


/////////////////////////////////////////////////////////////////
// pacman targets twice the distance from pinky to pacman or target pinky

pacman.setTarget = function() {
    if (blinky.mode == GHOST_GOING_HOME || blinky.scared) {
        this.targetTile.x = pinky.tile.x;
        this.targetTile.y = pinky.tile.y;
        this.targetting = 'pinky';
    }
    else {
        this.targetTile.x = pinky.tile.x + 2*(pacman.tile.x-pinky.tile.x);
        this.targetTile.y = pinky.tile.y + 2*(pacman.tile.y-pinky.tile.y);
        this.targetting = 'flee';
    }
};
pacman.drawTarget = function(ctx) {
    if (!this.ai) return;
    ctx.fillStyle = this.color;
    var px,py;

    if (this.targetting == 'flee') {
        px = pacman.pixel.x - pinky.pixel.x;
        py = pacman.pixel.y - pinky.pixel.y;
        px = pinky.pixel.x + 2*px;
        py = pinky.pixel.y + 2*py;
        ctx.beginPath();
        ctx.moveTo(pinky.pixel.x, pinky.pixel.y);
        ctx.lineTo(px,py);
        ctx.closePath();
        ctx.stroke();
        renderer.drawCenterPixelSq(ctx, px, py, targetSize);
    }
    else {
        renderer.drawCenterPixelSq(ctx, pinky.pixel.x, pinky.pixel.y, targetSize);
    };

};
pacman.getPathDistLeft = function(fromPixel, dirEnum) {
    var distLeft = tileSize;
    var px,py;
    if (this.targetting == 'pinky') {
        if (dirEnum == DIR_UP || dirEnum == DIR_DOWN)
            distLeft = Math.abs(fromPixel.y - pinky.pixel.y);
        else
            distLeft = Math.abs(fromPixel.x - pinky.pixel.x);
    }
    else { // 'flee'
        px = pacman.pixel.x - pinky.pixel.x;
        py = pacman.pixel.y - pinky.pixel.y;
        px = pinky.pixel.x + 2*px;
        py = pinky.pixel.y + 2*py;
        if (dirEnum == DIR_UP || dirEnum == DIR_DOWN)
            distLeft = Math.abs(py - fromPixel.y);
        else
            distLeft = Math.abs(px - fromPixel.x);
    }
    return distLeft;
};

})();
//////////////////////////////////////////////////////////////////////////////////////
// Ghost Commander
// Determines when a ghost should be chasing a target

// modes representing the ghosts' current command
var GHOST_CMD_CHASE = 0;
var GHOST_CMD_SCATTER = 1;

var ghostCommander = (function() {

    // determine if there is to be a new command issued at the given time
    var getNewCommand = (function(){
        var t;
        var times = [{},{},{}];
        // level 1
        times[0][t=7*60] = GHOST_CMD_CHASE;
        times[0][t+=20*60] = GHOST_CMD_SCATTER;
        times[0][t+=7*60] = GHOST_CMD_CHASE;
        times[0][t+=20*60] = GHOST_CMD_SCATTER;
        times[0][t+=5*60] = GHOST_CMD_CHASE;
        times[0][t+=20*60] = GHOST_CMD_SCATTER;
        times[0][t+=5*60] = GHOST_CMD_CHASE;
        // level 2-4
        times[1][t=7*60] = GHOST_CMD_CHASE;
        times[1][t+=20*60] = GHOST_CMD_SCATTER;
        times[1][t+=7*60] = GHOST_CMD_CHASE;
        times[1][t+=20*60] = GHOST_CMD_SCATTER;
        times[1][t+=5*60] = GHOST_CMD_CHASE;
        times[1][t+=1033*60] = GHOST_CMD_SCATTER;
        times[1][t+=1] = GHOST_CMD_CHASE;
        // level 5+
        times[2][t=5*60] = GHOST_CMD_CHASE;
        times[2][t+=20*60] = GHOST_CMD_SCATTER;
        times[2][t+=5*60] = GHOST_CMD_CHASE;
        times[2][t+=20*60] = GHOST_CMD_SCATTER;
        times[2][t+=5*60] = GHOST_CMD_CHASE;
        times[2][t+=1037*60] = GHOST_CMD_SCATTER;
        times[2][t+=1] = GHOST_CMD_CHASE;

        return function(frame) {
            var i;
            if (level == 1)
                i = 0;
            else if (level >= 2 && level <= 4)
                i = 1;
            else
                i = 2;
            var newCmd = times[i][frame];

            if (gameMode == GAME_PACMAN) {
                return newCmd;
            }
            else if (frame <= 27*60) { // only revearse twice in Ms. Pac-Man (two happen in first 27 seconds)
                if (newCmd != undefined) {
                    return GHOST_CMD_CHASE; // always chase in Ms. Pac-Man mode
                }
            }
        };
    })();

    var frame;   // current frame
    var command; // last command given to ghosts

    var savedFrame = {};
    var savedCommand = {};

    // save state at time t
    var save = function(t) {
        savedFrame[t] = frame;
        savedCommand[t] = command;
    };

    // load state at time t
    var load = function(t) {
        frame = savedFrame[t];
        command = savedCommand[t];
    };

    return {
        save: save,
        load: load,
        reset: function() { 
            command = GHOST_CMD_SCATTER;
            frame = 0;
        },
        update: function() {
            var newCmd;
            if (!energizer.isActive()) {
                newCmd = getNewCommand(frame);
                if (newCmd != undefined) {
                    command = newCmd;
                    for (i=0; i<4; i++)
                        ghosts[i].reverse();
                }
                frame++;
            }
        },
        getCommand: function() {
            return command; 
        },
        setCommand: function(cmd) {
            command = cmd;
        },
    };
})();
//////////////////////////////////////////////////////////////////////////////////////
// Ghost Releaser

// Determines when to release ghosts from home

var ghostReleaser = (function(){
    // two separate counter modes for releasing the ghosts from home
    var MODE_PERSONAL = 0;
    var MODE_GLOBAL = 1;

    // ghost enumerations
    var PINKY = 1;
    var INKY = 2;
    var CLYDE = 3;

    // this is how many frames it will take to release a ghost after pacman stops eating
    var getTimeoutLimit = function() { return (level < 5) ? 4*60 : 3*60; };

    // dot limits used in personal mode to release ghost after # of dots have been eaten
    var personalDotLimit = {};
    personalDotLimit[PINKY] = function() { return 0; };
    personalDotLimit[INKY] = function() { return (level==1) ? 30 : 0; };
    personalDotLimit[CLYDE] = function() {
        if (level == 1) return 60;
        if (level == 2) return 50;
        return 0;
    };

    // dot limits used in global mode to release ghost after # of dots have been eaten
    var globalDotLimit = {};
    globalDotLimit[PINKY] = 7;
    globalDotLimit[INKY] = 17;
    globalDotLimit[CLYDE] = 32;

    var framesSinceLastDot; // frames elapsed since last dot was eaten
    var mode;               // personal or global dot counter mode
    var ghostCounts = {};   // personal dot counts for each ghost
    var globalCount;        // global dot count

    var savedGlobalCount = {};
    var savedFramesSinceLastDot = {};
    var savedGhostCounts = {};

    // save state at time t
    var save = function(t) {
        savedFramesSinceLastDot[t] = framesSinceLastDot;
        if (mode == MODE_GLOBAL) {
            savedGlobalCount[t] = globalCount;
        }
        else if (mode == MODE_PERSONAL) {
            savedGhostCounts[t] = {};
            savedGhostCounts[t][PINKY] = ghostCounts[PINKY];
            savedGhostCounts[t][INKY] = ghostCounts[INKY];
            savedGhostCounts[t][CLYDE] = ghostCounts[CLYDE];
        }
    };

    // load state at time t
    var load = function(t) {
        framesSinceLastDot = savedFramesSinceLastDot[t];
        if (mode == MODE_GLOBAL) {
            globalCount = savedGlobalCount[t];
        }
        else if (mode == MODE_PERSONAL) {
            ghostCounts[PINKY] = savedGhostCounts[t][PINKY];
            ghostCounts[INKY] = savedGhostCounts[t][INKY];
            ghostCounts[CLYDE] = savedGhostCounts[t][CLYDE];
        }
    };

    return {
        save: save,
        load: load,
        onNewLevel: function() {
            mode = MODE_PERSONAL;
            framesSinceLastDot = 0;
            ghostCounts[PINKY] = 0;
            ghostCounts[INKY] = 0;
            ghostCounts[CLYDE] = 0;
        },
        onRestartLevel: function() {
            mode = MODE_GLOBAL;
            framesSinceLastDot = 0;
            globalCount = 0;
        },
        onDotEat: function() {
            var i;

            framesSinceLastDot = 0;

            if (mode == MODE_GLOBAL) {
                globalCount++;
            }
            else {
                for (i=1;i<4;i++) {
                    if (ghosts[i].mode == GHOST_PACING_HOME) {
                        ghostCounts[i]++;
                        break;
                    }
                }
            }

        },
        update: function() {
            var g;

            // use personal dot counter
            if (mode == MODE_PERSONAL) {
                for (i=1;i<4;i++) {
                    g = ghosts[i];
                    if (g.mode == GHOST_PACING_HOME) {
                        if (ghostCounts[i] >= personalDotLimit[i]()) {
                            g.leaveHome();
                            return;
                        }
                        break;
                    }
                }
            }
            // use global dot counter
            else if (mode == MODE_GLOBAL) {
                if (globalCount == globalDotLimit[PINKY] && pinky.mode == GHOST_PACING_HOME) {
                    pinky.leaveHome();
                    return;
                }
                else if (globalCount == globalDotLimit[INKY] && inky.mode == GHOST_PACING_HOME) {
                    inky.leaveHome();
                    return;
                }
                else if (globalCount == globalDotLimit[CLYDE] && clyde.mode == GHOST_PACING_HOME) {
                    globalCount = 0;
                    mode = MODE_PERSONAL;
                    clyde.leaveHome();
                    return;
                }
            }

            // also use time since last dot was eaten
            if (framesSinceLastDot > getTimeoutLimit()) {
                framesSinceLastDot = 0;
                for (i=1;i<4;i++) {
                    g = ghosts[i];
                    if (g.mode == GHOST_PACING_HOME) {
                        g.leaveHome();
                        break;
                    }
                }
            }
            else
                framesSinceLastDot++;
        },
    };
})();
//////////////////////////////////////////////////////////////////////////////////////
// Elroy Timer

// Determines when to put blinky into faster elroy modes

var elroyTimer = (function(){

    // get the number of dots left that should trigger elroy stage #1 or #2
    var getDotsEatenLimit = (function(){
        var dotsLeft = [
            [20,30,40,40,40,50,50,50,60,60,60,70,70,70,100,100,100,100,120,120,120], // elroy1
            [10,15,20,20,20,25,25,25,30,30,30,40,40,40, 50, 50, 50, 50, 60, 60, 60]]; // elroy2
        return function(stage) {
            var i = level;
            if (i>21) i = 21;
            var pacman_max_pellets = 244;
            return pacman_max_pellets - dotsLeft[stage-1][i-1];
        };
    })();

    // when level restarts, blinky must wait for clyde to leave home before resuming elroy mode
    var waitForClyde;

    var savedWaitForClyde = {};

    // save state at time t
    var save = function(t) {
        savedWaitForClyde[t] = waitForClyde;
    };

    // load state at time t
    var load = function(t) {
        waitForClyde = savedWaitForClyde[t];
    };

    return {
        onNewLevel: function() {
            waitForClyde = false;
        },
        onRestartLevel: function() {
            waitForClyde = true;
        },
        update: function() {

            // stop waiting for clyde when clyde leaves home
            if (waitForClyde && clyde.mode != GHOST_PACING_HOME)
                waitForClyde = false;

            if (waitForClyde) {
                blinky.elroy = 0;
            }
            else {
                if (map.dotsEaten >= getDotsEatenLimit(2)) {
                    blinky.elroy = 2;
                }
                else if (map.dotsEaten >= getDotsEatenLimit(1)) {
                    blinky.elroy = 1;
                }
                else {
                    blinky.elroy = 0;
                }
            }
        },
        save: save,
        load: load,
    };
})();
//////////////////////////////////////////////////////////////////////////////////////
// Energizer

// This handles how long the energizer lasts as well as how long the
// points will display after eating a ghost.

var energizer = (function() {

    // how many seconds to display points when ghost is eaten
    var pointsDuration = 1;

    // how long to stay energized based on current level
    var getDuration = (function(){
        var seconds = [6,5,4,3,2,5,2,2,1,5,2,1,1,3,1,1,0,1];
        return function() {
            var i = level;
            return (i > 18) ? 0 : 60*seconds[i-1];
        };
    })();

    // how many ghost flashes happen near the end of frightened mode based on current level
    var getFlashes = (function(){
        var flashes = [5,5,5,5,5,5,5,5,3,5,5,3,3,5,3,3,0,3];
        return function() {
            var i = level;
            return (i > 18) ? 0 : flashes[i-1];
        };
    })();

    // "The ghosts change colors every 14 game cycles when they start 'flashing'" -Jamey Pittman
    var flashInterval = 14;

    var count;  // how long in frames energizer has been active
    var active; // indicates if energizer is currently active
    var points; // points that the last eaten ghost was worth
    var pointsFramesLeft; // number of frames left to display points earned from eating ghost

    var savedCount = {};
    var savedActive = {};
    var savedPoints = {};
    var savedPointsFramesLeft = {};

    // save state at time t
    var save = function(t) {
        savedCount[t] = count;
        savedActive[t] = active;
        savedPoints[t] = points;
        savedPointsFramesLeft[t] = pointsFramesLeft;
    };

    // load state at time t
    var load = function(t) {
        count = savedCount[t];
        active = savedActive[t];
        points = savedPoints[t];
        pointsFramesLeft = savedPointsFramesLeft[t];
    };

    return {
        save: save,
        load: load,
        reset: function() {
            audio.ghostTurnToBlue.stopLoop();
            count = 0;
            active = false;
            points = 100;
            pointsFramesLeft = 0;
            for (i=0; i<4; i++)
                ghosts[i].scared = false;
        },
        update: function() {
            var i;
            if (active) {
                if (count == getDuration())
                    this.reset();
                else
                    count++;
            }
        },
        activate: function() { 
            audio.ghostNormalMove.stopLoop();
            audio.ghostTurnToBlue.startLoop();
            active = true;
            count = 0;
            points = 100;
            for (i=0; i<4; i++) {
                ghosts[i].onEnergized();
            }
            if (getDuration() == 0) { // if no duration, then immediately reset
                this.reset();
            }
        },
        isActive: function() { return active; },
        isFlash: function() { 
            var i = Math.floor((getDuration()-count)/flashInterval);
            return (i<=2*getFlashes()-1) ? (i%2==0) : false;
        },

        getPoints: function() {
            return points;
        },
        addPoints: function() {
            addScore(points*=2);
            pointsFramesLeft = pointsDuration*60;
        },
        showingPoints: function() { return pointsFramesLeft > 0; },
        updatePointsTimer: function() { if (pointsFramesLeft > 0) pointsFramesLeft--; },
    };
})();
//////////////////////////////////////////////////////////////////////////////////////
// Fruit

var BaseFruit = function() {
    // pixel
    this.pixel = {x:0, y:0};

    this.fruitHistory = {};

    this.scoreDuration = 2; // number of seconds that the fruit score is on the screen
    this.scoreFramesLeft; // frames left until the picked-up fruit score is off the screen
    this.savedScoreFramesLeft = {};
};

BaseFruit.prototype = {
    isScorePresent: function() {
        return this.scoreFramesLeft > 0;
    },
    onNewLevel: function() {
        this.buildFruitHistory();
    },
    setCurrentFruit: function(i) {
        this.currentFruitIndex = i;
    },
    onDotEat: function() {
        if (!this.isPresent() && (map.dotsEaten == this.dotLimit1 || map.dotsEaten == this.dotLimit2)) {
            this.initiate();
        }
    },
    save: function(t) {
        this.savedScoreFramesLeft[t] = this.scoreFramesLeft;
    },
    load: function(t) {
        this.scoreFramesLeft = this.savedScoreFramesLeft[t];
    },
    reset: function() {
        this.scoreFramesLeft = 0;
    },
    getCurrentFruit: function() {
        return this.fruits[this.currentFruitIndex];
    },
    getPoints: function() {
        return this.getCurrentFruit().points;
    },
    update: function() {
        if (this.scoreFramesLeft > 0)
            this.scoreFramesLeft--;
    },
    isCollide: function() {
        return Math.abs(pacman.pixel.y - this.pixel.y) <= midTile.y && Math.abs(pacman.pixel.x - this.pixel.x) <= midTile.x;
    },
    testCollide: function() {
        if (this.isPresent() && this.isCollide()) {
            addScore(this.getPoints());
            audio.silence(true);
            audio.eatingFruit.play();
            setTimeout(ghosts[0].playSounds, 500);
            this.reset();
            this.scoreFramesLeft = this.scoreDuration*60;
        }
    },
};

// PAC-MAN FRUIT

var PacFruit = function() {
    BaseFruit.call(this);
    this.fruits = [
        {name:'cherry',     points:100},
        {name:'strawberry', points:300},
        {name:'orange',     points:500},
        {name:'apple',      points:700},
        {name:'melon',      points:1000},
        {name:'galaxian',   points:2000},
        {name:'bell',       points:3000},
        {name:'key',        points:5000},
    ];

    this.order = [
        0,  // level 1
        1,  // level 2 
        2,  // level 3
        2,  // level 4
        3,  // level 5
        3,  // level 6
        4,  // level 7
        4,  // level 8
        5,  // level 9
        5,  // level 10
        6,  // level 11
        6,  // level 12
        7]; // level 13+

    this.dotLimit1 = 70;
    this.dotLimit2 = 170;

    this.duration = 9; // number of seconds that the fruit is on the screen
    this.framesLeft; // frames left until fruit is off the screen

    this.savedFramesLeft = {};
};

PacFruit.prototype = newChildObject(BaseFruit.prototype, {

    onNewLevel: function() {
        this.setCurrentFruit(this.getFruitIndexFromLevel(level));
        BaseFruit.prototype.onNewLevel.call(this);
    },

    getFruitFromLevel: function(i) {
        return this.fruits[this.getFruitIndexFromLevel(i)];
    },

    getFruitIndexFromLevel: function(i) {
        if (i > 13) {
            i = 13;
        }
        return this.order[i-1];
    },

    buildFruitHistory: function() {
        this.fruitHistory = {};
        var i;
        for (i=1; i<= level; i++) {
            this.fruitHistory[i] = this.fruits[this.getFruitIndexFromLevel(i)];
        }
    },

    initiate: function() {
        var x = 13;
        var y = 20;
        this.pixel.x = tileSize*(1+x)-1;
        this.pixel.y = tileSize*y + midTile.y;
        this.framesLeft = 60*this.duration;
    },

    isPresent: function() {
        return this.framesLeft > 0;
    },

    reset: function() {
        BaseFruit.prototype.reset.call(this);

        this.framesLeft = 0;
    },

    update: function() {
        BaseFruit.prototype.update.call(this);

        if (this.framesLeft > 0)
            this.framesLeft--;
    },

    save: function(t) {
        BaseFruit.prototype.save.call(this,t);
        this.savedFramesLeft[t] = this.framesLeft;
    },
    load: function(t) {
        BaseFruit.prototype.load.call(this,t);
        this.framesLeft = this.savedFramesLeft[t];
    },
});

// MS. PAC-MAN FRUIT

var PATH_ENTER = 0;
var PATH_PEN = 1;
var PATH_EXIT = 2;

var MsPacFruit = function() {
    BaseFruit.call(this);
    this.fruits = [
        {name: 'cherry',     points: 100},
        {name: 'strawberry', points: 200},
        {name: 'orange',     points: 500},
        {name: 'pretzel',    points: 700},
        {name: 'apple',      points: 1000},
        {name: 'pear',       points: 2000},
        {name: 'banana',     points: 5000},
    ];

    this.dotLimit1 = 64;
    this.dotLimit2 = 176;

    this.pen_path = "<<<<<<^^^^^^>>>>>>>>>vvvvvv<<";

    this.savedIsPresent = {};
    this.savedPixel = {};
    this.savedPathMode = {};
    this.savedFrame = {};
    this.savedNumFrames = {};
    this.savedPath = {};
};

MsPacFruit.prototype = newChildObject(BaseFruit.prototype, {

    shouldRandomizeFruit: function() {
        return level > 7;
    },

    getFruitFromLevel: function(i) {
        if (i <= 7) {
            return this.fruits[i-1];
        }
        else {
            return undefined;
        }
    },

    onNewLevel: function() {
        if (!this.shouldRandomizeFruit()) {
            this.setCurrentFruit(level-1);
        }
        else {
            this.setCurrentFruit(0);
        }
        BaseFruit.prototype.onNewLevel.call(this);
    },

    buildFruitHistory: function() {
        this.fruitHistory = {};
        var i;
        for (i=1; i<= Math.max(level,7); i++) {
            this.fruitHistory[i] = this.fruits[i-1];
        }
    },

    reset: function() {
        BaseFruit.prototype.reset.call(this);

        this.frame = 0;
        this.numFrames = 0;
        this.path = undefined;
    },

    initiatePath: function(p) {
        this.frame = 0;
        this.numFrames = p.length*16;
        this.path = p;
    },

    initiate: function() {
        if (this.shouldRandomizeFruit()) {
            this.setCurrentFruit(getRandomInt(0,6));
        }
        var entrances = map.fruitPaths.entrances;
        var e = entrances[getRandomInt(0,entrances.length-1)];
        this.initiatePath(e.path);
        this.pathMode = PATH_ENTER;
        this.pixel.x = e.start.x;
        this.pixel.y = e.start.y;
    },

    isPresent: function() {
        return this.frame < this.numFrames;
    },

    bounceFrames: (function(){
        var U = { dx:0, dy:-1 };
        var D = { dx:0, dy:1 };
        var L = { dx:-1, dy:0 };
        var R = { dx:1, dy:0 };
        var UL = { dx:-1, dy:-1 };
        var UR = { dx:1, dy:-1 };
        var DL = { dx:-1, dy:1 };
        var DR = { dx:1, dy:1 };
        var Z = { dx:0, dy:0 };

        // A 16-frame animation for moving 8 pixels either up, down, left, or right.
        return {
            '^': [U, U, U, U, U, U, U, U, U, Z, U, Z, Z, D, Z, D],
            '>': [Z, UR,Z, R, Z, UR,Z, R, Z, R, Z, R, Z, DR,DR,Z],
            '<': [Z, Z, UL,Z, L, Z, UL,Z, L, Z, L, Z, L, Z, DL,DL],
            'v': [Z, D, D, D, D, D, D, D, D, D, D, D, U, U, Z, U],
        };
    })(),

    move: function() {
        var p = this.path[Math.floor(this.frame/16)]; // get current path frame
        var b = this.bounceFrames[p][this.frame%16]; // get current bounce animation frame
        this.pixel.x += b.dx;
        this.pixel.y += b.dy;
        this.frame++;
    },

    setNextPath: function() {
        if (this.pathMode == PATH_ENTER) {
            this.pathMode = PATH_PEN;
            this.initiatePath(this.pen_path);
        }
        else if (this.pathMode == PATH_PEN) {
            this.pathMode = PATH_EXIT;
            var exits = map.fruitPaths.exits;
            var e = exits[getRandomInt(0,exits.length-1)];
            this.initiatePath(e.path);
        }
        else if (this.pathMode == PATH_EXIT) {
            this.reset();
        }
    },

    update: function() {
        BaseFruit.prototype.update.call(this);

        if (this.isPresent()) {
            this.move();
            if (this.frame == this.numFrames) {
                this.setNextPath();
            }
        }
    },

    save: function(t) {
        BaseFruit.prototype.save.call(this,t);

        this.savedPixel[t] =        this.isPresent() ? {x:this.pixel.x, y:this.pixel.y} : undefined;
        this.savedPathMode[t] =     this.pathMode;
        this.savedFrame[t] =        this.frame;
        this.savedNumFrames[t] =    this.numFrames;
        this.savedPath[t] =         this.path;
    },

    load: function(t) {
        BaseFruit.prototype.load.call(this,t);

        if (this.savedPixel[t]) {
            this.pixel.x =      this.savedPixel[t].x;
            this.pixel.y =      this.savedPixel[t].y;
        }
        this.pathMode =     this.savedPathMode[t];
        this.frame =        this.savedFrame[t];
        this.numFrames =    this.savedNumFrames[t]; 
        this.path =         this.savedPath[t];
    },
});

var fruit;
var setFruitFromGameMode = (function() {
    var pacfruit = new PacFruit();
    var mspacfruit = new MsPacFruit();
    fruit = pacfruit;
    return function() {
        if (gameMode == GAME_PACMAN) {
            fruit = pacfruit;
        }
        else {
            fruit = mspacfruit;
        }
    };
})();
var executive = (function(){

    var framePeriod = 1000/60; // length of each frame at 60Hz (updates per second)
    var gameTime; // virtual time of the last game update

    var paused = false; // flag for pausing the state updates, while still drawing
    var running = false; // flag for truly stopping everything

    /**********/
    // http://paulirish.com/2011/requestanimationframe-for-smart-animating/
    // http://my.opera.com/emoller/blog/2011/12/20/requestanimationframe-for-smart-er-animating

    // requestAnimationFrame polyfill by Erik Möller
    // fixes from Paul Irish and Tino Zijdel

    (function() {
        var lastTime = 0;
        var vendors = ['ms', 'moz', 'webkit', 'o'];
        for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
            window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
            window.cancelAnimationFrame = window[vendors[x]+'CancelAnimationFrame']
                                       || window[vendors[x]+'CancelRequestAnimationFrame'];
        }
     
        if (!window.requestAnimationFrame)
            window.requestAnimationFrame = function(callback, element) {
                var currTime = new Date().getTime();
                var timeToCall = Math.max(0, 16 - (currTime - lastTime));
                var id = window.setTimeout(function() { callback(currTime + timeToCall); },
                  timeToCall);
                lastTime = currTime + timeToCall;
                return id;
            };
     
        if (!window.cancelAnimationFrame)
            window.cancelAnimationFrame = function(id) {
                clearTimeout(id);
            };
    }());
    /**********/

    var fps;
    var updateFps = (function(){
        // TODO: fix this to reflect the average rate of the last n frames, where 0 < n < 60
        var length = 60;
        var times = [];
        var startIndex = 0;
        var endIndex = -1;
        var filled = false;

        return function(now) {
            if (filled) {
                startIndex = (startIndex+1) % length;
            }
            endIndex = (endIndex+1) % length;
            if (endIndex == length-1) {
                filled = true;
            }

            times[endIndex] = now;

            var seconds = (now - times[startIndex]) / 1000;
            var frames = endIndex - startIndex;
            if (frames < 0) {
                frames += length;
            }
            fps = frames / seconds;
        };
    })();
        

    var reqFrame; // id of requestAnimationFrame object
    var tick = function(now) {
        if (gameTime == undefined) {
            gameTime = now;
        }

        // Update fps counter.
        updateFps(now);

        // Control frame-skipping by only allowing gameTime to lag behind the current time by some amount.
        var maxFrameSkip = 3;
        gameTime = Math.max(gameTime, now-maxFrameSkip*framePeriod);

        // Prevent any updates from being called when paused.
        if (paused || inGameMenu.isOpen()) {
            gameTime = now;
        }

        hud.update();

        // Update the game until the gameTime surpasses the current time.
        while (gameTime < now) {
            state.update();
            gameTime += framePeriod;
        }

        // Draw.
        renderer.beginFrame();
        state.draw();
        if (hud.isValidState()) {
            renderer.renderFunc(hud.draw);
        }
        renderer.endFrame();

        // Schedule the next tick.
        reqFrame = requestAnimationFrame(tick);
    };

    return {

        getFramePeriod: function() {
            return framePeriod;
        },
        setUpdatesPerSecond: function(ups) {
            framePeriod = 1000/ups;
            //gameTime = undefined;
            vcr.onFramePeriodChange();
        },
        init: function() {
            var that = this;
            window.addEventListener('focus', function() {that.start();});
            window.addEventListener('blur', function() {that.stop();});
            this.start();
        },
        start: function() {
            if (!running) {
                reqFrame = requestAnimationFrame(tick);
                running = true;
            }
        },
        stop: function() {
            if (running) {
                cancelAnimationFrame(reqFrame);
                running = false;
            }
        },
        togglePause: function() { paused = !paused; },
        isPaused: function() { return paused; },
        getFps: function() { return fps; },
    };
})();
//////////////////////////////////////////////////////////////////////////////////////
// States
// (main loops for each state of the game)
// state is set to any of these states, each containing an init(), draw(), and update()

// current game state
var state;

// switches to another game state
var switchState = function(nextState,fadeDuration, continueUpdate1, continueUpdate2) {
    state = (fadeDuration) ? fadeNextState(state,nextState,fadeDuration,continueUpdate1, continueUpdate2) : nextState;
    audio.silence();
    state.init();
    if (executive.isPaused()) {
        executive.togglePause();
    }
};

//////////////////////////////////////////////////////////////////////////////////////
// Fade state

// Creates a state that will fade from a given state to another in the given amount of time.
// if continueUpdate1 is true, then prevState.update will be called while fading out
// if continueUpdate2 is true, then nextState.update will be called while fading in
var fadeNextState = function (prevState, nextState, frameDuration, continueUpdate1, continueUpdate2) {
    var frames;
    var midFrame = Math.floor(frameDuration/2);
    var inFirstState = function() { return frames < midFrame; };
    var getStateTime = function() { return frames/frameDuration*2 + (inFirstState() ? 0 : -1); };
    var initialized = false;

    return {
        init: function() {
            frames = 0;
            initialized = true;
        },
        draw: function() {
            if (!initialized) return;
            var t = getStateTime();
            if (frames < midFrame) {
                if (prevState) {
                    prevState.draw();
                    renderer.setOverlayColor("rgba(0,0,0,"+t+")");
                }
            }
            else if (frames > midFrame) {
                nextState.draw();
                renderer.setOverlayColor("rgba(0,0,0,"+(1-t)+")");
            }
        },
        update: function() {

            // update prevState
            if (frames < midFrame) {
                if (continueUpdate1) {
                    prevState.update();
                }
            }
            // change to nextState
            else if (frames == midFrame) {
                nextState.init();
            }
            // update nextState
            else if (frames < frameDuration) {
                if (continueUpdate2) {
                    nextState.update();
                }
            }
            // hand over state to nextState
            else {
                state = nextState;
                initialized = false;
            }

            frames++;
        },
    }
};

//////////////////////////////////////////////////////////////////////////////////////
// Home State
// (the home title screen state)

var homeState = (function(){

    var exitTo = function(s) {
        switchState(s);
        menu.disable();
    };

    var menu = new Menu("",2*tileSize,19*tileSize,mapWidth-4*tileSize,3*tileSize,tileSize,tileSize+"px ArcadeR", "#EEE");
    var frames = 0;
    var getIconAnimFrame = function(frame) {
        frame = Math.floor(frame/3)+1;
        frame %= 4;
        if (frame == 3) {
            frame = 1;
        }
        return frame;
    };
    menu.addTextIconButton("PLAY",
        function() {
            gameMode = GAME_PACMAN;
            exitTo(preNewGameState);
        },
        function(ctx,x,y,frame) {
            atlas.drawPacmanSprite(ctx,x,y,DIR_RIGHT,getIconAnimFrame(frame));
        });
    menu.addTextIconButton("LEARN",
        function() {
            exitTo(learnState);
        },
        function(ctx,x,y,frame) {
            atlas.drawGhostSprite(ctx,x,y,Math.floor(frame/8)%2,DIR_RIGHT,false,false,false,blinky.color);
        });

    var drawTitle = function(ctx) {
        var words = [["FUZE ","#FFFF00"],["VS ","#FFFFFF"],["AYWEN","#FF0000"]];
        var size = Math.floor(tileSize*1.75);
        ctx.font = size+"px ArcadeR";
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        var total = 0;
        var i;
        for (i=0; i<words.length; i++) {
            total += ctx.measureText(words[i][0]).width;
        }
        var x = mapWidth/2 - total/2;
        var y = 4*tileSize;
        for (i=0; i<words.length; i++) {
            ctx.fillStyle = words[i][1];
            ctx.fillText(words[i][0], x, y);
            x += ctx.measureText(words[i][0]).width;
        }

        var chomp = [0, Math.PI/6, Math.PI/3, Math.PI/6][Math.floor(frames/6)%4];
        drawPacmanSprite(ctx, mapWidth/2-7*tileSize, 10*tileSize, DIR_RIGHT, chomp, 0, 3);

        ctx.font = (2*tileSize)+"px ArcadeR";
        ctx.textAlign = "center";
        ctx.fillStyle = "#FFF";
        ctx.fillText("VS", mapWidth/2, 10*tileSize);

        ctx.save();
        ctx.translate(mapWidth/2+7*tileSize, 10*tileSize);
        ctx.scale(3,3);
        drawGhostSprite(ctx, 0, 0, Math.floor(frames/8)%2, DIR_LEFT, false, false, false, blinky.color);
        ctx.restore();

        var colors = [blinky.color, pinky.color, inky.color, clyde.color];
        for (i=0; i<4; i++) {
            ctx.save();
            ctx.translate(mapWidth/2 + (i-1.5)*5*tileSize, 16*tileSize);
            ctx.scale(1.4,1.4);
            var scared = Math.floor(frames/90)%2 == 1;
            drawGhostSprite(ctx, 0, 0, Math.floor((frames+i*4)/8)%2, DIR_LEFT, scared, scared && Math.floor(frames/10)%2 == 0, false, colors[i]);
            ctx.restore();
        }

        ctx.font = tileSize+"px ArcadeR";
        ctx.textAlign = "center";
        ctx.fillStyle = "#888";
        ctx.fillText("ARROWS / ZQSD", mapWidth/2, 31*tileSize);
        ctx.fillText("ESC TO QUIT", mapWidth/2, 33*tileSize);
    };

    return {
        init: function() {
            menu.enable();
            audio.coffeeBreakMusic.startLoop();
        },
        draw: function() {
            renderer.clearMapFrame();
            renderer.beginMapClip();
            renderer.renderFunc(drawTitle);
            renderer.renderFunc(menu.draw,menu);
            renderer.endMapClip();
        },
        update: function() {
            frames++;
            menu.update();
        },
        getMenu: function() {
            return menu;
        },
    };

})();

//////////////////////////////////////////////////////////////////////////////////////
// Learn State

var learnState = (function(){

    var exitTo = function(s) {
        switchState(s);
        menu.disable();
        forEachCharBtn(function (btn) {
            btn.disable();
        });
        setAllVisibility(true);
        clearCheats();
    };

    var menu = new Menu("LEARN", 2*tileSize,-tileSize,mapWidth-4*tileSize,3*tileSize,tileSize,tileSize+"px ArcadeR", "#EEE");
    menu.addSpacer(7);
    menu.addTextButton("BACK",
        function() {
            exitTo(homeState);
        });
    menu.backButton = menu.buttons[menu.buttonCount-1];
    menu.noArrowKeys = true;

    var pad = tileSize;
    var w = 30;
    var h = 30;
    var x = mapWidth/2 - 2*(w) - 1.5*pad;
    var y = 4*tileSize;
    var redBtn = new Button(x,y,w,h,function(){
        setAllVisibility(false);
        blinky.isVisible = true;
        setVisibility(blinky,true);
    });
    redBtn.setIcon(function (ctx,x,y,frame) {
        getGhostDrawFunc()(ctx,x,y,Math.floor(frame/6)%2,DIR_DOWN,undefined,undefined,undefined,blinky.color);
    });
    x += w+pad;
    var pinkBtn = new Button(x,y,w,h,function(){
        setAllVisibility(false);
        setVisibility(pinky,true);
    });
    pinkBtn.setIcon(function (ctx,x,y,frame) {
        getGhostDrawFunc()(ctx,x,y,Math.floor(frame/6)%2,DIR_DOWN,undefined,undefined,undefined,pinky.color);
    });
    x += w+pad;
    var cyanBtn = new Button(x,y,w,h,function(){
        setAllVisibility(false);
        setVisibility(inky,true);
    });
    cyanBtn.setIcon(function (ctx,x,y,frame) {
        getGhostDrawFunc()(ctx,x,y,Math.floor(frame/6)%2,DIR_DOWN,undefined,undefined,undefined,inky.color);
    });
    x += w+pad;
    var orangeBtn = new Button(x,y,w,h,function(){
        setAllVisibility(false);
        setVisibility(clyde,true);
    });
    orangeBtn.setIcon(function (ctx,x,y,frame) {
        getGhostDrawFunc()(ctx,x,y,Math.floor(frame/6)%2,DIR_DOWN,undefined,undefined,undefined,clyde.color);
    });
    var forEachCharBtn = function(callback) {
        callback(redBtn);
        callback(pinkBtn);
        callback(cyanBtn);
        callback(orangeBtn);
    };

    var setVisibility = function(g,visible) {
        g.isVisible = g.isDrawTarget = g.isDrawPath = visible;
    };

    var setAllVisibility = function(visible) {
        setVisibility(blinky,visible);
        setVisibility(pinky,visible);
        setVisibility(inky,visible);
        setVisibility(clyde,visible);
    };

    return {
        init: function() {

            menu.enable();
            forEachCharBtn(function (btn) {
                btn.enable();
            });

            // set map
            map = mapLearn;
            renderer.drawMap();

            // set game parameters
            level = 1;
            practiceMode = false;
            turboMode = false;
            gameMode = GAME_PACMAN;

            // reset relevant game state
            ghostCommander.reset();
            energizer.reset();
            ghostCommander.setCommand(GHOST_CMD_CHASE);
            ghostReleaser.onNewLevel();
            elroyTimer.onNewLevel();

            // set ghost states
            for (i=0; i<4; i++) {
                var a = actors[i];
                a.reset();
                a.mode = GHOST_OUTSIDE;
            }
            blinky.setPos(14*tileSize-1, 13*tileSize+midTile.y);
            pinky.setPos(15*tileSize+midTile.x, 13*tileSize+midTile.y);
            inky.setPos(9*tileSize+midTile.x, 16*tileSize+midTile.y);
            clyde.setPos(18*tileSize+midTile.x, 16*tileSize+midTile.y);

            // set pacman state
            pacman.reset();
            pacman.setPos(14*tileSize-1,22*tileSize+midTile.y);

            // start with red ghost
            redBtn.onclick();

        },
        draw: function() {
            renderer.blitMap();
            renderer.renderFunc(menu.draw,menu);
            forEachCharBtn(function (btn) {
                renderer.renderFunc(btn.draw,btn);
            });
            renderer.beginMapClip();
            renderer.drawPaths();
            renderer.drawActors();
            renderer.drawTargets();
            renderer.endMapClip();
        },
        update: function() {
            menu.update();
            forEachCharBtn(function (btn) {
                btn.update();
            });
            var i,j;
            for (j=0; j<2; j++) {
                pacman.update(j);
                for (i=0;i<4;i++) {
                    actors[i].update(j);
                }
            }
            for (i=0; i<5; i++)
                actors[i].frames++;
        },
        getMenu: function() {
            return menu;
        },
    };

})();

//////////////////////////////////////////////////////////////////////////////////////
// Game Title
// (provides functions for managing the game title with clickable player and enemies below it)

var gameTitleState = (function() {

    var name,nameColor;

    var resetTitle = function() {
        if (yellowBtn.isSelected) {
            name = getGameName();
            nameColor = gameMode == GAME_COOKIE ? "#47b8ff" : pacman.color;
        }
        else if (redBtn.isSelected) {
            name = getGhostNames()[0];
            nameColor = blinky.color;
        }
        else if (pinkBtn.isSelected) {
            name = getGhostNames()[1];
            nameColor = pinky.color;
        }
        else if (cyanBtn.isSelected) {
            name = getGhostNames()[2];
            nameColor = inky.color;
        }
        else if (orangeBtn.isSelected) {
            name = getGhostNames()[3];
            nameColor = clyde.color;
        }
        else {
            name = getGameName();
            nameColor = "#FFF";
        }
    };

    var w = 20;
    var h = 30;
    var x = mapWidth/2 - 3*w;
    var y = 3*tileSize;
    var yellowBtn = new Button(x,y,w,h,function() {
        if (gameMode == GAME_MSPACMAN) {
            gameMode = GAME_OTTO;
        }
        else if (gameMode == GAME_OTTO) {
            gameMode = GAME_MSPACMAN;
        }
    });
    yellowBtn.setIcon(function (ctx,x,y,frame) {
        getPlayerDrawFunc()(ctx,x,y,DIR_RIGHT,pacman.getAnimFrame(pacman.getStepFrame(Math.floor((gameMode==GAME_PACMAN?frame+4:frame)/1.5))),true);
    });

    x += 2*w;
    var redBtn = new Button(x,y,w,h);
    redBtn.setIcon(function (ctx,x,y,frame) {
        getGhostDrawFunc()(ctx,x,y,Math.floor(frame/6)%2,DIR_LEFT,undefined,undefined,undefined,blinky.color);
    });

    x += w;
    var pinkBtn = new Button(x,y,w,h);
    pinkBtn.setIcon(function (ctx,x,y,frame) {
        getGhostDrawFunc()(ctx,x,y,Math.floor(frame/6)%2,DIR_LEFT,undefined,undefined,undefined,pinky.color);
    });

    x += w;
    var cyanBtn = new Button(x,y,w,h)
    cyanBtn.setIcon(function (ctx,x,y,frame) {
        getGhostDrawFunc()(ctx,x,y,Math.floor(frame/6)%2,DIR_LEFT,undefined,undefined,undefined,inky.color);
    });

    x += w;
    var orangeBtn = new Button(x,y,w,h);
    orangeBtn.setIcon(function (ctx,x,y,frame) {
        getGhostDrawFunc()(ctx,x,y,Math.floor(frame/6)%2,DIR_LEFT,undefined,undefined,undefined,clyde.color);
    });
    
    var forEachCharBtn = function(callback) {
        callback(yellowBtn);
        callback(redBtn);
        callback(pinkBtn);
        callback(cyanBtn);
        callback(orangeBtn);
    };
    forEachCharBtn(function(btn) {
        btn.borderBlurColor = btn.borderFocusColor = "#000";
    });

    return {
        init: function() {
            resetTitle();
            forEachCharBtn(function (btn) {
                btn.enable();
            });
        },
        shutdown: function() {
            forEachCharBtn(function (btn) {
                btn.disable();
            });
        },
        draw: function() {
            forEachCharBtn(function (btn) {
                renderer.renderFunc(btn.draw,btn);
            });

            resetTitle();
            renderer.renderFunc(function(ctx){
                ctx.font = tileSize+"px ArcadeR";
                ctx.fillStyle = nameColor;
                ctx.textAlign = "center";
                ctx.textBaseline = "top";
                ctx.fillText(name, mapWidth/2, tileSize);
            });
        },
        update: function() {
            forEachCharBtn(function (btn) {
                btn.update();
            });
        },
        getYellowBtn: function() {
            return yellowBtn;
        },
    };

})();

//////////////////////////////////////////////////////////////////////////////////////
// Pre New Game State
// (the main menu for the currently selected game)

var preNewGameState = (function() {

    var exitTo = function(s,fade) {
        gameTitleState.shutdown();
        menu.disable();
        switchState(s,fade);
    };

    var menu = new Menu("",2*tileSize,0,mapWidth-4*tileSize,3*tileSize,tileSize,tileSize+"px ArcadeR", "#EEE");

    menu.addSpacer(2);
    menu.addTextButton("PLAY",
        function() { 
            practiceMode = false;
            turboMode = false;
            newGameState.setStartLevel(1);
            exitTo(newGameState, 60);
        });
    menu.addTextButton("PLAY TURBO",
        function() { 
            practiceMode = false;
            turboMode = true;
            newGameState.setStartLevel(1);
            exitTo(newGameState, 60);
        });
    menu.addTextButton("PRACTICE",
        function() { 
            practiceMode = true;
            turboMode = false;
            exitTo(selectActState);
        });
    menu.addSpacer(0.5);
    menu.addTextButton("CUTSCENES",
        function() { 
            exitTo(cutSceneMenuState);
        });
    menu.addTextButton("ABOUT",
        function() { 
            exitTo(aboutGameState);
        });
    menu.addSpacer(0.5);
    menu.addTextButton("BACK",
        function() {
            exitTo(homeState);
        });
    menu.backButton = menu.buttons[menu.buttonCount-1];

    return {
        init: function() {
            audio.startMusic.play();
            menu.enable();
            gameTitleState.init();
            map = undefined;
        },
        draw: function() {
            renderer.clearMapFrame();
            renderer.renderFunc(menu.draw,menu);
            gameTitleState.draw();
        },
        update: function() {
            gameTitleState.update();
        },
        getMenu: function() {
            return menu;
        },
    };
})();

//////////////////////////////////////////////////////////////////////////////////////
// Select Act State

var selectActState = (function() {

    // TODO: create ingame menu option to return to this menu (with last act played present)

    var menu;
    var numActs = 4;
    var defaultStartAct = 1;
    var startAct = defaultStartAct;

    var exitTo = function(state,fade) {
        gameTitleState.shutdown();
        menu.disable();
        switchState(state,fade);
    };

    var chooseLevelFromAct = function(act) {
        selectLevelState.setAct(act);
        exitTo(selectLevelState);
    };

    var scrollToAct = function(act) {
        // just rebuild the menu
        selectActState.setStartAct(act);
        exitTo(selectActState);
    };

    var drawArrow = function(ctx,x,y,dir) {
        ctx.save();
        ctx.translate(x,y);
        ctx.scale(1,dir);
        ctx.beginPath();
        ctx.moveTo(0,-tileSize/2);
        ctx.lineTo(tileSize,tileSize/2);
        ctx.lineTo(-tileSize,tileSize/2);
        ctx.closePath();
        ctx.fillStyle = "#FFF";
        ctx.fill();
        ctx.restore();
    };

    var buildMenu = function(act) {
        // set buttons starting at the given act
        startAct = act;

        menu = new Menu("",2*tileSize,0,mapWidth-4*tileSize,3*tileSize,tileSize,tileSize+"px ArcadeR", "#EEE");
        var i;
        var range;
        menu.addSpacer(2);
        menu.addIconButton(
            function(ctx,x,y) {
                drawArrow(ctx,x,y,1);
            },
            function() {
                scrollToAct(Math.max(1,act-numActs));
            });
        for (i=0; i<numActs; i++) {
            range = getActRange(act+i);
            menu.addTextIconButton("LEVELS "+range[0]+"-"+range[1],
                (function(j){
                    return function() { 
                        chooseLevelFromAct(act+j);
                    };
                })(i),
                (function(j){
                    return function(ctx,x,y) {
                        var s = tileSize/3*2;
                        var r = tileSize/6;
                        ctx.save();
                        ctx.translate(x,y);
                        ctx.beginPath();
                        ctx.moveTo(-s,0);
                        ctx.lineTo(-s,-r);
                        ctx.quadraticCurveTo(-s,-s,-r,-s);
                        ctx.lineTo(r,-s);
                        ctx.quadraticCurveTo(s,-s,s,-r);
                        ctx.lineTo(s,r);
                        ctx.quadraticCurveTo(s,s,r,s);
                        ctx.lineTo(-r,s);
                        ctx.quadraticCurveTo(-s,s,-s,r);
                        ctx.closePath();
                        var colors = getActColor(act+j);
                        ctx.fillStyle = colors.wallFillColor;
                        ctx.strokeStyle = colors.wallStrokeColor;
                        ctx.fill();
                        ctx.stroke();
                        ctx.restore();
                    };
                })(i));
        }
        menu.addIconButton(
            function(ctx,x,y) {
                drawArrow(ctx,x,y,-1);
            },
            function() {
                scrollToAct(act+numActs);
            });
        menu.addTextButton("BACK",
            function() {
                exitTo(preNewGameState);
            });
        menu.backButton = menu.buttons[menu.buttonCount-1];
        menu.enable();
    };

    return {
        init: function() {
            buildMenu(startAct);
            gameTitleState.init();
        },
        setStartAct: function(act) {
            startAct = act;
        },
        draw: function() {
            renderer.clearMapFrame();
            renderer.renderFunc(menu.draw,menu);
            gameTitleState.draw();
        },
        update: function() {
            gameTitleState.update();
        },
        getMenu: function() {
            return menu;
        },
    };
})();

//////////////////////////////////////////////////////////////////////////////////////
// Select Level State

var selectLevelState = (function() {

    var menu;
    var act = 1;

    var exitTo = function(state,fade) {
        gameTitleState.shutdown();
        menu.disable();
        switchState(state,fade);
    };

    var playLevel = function(i) {
        // TODO: set level (will have to set up fruit history correctly)
        newGameState.setStartLevel(i);
        exitTo(newGameState, 60);
    };

    var buildMenu = function(act) {
        var range = getActRange(act);

        menu = new Menu("",2*tileSize,0,mapWidth-4*tileSize,3*tileSize,tileSize,tileSize+"px ArcadeR", "#EEE");
        var i;
        menu.addSpacer(2);
        if (range[0] < range[1]) {
            for (i=range[0]; i<=range[1]; i++) {
                menu.addTextIconButton("LEVEL "+i,
                    (function(j){
                        return function() { 
                            playLevel(j);
                        };
                    })(i),
                    (function(j){
                        return function(ctx,x,y) {
                            var f = fruit.getFruitFromLevel(j);
                            if (f) {
                                atlas.drawFruitSprite(ctx,x,y,f.name);
                            }
                        };
                    })(i));
            }
        }
        menu.addSpacer(0.5);
        menu.addTextButton("BACK",
            function() {
                exitTo(selectActState);
            });
        menu.backButton = menu.buttons[menu.buttonCount-1];
        menu.enable();
    };

    return {
        init: function() {
            setFruitFromGameMode();
            buildMenu(act);
            gameTitleState.init();
        },
        setAct: function(a) {
            act = a;
        },
        draw: function() {
            renderer.clearMapFrame();
            renderer.renderFunc(menu.draw,menu);
            gameTitleState.draw();
        },
        update: function() {
            gameTitleState.update();
        },
        getMenu: function() {
            return menu;
        },
    };
})();

//////////////////////////////////////////////////////////////////////////////////////
// About Game State
// (the screen shows some information about the game)

var aboutGameState = (function() {

    var exitTo = function(s,fade) {
        gameTitleState.shutdown();
        menu.disable();
        switchState(s,fade);
    };

    var menu = new Menu("",2*tileSize,0,mapWidth-4*tileSize,3*tileSize,tileSize,tileSize+"px ArcadeR", "#EEE");

    menu.addSpacer(8);
    menu.addTextButton("BACK",
        function() {
            exitTo(preNewGameState);
        });
    menu.backButton = menu.buttons[menu.buttonCount-1];

    var desc;
    var numDescLines;

    var drawDesc = function(ctx){
        ctx.font = tileSize+"px ArcadeR";
        ctx.fillStyle = "#FFF";
        ctx.textBaseline = "top";
        ctx.textAlign = "center";
        var y = 12*tileSize;
        var i;
        for (i=0; i<numDescLines; i++) {
            ctx.fillText(desc[i],14*tileSize,y+i*2*tileSize);
        }
    };

    return {
        init: function() {
            menu.enable();
            gameTitleState.init();
        },
        draw: function() {
            renderer.clearMapFrame();
            renderer.renderFunc(menu.draw,menu);
            gameTitleState.draw();
            desc = getGameDescription();
            numDescLines = desc.length;
            renderer.renderFunc(drawDesc);
        },
        update: function() {
            gameTitleState.update();
        },
        getMenu: function() {
            return menu;
        },
    };
})();

//////////////////////////////////////////////////////////////////////////////////////
// Cut Scene Menu State
// (the screen that shows a list of the available cutscenes for the current game)

var cutSceneMenuState = (function() {

    var exitTo = function(s,fade) {
        gameTitleState.shutdown();
        menu.disable();
        switchState(s,fade);
    };

    var exitToCutscene = function(s) {
        if (s) {
            gameTitleState.shutdown();
            menu.disable();
            playCutScene(s,cutSceneMenuState);
        }
    };

    var menu = new Menu("",2*tileSize,0,mapWidth-4*tileSize,3*tileSize,tileSize,tileSize+"px ArcadeR", "#EEE");

    menu.addSpacer(2);
    menu.addTextButton("CUTSCENE 1",
        function() { 
            exitToCutscene(cutscenes[gameMode][0]);
        });
    menu.addTextButton("CUTSCENE 2",
        function() { 
            exitToCutscene(cutscenes[gameMode][1]);
        });
    menu.addTextButton("CUTSCENE 3",
        function() { 
            exitToCutscene(cutscenes[gameMode][2]);
        });
    menu.addSpacer();
    menu.addTextButton("BACK",
        function() {
            exitTo(preNewGameState);
        });
    menu.backButton = menu.buttons[menu.buttonCount-1];

    return {
        init: function() {
            menu.enable();
            gameTitleState.init();
            level = 0;
        },
        draw: function() {
            renderer.clearMapFrame();
            renderer.renderFunc(menu.draw,menu);
            gameTitleState.draw();
        },
        update: function() {
            gameTitleState.update();
        },
        getMenu: function() {
            return menu;
        },
    };
})();

//////////////////////////////////////////////////////////////////////////////////////
// Score State
// (the high score screen state)

var scoreState = (function(){

    var exitTo = function(s) {
        switchState(s);
        menu.disable();
    };

    var menu = new Menu("", 2*tileSize,mapHeight-6*tileSize,mapWidth-4*tileSize,3*tileSize,tileSize,tileSize+"px ArcadeR", "#EEE");
    menu.addTextButton("BACK",
        function() {
            exitTo(homeState);
        });
    menu.backButton = menu.buttons[menu.buttonCount-1];

    var frame = 0;

    var bulbs = {};
    var numBulbs;
    (function(){
        var x = -1.5*tileSize;
        var y = -1*tileSize;
        var w = 18*tileSize;
        var h = 29*tileSize;
        var s = 3;

        var i=0;
        var x0 = x;
        var y0 = y;
        var addBulb = function(x,y) { bulbs[i++] = { x:x, y:y }; };
        for (; y0<y+h; y0+=s) { addBulb(x0,y0); }
        for (; x0<x+w; x0+=s) { addBulb(x0,y0); }
        for (; y0>y; y0-=s) { addBulb(x0,y0); }
        for (; x0>x; x0-=s) { addBulb(x0,y0); }

        numBulbs = i;
    })();

    var drawScoreBox = function(ctx) {

        // draw chaser lights around the marquee
        ctx.fillStyle = "#555";
        var i,b,s=2;
        for (i=0; i<numBulbs; i++) {
            b = bulbs[i];
            ctx.fillRect(b.x, b.y, s, s);
        }
        ctx.fillStyle = "#FFF";
        for (i=0; i<63; i++) {
            b = bulbs[(i*4+Math.floor(frame/2))%numBulbs];
            ctx.fillRect(b.x, b.y, s, s);
        }

        ctx.font = tileSize+"px ArcadeR";
        ctx.textBaseline = "top";
        ctx.textAlign = "right";
        var scoreColor = "#AAA";
        var captionColor = "#444";

        var x,y;
        x = 9*tileSize;
        y = 0;
        ctx.fillStyle = "#FFF"; ctx.fillText("HIGH SCORES", x+4*tileSize,y);
        y += tileSize*4;

        var drawContrails = function(x,y) {
            ctx.lineWidth = 1.0;
            ctx.lineCap = "round";
            ctx.strokeStyle = "rgba(255,255,255,0.5)";

            ctx.save();
            ctx.translate(-2.5,0);

            var dy;
            for (dy=-4; dy<=4; dy+=2) {
                ctx.beginPath();
                ctx.moveTo(x+tileSize,y+dy);
                ctx.lineTo(x+tileSize*(Math.random()*0.5+1.5),y+dy);
                ctx.stroke();
            }
            ctx.restore();

        };

        ctx.fillStyle = scoreColor; ctx.fillText(highScores[0], x,y);
        atlas.drawPacmanSprite(ctx,x+2*tileSize,y+tileSize/2,DIR_LEFT,1);
        y += tileSize*2;
        ctx.fillStyle = scoreColor; ctx.fillText(highScores[1], x,y);
        drawContrails(x+2*tileSize,y+tileSize/2);
        atlas.drawPacmanSprite(ctx,x+2*tileSize,y+tileSize/2,DIR_LEFT,1);

        y += tileSize*3;
        ctx.fillStyle = scoreColor; ctx.fillText(highScores[2], x,y);
        atlas.drawMsPacmanSprite(ctx,x+2*tileSize,y+tileSize/2,DIR_LEFT,1);
        y += tileSize*2;
        ctx.fillStyle = scoreColor; ctx.fillText(highScores[3], x,y);
        drawContrails(x+2*tileSize,y+tileSize/2);
        atlas.drawMsPacmanSprite(ctx,x+2*tileSize,y+tileSize/2,DIR_LEFT,1);

        y += tileSize*3;
        ctx.fillStyle = scoreColor; ctx.fillText(highScores[6], x,y);
        atlas.drawOttoSprite(ctx,x+2*tileSize,y+tileSize/2,DIR_LEFT,0);
        y += tileSize*2;
        ctx.fillStyle = scoreColor; ctx.fillText(highScores[7], x,y);
        drawContrails(x+2*tileSize,y+tileSize/2);
        atlas.drawOttoSprite(ctx,x+2*tileSize,y+tileSize/2,DIR_LEFT,0);

        y += tileSize*3;
        ctx.fillStyle = scoreColor; ctx.fillText(highScores[4], x,y);
        atlas.drawCookiemanSprite(ctx,x+2*tileSize,y+tileSize/2,DIR_LEFT,1);
        y += tileSize*2;
        ctx.fillStyle = scoreColor; ctx.fillText(highScores[5], x,y);
        drawContrails(x+2*tileSize,y+tileSize/2);
        atlas.drawCookiemanSprite(ctx,x+2*tileSize,y+tileSize/2,DIR_LEFT,1);
    };

    var drawFood = function(ctx) {
        ctx.globalAlpha = 0.5;
        ctx.font = tileSize + "px sans-serif";
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";

        var x = 20*tileSize;
        var y = 0;

        ctx.fillStyle = "#ffb8ae";
        ctx.fillRect(x-1,y-1.5,2,2);
        ctx.fillStyle = "#FFF";
        ctx.fillText("10",x+tileSize,y);
        y += 1.5*tileSize;

        ctx.fillStyle = "#ffb8ae";
        ctx.beginPath();
        ctx.arc(x,y-0.5,tileSize/2,0,Math.PI*2);
        ctx.fill();
        ctx.fillStyle = "#FFF";
        ctx.fillText("50",x+tileSize,y);

        y += 3*tileSize;
        atlas.drawGhostSprite(ctx,x,y,0,DIR_RIGHT,true);
        atlas.drawGhostPoints(ctx,x+2*tileSize,y,200);

        var alpha = ctx.globalAlpha;

        y += 2*tileSize;
        ctx.globalAlpha = alpha*0.5;
        atlas.drawGhostSprite(ctx,x,y,0,DIR_RIGHT,true);
        ctx.globalAlpha = alpha;
        atlas.drawGhostSprite(ctx,x+2*tileSize,y,0,DIR_RIGHT,true);
        atlas.drawGhostPoints(ctx,x+4*tileSize,y,400);

        y += 2*tileSize;
        ctx.globalAlpha = alpha*0.5;
        atlas.drawGhostSprite(ctx,x,y,0,DIR_RIGHT,true);
        atlas.drawGhostSprite(ctx,x+2*tileSize,y,0,DIR_RIGHT,true);
        ctx.globalAlpha = alpha;
        atlas.drawGhostSprite(ctx,x+4*tileSize,y,0,DIR_RIGHT,true);
        atlas.drawGhostPoints(ctx,x+6*tileSize,y,800);

        y += 2*tileSize;
        ctx.globalAlpha = alpha*0.5;
        atlas.drawGhostSprite(ctx,x,y,0,DIR_RIGHT,true);
        atlas.drawGhostSprite(ctx,x+2*tileSize,y,0,DIR_RIGHT,true);
        atlas.drawGhostSprite(ctx,x+4*tileSize,y,0,DIR_RIGHT,true);
        ctx.globalAlpha = alpha;
        atlas.drawGhostSprite(ctx,x+6*tileSize,y,0,DIR_RIGHT,true);
        atlas.drawGhostPoints(ctx,x+8*tileSize,y,1600);

        var mspac_fruits = [
            {name: 'cherry',     points: 100},
            {name: 'strawberry', points: 200},
            {name: 'orange',     points: 500},
            {name: 'pretzel',    points: 700},
            {name: 'apple',      points: 1000},
            {name: 'pear',       points: 2000},
            {name: 'banana',     points: 5000},
        ];

        var pac_fruits = [
            {name:'cherry',     points:100},
            {name:'strawberry', points:300},
            {name:'orange',     points:500},
            {name:'apple',      points:700},
            {name:'melon',      points:1000},
            {name:'galaxian',   points:2000},
            {name:'bell',       points:3000},
            {name:'key',        points:5000},
        ];

        var i,f;
        y += 3*tileSize;
        for (i=0; i<pac_fruits.length; i++) {
            f = pac_fruits[i];
            atlas.drawFruitSprite(ctx,x,y,f.name);
            atlas.drawPacFruitPoints(ctx,x+2*tileSize,y,f.points);
            y += 2*tileSize;
        }
        x += 6*tileSize;
        y = 13.5*tileSize;
        for (i=0; i<mspac_fruits.length; i++) {
            f = mspac_fruits[i];
            atlas.drawFruitSprite(ctx,x,y,f.name);
            atlas.drawMsPacFruitPoints(ctx,x+2*tileSize,y,f.points);
            y += 2*tileSize;
        }
        ctx.globalAlpha = 1;
    };

    return {
        init: function() {
            menu.enable();
        },
        draw: function() {
            renderer.clearMapFrame();
            renderer.renderFunc(drawScoreBox);
            renderer.renderFunc(drawFood);
            renderer.renderFunc(menu.draw,menu);
        },
        update: function() {
            menu.update();
            frame++;
        },
        getMenu: function() {
            return menu;
        },
    };

})();

//////////////////////////////////////////////////////////////////////////////////////
// About State
// (the about screen state)

var aboutState = (function(){

    var exitTo = function(s) {
        switchState(s);
        menu.disable();
    };

    var menu = new Menu("", 2*tileSize,mapHeight-11*tileSize,mapWidth-4*tileSize,3*tileSize,tileSize,tileSize+"px ArcadeR", "#EEE");
    menu.addTextButton("GO TO PROJECT PAGE",
        function() {
            window.open("https://github.com/shaunew/Pac-Man");
        });
    menu.addTextButton("BACK",
        function() {
            exitTo(homeState);
        });
    menu.backButton = menu.buttons[menu.buttonCount-1];

    var drawBody = function(ctx) {
        ctx.font = tileSize+"px ArcadeR";
        ctx.textBaseline = "top";
        ctx.textAlign = "left";

        var x,y;
        x = 2*tileSize;
        y = 0*tileSize;
        ctx.fillStyle = "#0FF";
        ctx.fillText("DEVELOPER", x,y);
        y += tileSize*2;
        ctx.fillStyle = "#777";
        ctx.fillText("SHAUN WILLIAMS", x,y);

        y += tileSize*4;
        ctx.fillStyle = "#0FF";
        ctx.fillText("REVERSE-ENGINEERS",x,y);
        y += tileSize*2;
        ctx.fillStyle = "#777";
        ctx.fillText("JAMEY PITTMAN",x,y);
        y += tileSize*2;
        ctx.fillText("BART GRANTHAM",x,y);

        y += tileSize*4;
        ctx.fillStyle = "#FF0";
        ctx.fillText("PAC-MAN",x,y);
        y += tileSize*2;
        ctx.fillStyle = "#777";
        ctx.fillText("NAMCO",x,y);

        y += tileSize*4;
        ctx.fillStyle = "#FF0";
        ctx.fillText("MS. PAC-MAN / CRAZY OTTO",x,y);
        y += tileSize*2;
        ctx.fillStyle = "#777";
        ctx.fillText("GENERAL COMPUTING",x,y);
    };

    return {
        init: function() {
            menu.enable();
            galagaStars.init();
        },
        draw: function() {
            renderer.clearMapFrame();
            renderer.beginMapClip();
            renderer.renderFunc(galagaStars.draw);
            renderer.renderFunc(drawBody);
            renderer.renderFunc(menu.draw,menu);
            renderer.endMapClip();
        },
        update: function() {
            galagaStars.update();
            menu.update();
        },
        getMenu: function() {
            return menu;
        },
    };

})();

////////////////////////////////////////////////////
// New Game state
// (state when first starting a new game)

var newGameState = (function() {
    var frames;
    var duration = 0;
    var startLevel = 1;

    return {
        init: function() {
            clearCheats();
            frames = 0;
            level = startLevel-1;
            extraLives = practiceMode ? Infinity : 3;
            setScore(0);
            setFruitFromGameMode();
            readyNewState.init();
        },
        setStartLevel: function(i) {
            startLevel = i;
        },
        draw: function() {
            if (!map)
                return;
            renderer.blitMap();
            renderer.drawScore();
            renderer.drawMessage("PLAYER ONE", "#0FF", 9, 14);
            renderer.drawReadyMessage();
        },
        update: function() {
            if (frames == duration*60) {
                extraLives--;
                state = readyNewState;
                renderer.drawMap();
            }
            else 
                frames++;
        },
    };
})();

////////////////////////////////////////////////////
// Ready state
// (state when map is displayed and pausing before play)

var readyState =  (function(){
    var frames;
    var duration = 4;
    
    return {
        init: function() {
            audio.startMusic.play();
            var i;
            for (i=0; i<5; i++)
                actors[i].reset();
            ghostCommander.reset();
            fruit.reset();
            energizer.reset();
            map.resetTimeEaten();
            frames = 0;
            vcr.init();
        },
        draw: function() {
            if (!map)
                return;
            renderer.blitMap();
            renderer.drawScore();
            renderer.drawActors();
            renderer.drawReadyMessage();
        },
        update: function() {
            if (frames == duration*60)
                switchState(playState);
            else
                frames++;
        },
    };
})();

////////////////////////////////////////////////////
// Ready New Level state
// (ready state when pausing before new level)

var readyNewState = newChildObject(readyState, {

    init: function() {

        // increment level and ready the next map
        level++;
        if (gameMode == GAME_PACMAN) {
            map = mapPacman;
        }
        else if (gameMode == GAME_MSPACMAN || gameMode == GAME_OTTO) {
            setNextMsPacMap();
        }
        else if (gameMode == GAME_COOKIE) {
            setNextCookieMap();
        }
        map.resetCurrent();
        fruit.onNewLevel();
        renderer.drawMap();

        // notify other objects of new level
        ghostReleaser.onNewLevel();
        elroyTimer.onNewLevel();

        // inherit attributes from readyState
        readyState.init.call(this);
    },
});

////////////////////////////////////////////////////
// Ready Restart Level state
// (ready state when pausing before restarted level)

var readyRestartState = newChildObject(readyState, {

    init: function() {
        extraLives--;
        ghostReleaser.onRestartLevel();
        elroyTimer.onRestartLevel();
        renderer.drawMap();

        // inherit attributes from readyState
        readyState.init.call(this);
    },
});

////////////////////////////////////////////////////
// Play state
// (state when playing the game)

var playState = {
    init: function() { 
        if (practiceMode) {
            vcr.reset();
        }
    },
    draw: function() {
        renderer.setLevelFlash(false);
        renderer.blitMap();
        renderer.drawScore();
        renderer.beginMapClip();
        renderer.drawFruit();
        renderer.drawPaths();
        renderer.drawActors();
        renderer.drawTargets();
        renderer.endMapClip();
    },

    // handles collision between pac-man and ghosts
    // returns true if collision happened
    isPacmanCollide: function() {
        var i,g;
        for (i = 0; i<4; i++) {
            g = ghosts[i];
            if (g.tile.x == pacman.tile.x && g.tile.y == pacman.tile.y && g.mode == GHOST_OUTSIDE) {
                if (g.scared) { // eat ghost
                    energizer.addPoints();
                    g.onEaten();
                }
                else if (pacman.invincible) // pass through ghost
                    continue;
                else // killed by ghost
                    switchState(deadState);
                return true;
            }
        }
        return false;
    },
    update: function() {
        
        if (vcr.isSeeking()) {
            vcr.seek();
        }
        else {
            // record current state
            if (vcr.getMode() == VCR_RECORD) {
                vcr.record();
            }

            var i,j; // loop index
            var maxSteps = 2;
            var skip = false;

            // skip this frame if needed,
            // but update ghosts running home
            if (energizer.showingPoints()) {
                for (j=0; j<maxSteps; j++)
                    for (i=0; i<4; i++)
                        if (ghosts[i].mode == GHOST_GOING_HOME || ghosts[i].mode == GHOST_ENTERING_HOME)
                            ghosts[i].update(j);
                energizer.updatePointsTimer();
                skip = true;
            }
            else { // make ghosts go home immediately after points disappear
                for (i=0; i<4; i++)
                    if (ghosts[i].mode == GHOST_EATEN) {
                        ghosts[i].mode = GHOST_GOING_HOME;
                        ghosts[i].targetting = 'door';
                    }
                    ghosts[0].playSounds();
            }
            
            if (!skip) {

                // update counters
                ghostReleaser.update();
                ghostCommander.update();
                elroyTimer.update();
                fruit.update();
                energizer.update();

                // update actors one step at a time
                for (j=0; j<maxSteps; j++) {

                    // advance pacman
                    pacman.update(j);

                    // test collision with fruit
                    fruit.testCollide();

                    // finish level if all dots have been eaten
                    if (map.allDotsEaten()) {
                        //this.draw(); 
                        switchState(finishState);
                        audio.extend.play();
                        break;
                    }

                    // test pacman collision before and after updating ghosts
                    // (redundant to prevent pass-throughs)
                    // (if collision happens, stop immediately.)
                    if (this.isPacmanCollide()) break;
                    for (i=0;i<4;i++) actors[i].update(j);
                    if (this.isPacmanCollide()) break;
                }

                // update frame counts
                for (i=0; i<5; i++)
                    actors[i].frames++;
            }
        }
    },
};

////////////////////////////////////////////////////
// Script state
// (a state that triggers functions at certain times)

var scriptState = (function(){

    return {
        init: function() {
            this.frames = 0;        // frames since state began
            this.triggerFrame = 0;  // frames since last trigger

            var trigger = this.triggers[0];
            this.drawFunc = trigger ? trigger.draw : undefined;   // current draw function
            this.updateFunc = trigger ? trigger.update : undefined; // current update function
        },
        update: function() {

            // if trigger is found for current time,
            // call its init() function
            // and store its draw() and update() functions
            var trigger = this.triggers[this.frames];
            if (trigger) {
                if (trigger.init) trigger.init();
                this.drawFunc = trigger.draw;
                this.updateFunc = trigger.update;
                this.triggerFrame = 0;
            }

            // call the last trigger's update function
            if (this.updateFunc) 
                this.updateFunc(this.triggerFrame);

            this.frames++;
            this.triggerFrame++;
        },
        draw: function() {
            // call the last trigger's draw function
            if (this.drawFunc) 
                this.drawFunc(this.triggerFrame);
        },
    };
})();

////////////////////////////////////////////////////
// Seekable Script state
// (a script state that can be controled by the VCR)

var seekableScriptState = newChildObject(scriptState, {

    init: function() {
        scriptState.init.call(this);
        this.savedFrames = {};
        this.savedTriggerFrame = {};
        this.savedDrawFunc = {};
        this.savedUpdateFunc = {};
    },

    save: function(t) {
        this.savedFrames[t] = this.frames;
        this.savedTriggerFrame[t] = this.triggerFrame;
        this.savedDrawFunc[t] = this.drawFunc;
        this.savedUpdateFunc[t] = this.updateFunc;
    },
    load: function(t) {
        this.frames = this.savedFrames[t];
        this.triggerFrame = this.savedTriggerFrame[t];
        this.drawFunc = this.savedDrawFunc[t];
        this.updateFunc = this.savedUpdateFunc[t];
    },
    update: function() {
        if (vcr.isSeeking()) {
            vcr.seek();
        }
        else {
            if (vcr.getMode() == VCR_RECORD) {
                vcr.record();
            }
            scriptState.update.call(this);
        }
    },
    draw: function() {
        if (this.drawFunc) {
            scriptState.draw.call(this);
        }
    },
});

////////////////////////////////////////////////////
// Dead state
// (state when player has lost a life)

var deadState = (function() {
    
    // this state will always have these drawn
    var commonDraw = function() {
        renderer.blitMap();
        renderer.drawScore();
    };

    return newChildObject(seekableScriptState, {

        // script functions for each time
        triggers: {
            0: { // freeze
                init: function() {
                    audio.die.play();
                },
                update: function() {
                    var i;
                    for (i=0; i<4; i++) 
                        actors[i].frames++; // keep animating ghosts
                },
                draw: function() {
                    commonDraw();
                    renderer.beginMapClip();
                    renderer.drawFruit();
                    renderer.drawActors();
                    renderer.endMapClip();
                }
            },
            60: {
                draw: function() { // isolate pacman
                    commonDraw();
                    renderer.beginMapClip();
                    renderer.drawPlayer();
                    renderer.endMapClip();
                },
            },
            120: {
                draw: function(t) { // dying animation
                    commonDraw();
                    renderer.beginMapClip();
                    renderer.drawDyingPlayer(t/75);
                    renderer.endMapClip();
                },
            },
            195: {
                draw: function() {
                    commonDraw();
                    renderer.beginMapClip();
                    renderer.drawDyingPlayer(1);
                    renderer.endMapClip();
                },
            },
            240: {
                draw: function() {
                    commonDraw();
                    renderer.beginMapClip();
                    renderer.drawDyingPlayer(1);
                    renderer.endMapClip();
                },
                init: function() { // leave
                    switchState( extraLives == 0 ? overState : readyRestartState);
                }
            },
        },
    });
})();

////////////////////////////////////////////////////
// Finish state
// (state when player has completed a level)

var finishState = (function(){

    // this state will always have these drawn
    var commonDraw = function() {
        renderer.blitMap();
        renderer.drawScore();

        renderer.beginMapClip();
        renderer.drawPlayer();
        renderer.endMapClip();
    };
    
    // flash the floor and draw
    var flashFloorAndDraw = function(on) {
        renderer.setLevelFlash(on);
        commonDraw();
    };

    return newChildObject(seekableScriptState, {

        // script functions for each time
        triggers: {
            0:   { draw: function() {
                    renderer.setLevelFlash(false);
                    renderer.blitMap();
                    renderer.drawScore();
                    renderer.beginMapClip();
                    renderer.drawFruit();
                    renderer.drawActors();
                    renderer.drawTargets();
                    renderer.endMapClip();
            } },
            120:  { draw: function() { flashFloorAndDraw(true); } },
            132: { draw: function() { flashFloorAndDraw(false); } },
            144: { draw: function() { flashFloorAndDraw(true); } },
            156: { draw: function() { flashFloorAndDraw(false); } },
            168: { draw: function() { flashFloorAndDraw(true); } },
            180: { draw: function() { flashFloorAndDraw(false); } },
            192: { draw: function() { flashFloorAndDraw(true); } },
            204: { draw: function() { flashFloorAndDraw(false); } },
            216: {
                init: function() {
                    if (!triggerCutsceneAtEndLevel()) {
                        switchState(readyNewState,60);
                    }
                }
            },
        },
    });
})();

////////////////////////////////////////////////////
// Game Over state
// (state when player has lost last life)

var overState = (function() {
    var frames;
    var drawGameOverMessage = function(ctx) {
        ctx.fillStyle = "rgba(0,0,0,0.85)";
        ctx.fillRect(0, 16.5*tileSize, mapWidth, 7*tileSize);
        ctx.fillStyle = "#FF0000";
        ctx.fillRect(0, 16.5*tileSize, mapWidth, 1);
        ctx.fillRect(0, 23.5*tileSize-1, mapWidth, 1);
        ctx.save();
        ctx.translate(mapWidth/2, 18.5*tileSize);
        ctx.scale(1.2,1.2);
        drawGhostSprite(ctx, 0, 0, Math.floor(frames/8)%2, DIR_LEFT, false, false, false, blinky.color);
        ctx.restore();
        ctx.font = tileSize+"px PressStart";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#FF0000";
        ctx.fillText("Aywen a gagn\u00e9\u2026", mapWidth/2, 21*tileSize);
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText("\u00e0 la prochaine, a+", mapWidth/2, 22.5*tileSize);
    };
    return {
        init: function() {
            frames = 0;
        },
        draw: function() {
            renderer.blitMap();
            renderer.drawScore();
            renderer.renderFunc(drawGameOverMessage);
        },
        update: function() {
            if (frames == 300) {
                switchState(homeState,60);
            }
            else
                frames++;
        },
    };
})();

//////////////////////////////////////////////////////////////////////////////////////
// Input
// (Handles all key presses and touches)

(function(){

    // A Key Listener class (each key maps to an array of callbacks)
    var KeyEventListener = function() {
        this.listeners = {};
    };
    KeyEventListener.prototype = {
        add: function(key, callback, isActive) {
            this.listeners[key] = this.listeners[key] || [];
            this.listeners[key].push({
                isActive: isActive,
                callback: callback,
            });
        },
        exec: function(key, e) {
            var keyListeners = this.listeners[key];
            if (!keyListeners) {
                return;
            }
            var i,l;
            var numListeners = keyListeners.length;
            for (i=0; i<numListeners; i++) {
                l = keyListeners[i];
                if (!l.isActive || l.isActive()) {
                    e.preventDefault();
                    if (l.callback()) { // do not propagate keys if returns true
                        break;
                    }
                }
            }
        },
    };

    // declare key event listeners
    var keyDownListeners = new KeyEventListener();
    var keyUpListeners = new KeyEventListener();

    // helper functions for adding custom key listeners
    var addKeyDown = function(key,callback,isActive) { keyDownListeners.add(key,callback,isActive); };
    var addKeyUp   = function(key,callback,isActive) { keyUpListeners.add(key,callback,isActive); };

    // boolean states of each key
    var keyStates = {};

    // hook my key listeners to the window's listeners
    window.addEventListener("keydown", function(e) {
        var key = (e||window.event).keyCode;

        // only execute at first press event
        if (!keyStates[key]) {
            keyStates[key] = true;
            keyDownListeners.exec(key, e);
        }
    });
    window.addEventListener("keyup",function(e) {
        var key = (e||window.event).keyCode;

        keyStates[key] = false;
        keyUpListeners.exec(key, e);
    });


    // key enumerations

    var KEY_ENTER = 13;
    var KEY_ESC = 27;

    var KEY_LEFT = 37;
    var KEY_RIGHT = 39;
    var KEY_UP = 38;
    var KEY_DOWN = 40;

    var KEY_SHIFT = 16;
    var KEY_CTRL = 17;
    var KEY_ALT = 18;

    var KEY_SPACE = 32;

    var KEY_M = 77;
    var KEY_N = 78;
    var KEY_Q = 81;
    var KEY_Z = 90;
    var KEY_W = 87;
    var KEY_E = 69;
    var KEY_R = 82;
    var KEY_T = 84;

    var KEY_A = 65;
    var KEY_S = 83;
    var KEY_D = 68;
    var KEY_F = 70;
    var KEY_G = 71;

    var KEY_I = 73;
    var KEY_O = 79;
    var KEY_P = 80;

    var KEY_1 = 49;
    var KEY_2 = 50;

    var KEY_END = 35;

    // Custom Key Listeners

    // Menu Navigation Keys
    var menu;
    var isInMenu = function() {
        menu = (state.getMenu && state.getMenu());
        if (!menu && inGameMenu.isOpen()) {
            menu = inGameMenu.getMenu();
        }
        return menu;
    };
    addKeyDown(KEY_ESC,   function(){ if (menu.backButton) menu.backButton.onclick(); else if (state == homeState) window.close(); return true; }, isInMenu);
    addKeyDown(KEY_ENTER, function(){ menu.clickCurrentOption(); }, isInMenu);
    var isMenuKeysAllowed = function() {
        var menu = isInMenu();
        return menu && !menu.noArrowKeys;
    };
    addKeyDown(KEY_UP,    function(){ menu.selectPrevOption(); }, isMenuKeysAllowed);
    addKeyDown(KEY_DOWN,  function(){ menu.selectNextOption(); }, isMenuKeysAllowed);
    addKeyDown(KEY_Z,     function(){ menu.selectPrevOption(); }, isMenuKeysAllowed);
    addKeyDown(KEY_S,     function(){ menu.selectNextOption(); }, isMenuKeysAllowed);
    var isInGameMenuButtonClickable = function() {
        return hud.isValidState() && !inGameMenu.isOpen();
    };
    addKeyDown(KEY_ESC, function() { inGameMenu.getMenuButton().onclick(); return true; }, isInGameMenuButtonClickable);

    // Move Pac-Man
    var isPlayState = function() { return state == learnState || state == newGameState || state == playState || state == readyNewState || state == readyRestartState; };
    addKeyDown(KEY_LEFT,  function() { pacman.setInputDir(DIR_LEFT); },  isPlayState);
    addKeyDown(KEY_RIGHT, function() { pacman.setInputDir(DIR_RIGHT); }, isPlayState);
    addKeyDown(KEY_UP,    function() { pacman.setInputDir(DIR_UP); },    isPlayState);
    addKeyDown(KEY_DOWN,  function() { pacman.setInputDir(DIR_DOWN); },  isPlayState);
    addKeyUp  (KEY_LEFT,  function() { pacman.clearInputDir(DIR_LEFT); },  isPlayState);
    addKeyUp  (KEY_RIGHT, function() { pacman.clearInputDir(DIR_RIGHT); }, isPlayState);
    addKeyUp  (KEY_UP,    function() { pacman.clearInputDir(DIR_UP); },    isPlayState);
    addKeyUp  (KEY_DOWN,  function() { pacman.clearInputDir(DIR_DOWN); },  isPlayState);
    addKeyDown(KEY_Q,     function() { pacman.setInputDir(DIR_LEFT); },  isPlayState);
    addKeyDown(KEY_D,     function() { pacman.setInputDir(DIR_RIGHT); }, isPlayState);
    addKeyDown(KEY_Z,     function() { pacman.setInputDir(DIR_UP); },    isPlayState);
    addKeyDown(KEY_S,     function() { pacman.setInputDir(DIR_DOWN); },  isPlayState);
    addKeyUp  (KEY_Q,     function() { pacman.clearInputDir(DIR_LEFT); },  isPlayState);
    addKeyUp  (KEY_D,     function() { pacman.clearInputDir(DIR_RIGHT); }, isPlayState);
    addKeyUp  (KEY_Z,     function() { pacman.clearInputDir(DIR_UP); },    isPlayState);
    addKeyUp  (KEY_S,     function() { pacman.clearInputDir(DIR_DOWN); },  isPlayState);

    // Slow-Motion
    var isPracticeMode = function() { return isPlayState() && practiceMode; };
    //isPracticeMode = function() { return true; };
    addKeyDown(KEY_1, function() { executive.setUpdatesPerSecond(30); }, isPracticeMode);
    addKeyDown(KEY_2,  function() { executive.setUpdatesPerSecond(15); }, isPracticeMode);
    addKeyUp  (KEY_1, function() { executive.setUpdatesPerSecond(60); }, isPracticeMode);
    addKeyUp  (KEY_2,  function() { executive.setUpdatesPerSecond(60); }, isPracticeMode);

    // Toggle VCR
    var canSeek = function() { return !isInMenu() && vcr.getMode() != VCR_NONE; };
    addKeyDown(KEY_SHIFT, function() { vcr.startSeeking(); },   canSeek);
    addKeyUp  (KEY_SHIFT, function() { vcr.startRecording(); }, canSeek);

    // Adjust VCR seeking
    var isSeekState = function() { return vcr.isSeeking(); };
    addKeyDown(KEY_UP,   function() { vcr.nextSpeed(1); },  isSeekState);
    addKeyDown(KEY_DOWN, function() { vcr.nextSpeed(-1); }, isSeekState);

    // Skip Level
    var canSkip = function() {
        return isPracticeMode() && 
            (state == newGameState ||
            state == readyNewState ||
            state == readyRestartState ||
            state == playState ||
            state == deadState ||
            state == finishState ||
            state == overState);
    };
    addKeyDown(KEY_N, function() { switchState(readyNewState, 60); }, canSkip);
    addKeyDown(KEY_M, function() { switchState(finishState); }, function() { return state == playState; });

    // Draw Actor Targets (fishpoles)
    addKeyDown(KEY_W, function() { pinky.isDrawTarget = !pinky.isDrawTarget; }, isPracticeMode);
    addKeyDown(KEY_E, function() { inky.isDrawTarget = !inky.isDrawTarget; }, isPracticeMode);
    addKeyDown(KEY_R, function() { clyde.isDrawTarget = !clyde.isDrawTarget; }, isPracticeMode);
    addKeyDown(KEY_T, function() { pacman.isDrawTarget = !pacman.isDrawTarget; }, isPracticeMode);

    // Draw Actor Paths
    addKeyDown(KEY_A, function() { blinky.isDrawPath = !blinky.isDrawPath; }, isPracticeMode);
    addKeyDown(KEY_F, function() { clyde.isDrawPath = !clyde.isDrawPath; }, isPracticeMode);
    addKeyDown(KEY_G, function() { pacman.isDrawPath = !pacman.isDrawPath; }, isPracticeMode);

    // Miscellaneous Cheats
    addKeyDown(KEY_I, function() { pacman.invincible = !pacman.invincible; }, isPracticeMode);
    addKeyDown(KEY_O, function() { turboMode = !turboMode; }, isPracticeMode);
    addKeyDown(KEY_P, function() { pacman.ai = !pacman.ai; }, isPracticeMode);

    addKeyDown(KEY_END, function() { executive.togglePause(); });

})();

var initSwipe = function() {

    // position of anchor
    var x = 0;
    var y = 0;

    // current distance from anchor
    var dx = 0;
    var dy = 0;

    // minimum distance from anchor before direction is registered
    var r = 4;
    
    var touchStart = function(event) {
        event.preventDefault();
        var fingerCount = event.touches.length;
        if (fingerCount == 1) {

            // commit new anchor
            x = event.touches[0].pageX;
            y = event.touches[0].pageY;

        }
        else {
            touchCancel(event);
        }
    };

    var touchMove = function(event) {
        event.preventDefault();
        var fingerCount = event.touches.length;
        if (fingerCount == 1) {

            // get current distance from anchor
            dx = event.touches[0].pageX - x;
            dy = event.touches[0].pageY - y;

            // if minimum move distance is reached
            if (dx*dx+dy*dy >= r*r) {

                // commit new anchor
                x += dx;
                y += dy;

                // register direction
                if (Math.abs(dx) >= Math.abs(dy)) {
                    pacman.setInputDir(dx>0 ? DIR_RIGHT : DIR_LEFT);
                }
                else {
                    pacman.setInputDir(dy>0 ? DIR_DOWN : DIR_UP);
                }
            }
        }
        else {
            touchCancel(event);
        }
    };

    var touchEnd = function(event) {
        event.preventDefault();
    };

    var touchCancel = function(event) {
        event.preventDefault();
        x=y=dx=dy=0;
    };

    var touchTap = function(event) {
        // tap to clear input directions
        pacman.clearInputDir(undefined);
    };
    
    // register touch events
    document.onclick = touchTap;
    document.ontouchstart = touchStart;
    document.ontouchend = touchEnd;
    document.ontouchmove = touchMove;
    document.ontouchcancel = touchCancel;
};
////////////////////////////////////////////////
// Cutscenes
//

var playCutScene = function(cutScene, nextState) {

    // redraw map buffer with fruit list but no map structure
    map = undefined;
    renderer.drawMap(true);

    // miss the audio silence and time it cleanly for pacman cut scene 1
    setTimeout(audio.coffeeBreakMusic.startLoop, 1200);
    cutScene.nextState = nextState;
    switchState(cutScene, 60);

};

var pacmanCutscene1 = newChildObject(scriptState, {
    init: function() {
        scriptState.init.call(this);

        // initialize actor positions
        pacman.setPos(232, 164);
        blinky.setPos(257, 164);

        // initialize actor directions
        blinky.setDir(DIR_LEFT);
        blinky.faceDirEnum = DIR_LEFT;
        pacman.setDir(DIR_LEFT);

        // initialize misc actor properties
        blinky.scared = false;
        blinky.mode = GHOST_OUTSIDE;

        // clear other states
        backupCheats();
        clearCheats();
        energizer.reset();

        // temporarily override actor step sizes
        pacman.getNumSteps = function() {
            return Actor.prototype.getStepSizeFromTable.call(this, 5, STEP_PACMAN);
        };
        blinky.getNumSteps = function() {
            return Actor.prototype.getStepSizeFromTable.call(this, 5, STEP_ELROY2);
        };

        // temporarily override steering functions
        pacman.steer = blinky.steer = function(){};
    },
    triggers: {

        // Blinky chases Pac-Man
        0: {
            update: function() {
                var j;
                for (j=0; j<2; j++) {
                    pacman.update(j);
                    blinky.update(j);
                }
                pacman.frames++;
                blinky.frames++;
            },
            draw: function() {
                renderer.blitMap();
                renderer.beginMapClip();
                renderer.drawPlayer();
                renderer.drawGhost(blinky);
                renderer.endMapClip();
            },
        },

        // Pac-Man chases Blinky
        260: {
            init: function() {
                pacman.setPos(-193, 155);
                blinky.setPos(-8, 164);

                // initialize actor directions
                blinky.setDir(DIR_RIGHT);
                blinky.faceDirEnum = DIR_RIGHT;
                pacman.setDir(DIR_RIGHT);

                // initialize misc actor properties
                blinky.scared = true;

                // temporarily override step sizes
                pacman.getNumSteps = function() {
                    return Actor.prototype.getStepSizeFromTable.call(this, 5, STEP_PACMAN_FRIGHT);
                };
                blinky.getNumSteps = function() {
                    return Actor.prototype.getStepSizeFromTable.call(this, 5, STEP_GHOST_FRIGHT);
                };
            },
            update: function() {
                var j;
                for (j=0; j<2; j++) {
                    pacman.update(j);
                    blinky.update(j);
                }
                pacman.frames++;
                blinky.frames++;
            },
            draw: function() {
                renderer.blitMap();
                renderer.beginMapClip();
                renderer.drawGhost(blinky);
                renderer.renderFunc(function(ctx) {
                    var frame = Math.floor(pacman.steps/4) % 4; // slower to switch animation frame when giant
                    if (frame == 3) {
                        frame = 1;
                    }
                    drawGiantPacmanSprite(ctx, pacman.pixel.x, pacman.pixel.y, pacman.dirEnum, frame);
                });
                renderer.endMapClip();
            },
        },

        // end
        640: {
            init: function() {
                // disable custom steps
                delete pacman.getNumSteps;
                delete blinky.getNumSteps;

                // disable custom steering
                delete pacman.steer;
                delete blinky.steer;

                // exit to next level
                restoreCheats();
                switchState(pacmanCutscene1.nextState, 60);
            },
        },
    },
});

var mspacmanCutscene1 = (function() {

    // create new players pac and mspac for this scene
    var pac = new Player();
    var mspac = new Player();

    // draws pac or mspac
    var drawPlayer = function(ctx,player) {
        var frame = player.getAnimFrame();
        var func;
        if (player == pac) {
            func = gameMode == GAME_MSPACMAN ? atlas.drawPacmanSprite : atlas.drawOttoSprite;
        }
        else if (player == mspac) {
            func = gameMode == GAME_MSPACMAN ? atlas.drawMsPacmanSprite : atlas.drawMsOttoSprite;
        }
        func(ctx, player.pixel.x, player.pixel.y, player.dirEnum, frame);
    };

    // draws all actors
    var draw = function() {
        renderer.blitMap();
        renderer.beginMapClip();
        renderer.renderFunc(function(ctx) {
            drawPlayer(ctx,pac);
            drawPlayer(ctx,mspac);
        });
        renderer.drawGhost(inky);
        renderer.drawGhost(pinky);
        renderer.endMapClip();
    };

    // updates all actors
    var update = function() {
        var j;
        for (j=0; j<2; j++) {
            pac.update(j);
            mspac.update(j);
            inky.update(j);
            pinky.update(j);
        }
        pac.frames++;
        mspac.frames++;
        inky.frames++;
        pinky.frames++;
    };

    var exit = function() {
        // disable custom steps
        delete inky.getNumSteps;
        delete pinky.getNumSteps;

        // disable custom steering
        delete inky.steer;
        delete pinky.steer;

        // disable custom animation steps
        delete inky.getAnimFrame;
        delete pinky.getAnimFrame;

        // exit to next level
        restoreCheats();
        switchState(mspacmanCutscene1.nextState, 60);
    };

    return newChildObject(scriptState, {

        init: function() {
            scriptState.init.call(this);

            // chosen by trial-and-error to match animations
            mspac.frames = 20;
            pac.frames = 12;

            // initialize actor states
            pac.setPos(-10, 99);
            pac.setDir(DIR_RIGHT);
            mspac.setPos(232, 180);
            mspac.setDir(DIR_LEFT);
            
            // initial ghost states
            inky.frames = 0;
            inky.mode = GHOST_OUTSIDE;
            inky.scared = false;
            inky.setPos(pac.pixel.x-42, 99);
            inky.setDir(DIR_RIGHT);
            inky.faceDirEnum = DIR_RIGHT;
            pinky.frames = 3;
            pinky.mode = GHOST_OUTSIDE;
            pinky.scared = false;
            pinky.setPos(mspac.pixel.x+49, 180);
            pinky.setDir(DIR_LEFT);
            pinky.faceDirEnum = DIR_LEFT;

            // clear other states
            backupCheats();
            clearCheats();
            energizer.reset();

            // step player animation every four frames
            pac.getStepFrame = function() { return Math.floor(this.frames/4)%4; };
            mspac.getStepFrame = function() { return Math.floor(this.frames/4)%4; };

            // step ghost animation every six frames
            inky.getAnimFrame = function() { return Math.floor(this.frames/8)%2; };
            pinky.getAnimFrame = function() { return Math.floor(this.frames/8)%2; };

            // set actor step sizes
            pac.getNumSteps = function() { return 1; };
            mspac.getNumSteps = function() { return 1; };
            inky.getNumSteps = function() { return 1; };
            pinky.getNumSteps = function() { return 1; };

            // set steering functions
            pac.steer = function(){};
            mspac.steer = function(){};
            inky.steer = function(){};
            pinky.steer = function(){};
        },
        triggers: {

            // Inky chases Pac, Pinky chases Mspac
            0: {
                update: function() {
                    update();
                    if (inky.pixel.x == 105) {
                        // speed up the ghosts
                        inky.getNumSteps = function() {
                            return Actor.prototype.getStepSizeFromTable.call(this, 5, STEP_ELROY2);
                        };
                        pinky.getNumSteps = function() {
                            return Actor.prototype.getStepSizeFromTable.call(this, 5, STEP_ELROY2);
                        };
                    }
                },
                draw: draw,
            },

            // MsPac and Pac converge with ghosts chasing
            300: (function(){

                // bounce animation when ghosts bump heads
                var inkyBounceX =  [ 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];
                var inkyBounceY =  [-1, 0,-1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0,-1, 0,-1, 0, 0, 0, 0, 0, 1, 0, 1];
                var pinkyBounceX = [ 0, 0, 0, 0,-1, 0,-1, 0, 0,-1, 0,-1, 0,-1, 0, 0,-1, 0,-1, 0,-1, 0, 0,-1, 0,-1, 0,-1, 0, 0];
                var pinkyBounceY = [ 0, 0, 0,-1, 0,-1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0,-1, 0,-1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0];
                var inkyBounceFrame = 0;
                var pinkyBounceFrame = 0;
                var inkyBounceFrameLen = inkyBounceX.length;
                var pinkyBounceFrameLen = pinkyBounceX.length;

                // ramp animation for players
                var rampX = [0, 1, 1, 1, 1, 0, 0];
                var rampY = [0, 0,-1,-1,-1, 0, 0];
                var rampFrame = 0;
                var rampFrameLen = rampX.length;

                // climbing
                var climbFrame = 0;

                // meeting
                var meetFrame = 0;

                var ghostMode;
                var GHOST_RUN = 0;
                var GHOST_BUMP = 1;

                var playerMode;
                var PLAYER_RUN = 0;
                var PLAYER_RAMP = 1;
                var PLAYER_CLIMB = 2;
                var PLAYER_MEET = 3;
                     
                return {
                    init: function() {
                        // reset frames
                        inkyBounceFrame = pinkyBounceFrame = rampFrame = climbFrame = meetFrame = 0;

                        // set modes
                        ghostMode = GHOST_RUN;
                        playerMode = PLAYER_RUN;

                        // set initial positions and directions
                        mspac.setPos(-8,143);
                        mspac.setDir(DIR_RIGHT);

                        pinky.setPos(-81,143);
                        pinky.faceDirEnum = DIR_RIGHT;
                        pinky.setDir(DIR_RIGHT);

                        pac.setPos(223+8+3,142);
                        pac.setDir(DIR_LEFT);

                        inky.setPos(302,143);
                        inky.faceDirEnum = DIR_LEFT;
                        inky.setDir(DIR_LEFT);

                        // set ghost speed
                        inky.getNumSteps = pinky.getNumSteps = function() {
                            return "11211212"[this.frames%8];
                        };
                    },
                    update: function() {
                        var j;

                        // update players
                        if (playerMode == PLAYER_RUN) {
                            for (j=0; j<2; j++) {
                                pac.update(j);
                                mspac.update(j);
                            }
                            if (mspac.pixel.x == 102) {
                                playerMode++;
                            }
                        }
                        else if (playerMode == PLAYER_RAMP) {
                            pac.pixel.x -= rampX[rampFrame];
                            pac.pixel.y += rampY[rampFrame];
                            pac.commitPos();
                            mspac.pixel.x += rampX[rampFrame];
                            mspac.pixel.y += rampY[rampFrame];
                            mspac.commitPos();
                            rampFrame++;
                            if (rampFrame == rampFrameLen) {
                                playerMode++;
                            }
                        }
                        else if (playerMode == PLAYER_CLIMB) {
                            if (climbFrame == 0) {
                                // set initial climb state for mspac
                                mspac.pixel.y -= 2;
                                mspac.commitPos();
                                mspac.setDir(DIR_UP);

                                // set initial climb state for pac
                                pac.pixel.x -= 1;
                                pac.commitPos();
                                pac.setDir(DIR_UP);
                            }
                            else {
                                for (j=0; j<2; j++) {
                                    pac.update(j);
                                    mspac.update(j);
                                }
                            }
                            climbFrame++;
                            if (mspac.pixel.y == 91) {
                                playerMode++;
                            }
                        }
                        else if (playerMode == PLAYER_MEET) {
                            if (meetFrame == 0) {
                                // set initial meet state for mspac
                                mspac.pixel.y++;
                                mspac.setDir(DIR_RIGHT);
                                mspac.commitPos();

                                // set initial meet state for pac
                                pac.pixel.y--;
                                pac.pixel.x++;
                                pac.setDir(DIR_LEFT);
                                pac.commitPos();
                            }
                            if (meetFrame > 18) {
                                // pause player frames after a certain period
                                pac.frames--;
                                mspac.frames--;
                            }
                            if (meetFrame == 78) {
                                exit();
                            }
                            meetFrame++;
                        }
                        pac.frames++;
                        mspac.frames++;

                        // update ghosts
                        if (ghostMode == GHOST_RUN) {
                            for (j=0; j<2; j++) {
                                inky.update(j);
                                pinky.update(j);
                            }

                            // stop at middle
                            inky.pixel.x = Math.max(120, inky.pixel.x);
                            inky.commitPos();
                            pinky.pixel.x = Math.min(105, pinky.pixel.x);
                            pinky.commitPos();

                            if (pinky.pixel.x == 105) {
                                ghostMode++;
                            }
                        }
                        else if (ghostMode == GHOST_BUMP) {
                            if (inkyBounceFrame < inkyBounceFrameLen) {
                                inky.pixel.x += inkyBounceX[inkyBounceFrame];
                                inky.pixel.y += inkyBounceY[inkyBounceFrame];
                            }
                            if (pinkyBounceFrame < pinkyBounceFrameLen) {
                                pinky.pixel.x += pinkyBounceX[pinkyBounceFrame];
                                pinky.pixel.y += pinkyBounceY[pinkyBounceFrame];
                            }
                            inkyBounceFrame++;
                            pinkyBounceFrame++;
                        }
                        inky.frames++;
                        pinky.frames++;
                    },
                    draw: function() {
                        renderer.blitMap();
                        renderer.beginMapClip();
                        renderer.renderFunc(function(ctx) {
                            drawPlayer(ctx,pac);
                            drawPlayer(ctx,mspac);
                        });
                        if (inkyBounceFrame < inkyBounceFrameLen) {
                            renderer.drawGhost(inky);
                        }
                        if (pinkyBounceFrame < pinkyBounceFrameLen) {
                            renderer.drawGhost(pinky);
                        }
                        if (playerMode == PLAYER_MEET) {
                            renderer.renderFunc(function(ctx) {
                                drawHeartSprite(ctx, 112, 73);
                            });
                        }
                        renderer.endMapClip();
                    },
                }; // returned object
            })(), // trigger at 300
        }, // triggers
    }); // returned object
})(); // mspacCutscene1

var mspacmanCutscene2 = (function() {

    // create new players pac and mspac for this scene
    var pac = new Player();
    var mspac = new Player();

    // draws pac or mspac
    var drawPlayer = function(ctx,player) {
        var frame = player.getAnimFrame();
        var func;
        if (player == pac) {
            func = gameMode == GAME_MSPACMAN ? atlas.drawPacmanSprite : atlas.drawOttoSprite;
        }
        else if (player == mspac) {
            func = gameMode == GAME_MSPACMAN ? atlas.drawMsPacmanSprite : atlas.drawMsOttoSprite;
        }
        func(ctx, player.pixel.x, player.pixel.y, player.dirEnum, frame);
    };

    // draws all actors
    var draw = function() {
        renderer.blitMap();
        renderer.beginMapClip();
        renderer.renderFunc(function(ctx) {
            drawPlayer(ctx,pac);
            drawPlayer(ctx,mspac);
        });
        renderer.endMapClip();
    };

    // updates all actors
    var update = function() {
        var j;
        for (j=0; j<7; j++) {
            pac.update(j);
            mspac.update(j);
        }
        pac.frames++;
        mspac.frames++;
    };

    var exit = function() {
        // exit to next level
        restoreCheats();
        switchState(mspacmanCutscene2.nextState, 60);
    };

    var getChaseSteps = function() { return 3; };
    var getFleeSteps = function() { return "32"[this.frames%2]; };
    var getDartSteps = function() { return 7; };

    return newChildObject(scriptState, {

        init: function() {
            scriptState.init.call(this);

            // chosen by trial-and-error to match animations
            mspac.frames = 20;
            pac.frames = 12;

            // step player animation every four frames
            pac.getStepFrame = function() { return Math.floor(this.frames/4)%4; };
            mspac.getStepFrame = function() { return Math.floor(this.frames/4)%4; };

            // set steering functions
            pac.steer = function(){};
            mspac.steer = function(){};
            
            backupCheats();
            clearCheats();
        },
        triggers: {
            0: {
                draw: function() {
                    renderer.blitMap();
                },
            },

            160: {
                init: function() {
                    pac.setPos(-8, 67);
                    pac.setDir(DIR_RIGHT);

                    mspac.setPos(-106, 68);
                    mspac.setDir(DIR_RIGHT);

                    pac.getNumSteps = getFleeSteps;
                    mspac.getNumSteps = getChaseSteps;
                },
                update: update,
                draw: draw,
            },
            410: {
                init: function() {
                    pac.setPos(329, 163);
                    pac.setDir(DIR_LEFT);

                    mspac.setPos(223+8, 164);
                    mspac.setDir(DIR_LEFT);

                    pac.getNumSteps = getChaseSteps;
                    mspac.getNumSteps = getFleeSteps;
                },
                update: update,
                draw: draw,
            },
            670: {
                init: function() {
                    pac.setPos(-8,142);
                    pac.setDir(DIR_RIGHT);

                    mspac.setPos(-106, 143);
                    mspac.setDir(DIR_RIGHT);

                    pac.getNumSteps = getFleeSteps;
                    mspac.getNumSteps = getChaseSteps;
                },
                update: update,
                draw: draw,
            },
            930: {
                init: function() {
                    pac.setPos(233+148,99);
                    pac.setDir(DIR_LEFT);

                    mspac.setPos(233,100);
                    mspac.setDir(DIR_LEFT);

                    pac.getNumSteps = getDartSteps;
                    mspac.getNumSteps = getDartSteps;
                },
                update: function() {
                    if (pac.pixel.x <= 17 && pac.dirEnum == DIR_LEFT) {
                        pac.setPos(-2,195);
                        pac.setDir(DIR_RIGHT);

                        mspac.setPos(-2-148,196);
                        mspac.setDir(DIR_RIGHT);
                    }
                    update();
                },
                draw: draw,
            },
            1140: {
                init: exit,
            },
        }, // triggers
    }); // returned object
})(); // mspacCutscene2

var cookieCutscene1 = newChildObject(scriptState, {

    init: function() {
        scriptState.init.call(this);

        // initialize actor positions
        pacman.setPos(232, 164);
        blinky.setPos(257, 164);

        // initialize actor directions
        blinky.setDir(DIR_LEFT);
        blinky.faceDirEnum = DIR_LEFT;
        pacman.setDir(DIR_LEFT);

        // initialize misc actor properties
        blinky.scared = false;
        blinky.mode = GHOST_OUTSIDE;

        // clear other states
        backupCheats();
        clearCheats();
        energizer.reset();

        // temporarily override actor step sizes
        pacman.getNumSteps = function() {
            return Actor.prototype.getStepSizeFromTable.call(this, 5, STEP_PACMAN);
        };
        blinky.getNumSteps = function() {
            return Actor.prototype.getStepSizeFromTable.call(this, 5, STEP_ELROY2);
        };

        // temporarily override steering functions
        pacman.steer = blinky.steer = function(){};
    },
    triggers: {

        // Blinky chases Pac-Man
        0: {
            update: function() {
                var j;
                for (j=0; j<2; j++) {
                    pacman.update(j);
                    blinky.update(j);
                }
                pacman.frames++;
                blinky.frames++;
            },
            draw: function() {
                renderer.blitMap();
                renderer.beginMapClip();
                renderer.drawPlayer();
                renderer.drawGhost(blinky);
                renderer.endMapClip();
            },
        },

        // Pac-Man chases Blinky
        260: {
            init: function() {
                pacman.setPos(-193, 164);
                blinky.setPos(-8, 155);

                // initialize actor directions
                blinky.setDir(DIR_RIGHT);
                blinky.faceDirEnum = DIR_RIGHT;
                pacman.setDir(DIR_RIGHT);

                // initialize misc actor properties
                blinky.scared = true;

                // temporarily override step sizes
                pacman.getNumSteps = function() {
                    return Actor.prototype.getStepSizeFromTable.call(this, 5, STEP_PACMAN_FRIGHT);
                };
                blinky.getNumSteps = function() {
                    return Actor.prototype.getStepSizeFromTable.call(this, 5, STEP_GHOST_FRIGHT);
                };
            },
            update: function() {
                var j;
                for (j=0; j<2; j++) {
                    pacman.update(j);
                    blinky.update(j);
                }
                pacman.frames++;
                blinky.frames++;
            },
            draw: function() {
                renderer.blitMap();
                renderer.beginMapClip();
                renderer.drawPlayer();
                renderer.renderFunc(function(ctx) {
                    var y = blinky.getBounceY(blinky.pixel.x, blinky.pixel.y, DIR_RIGHT);
                    var x = blinky.pixel.x;
                    ctx.save();
                    ctx.translate(x,y);
                    var s = 16/6;
                    ctx.scale(s,s);
                    drawCookie(ctx,0,0);
                    ctx.restore();
                });
                renderer.endMapClip();
            },
        },

        // end
        640: {
            init: function() {
                // disable custom steps
                delete pacman.getNumSteps;
                delete blinky.getNumSteps;

                // disable custom steering
                delete pacman.steer;
                delete blinky.steer;

                // exit to next level
                restoreCheats();
                switchState(cookieCutscene1.nextState, 60);
            },
        },
    },
});

var cookieCutscene2 = (function() {

    /*
    NOTE:
    This is a copy-paste of mspacmanCutscene1.
    pac is replaced with a scared ghost (bouncing cookie)
    mspac is replaced with Cookie-Man
    */

    // create new players pac and mspac for this scene
    var pac = new Ghost();
    pac.scared = true;
    pac.mode = GHOST_OUTSIDE;
    var mspac = new Player();

    // draws pac or mspac
    var drawPlayer = function(ctx,player) {
        var frame = player.getAnimFrame();
        var func;
        if (player == pac) {
            var y = player.getBounceY(player.pixel.x, player.pixel.y, player.dirEnum);
            atlas.drawMuppetSprite(ctx, player.pixel.x, y, 0, player.dirEnum, true, false);
        }
        else if (player == mspac) {
            drawCookiemanSprite(ctx, player.pixel.x, player.pixel.y, player.dirEnum, frame, true);
        }
    };

    // draws all actors
    var draw = function() {
        renderer.blitMap();
        renderer.beginMapClip();
        renderer.renderFunc(function(ctx) {
            drawPlayer(ctx,pac);
            drawPlayer(ctx,mspac);
        });
        renderer.drawGhost(inky);
        renderer.drawGhost(pinky);
        renderer.endMapClip();
    };

    // updates all actors
    var update = function() {
        var j;
        for (j=0; j<2; j++) {
            pac.update(j);
            mspac.update(j);
            inky.update(j);
            pinky.update(j);
        }
        pac.frames++;
        mspac.frames++;
        inky.frames++;
        pinky.frames++;
    };

    var exit = function() {
        // disable custom steps
        delete inky.getNumSteps;
        delete pinky.getNumSteps;

        // disable custom steering
        delete inky.steer;
        delete pinky.steer;

        // disable custom animation steps
        delete inky.getAnimFrame;
        delete pinky.getAnimFrame;

        // exit to next level
        restoreCheats();
        switchState(cookieCutscene2.nextState, 60);
    };

    return newChildObject(scriptState, {

        init: function() {
            scriptState.init.call(this);

            // chosen by trial-and-error to match animations
            mspac.frames = 14;
            pac.frames = 12;

            // initialize actor states
            pac.setPos(-10, 99);
            pac.setDir(DIR_RIGHT);
            mspac.setPos(232, 180);
            mspac.setDir(DIR_LEFT);
            
            // initial ghost states
            inky.frames = 0;
            inky.mode = GHOST_OUTSIDE;
            inky.scared = false;
            inky.setPos(pac.pixel.x-42, 99);
            inky.setDir(DIR_RIGHT);
            inky.faceDirEnum = DIR_RIGHT;
            pinky.frames = 3;
            pinky.mode = GHOST_OUTSIDE;
            pinky.scared = false;
            pinky.setPos(mspac.pixel.x+49, 180);
            pinky.setDir(DIR_LEFT);
            pinky.faceDirEnum = DIR_LEFT;

            // clear other states
            backupCheats();
            clearCheats();
            energizer.reset();

            // step player animation every four frames
            pac.getStepFrame = function() { return Math.floor(this.frames/4)%4; };
            mspac.getStepFrame = function() { return Math.floor(this.frames/4)%4; };

            // step ghost animation every six frames
            inky.getAnimFrame = function() { return Math.floor(this.frames/8)%2; };
            pinky.getAnimFrame = function() { return Math.floor(this.frames/8)%2; };

            // set actor step sizes
            pac.getNumSteps = function() { return 1; };
            mspac.getNumSteps = function() { return 1; };
            inky.getNumSteps = function() { return 1; };
            pinky.getNumSteps = function() { return 1; };

            // set steering functions
            pac.steer = function(){};
            mspac.steer = function(){};
            inky.steer = function(){};
            pinky.steer = function(){};
        },
        triggers: {

            // Inky chases Pac, Pinky chases Mspac
            0: {
                update: function() {
                    update();
                    if (inky.pixel.x == 105) {
                        // speed up the ghosts
                        inky.getNumSteps = function() {
                            return Actor.prototype.getStepSizeFromTable.call(this, 5, STEP_ELROY2);
                        };
                        pinky.getNumSteps = function() {
                            return Actor.prototype.getStepSizeFromTable.call(this, 5, STEP_ELROY2);
                        };
                    }
                },
                draw: draw,
            },

            // MsPac and Pac converge with ghosts chasing
            300: (function(){

                // bounce animation when ghosts bump heads
                var inkyBounceX =  [ 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];
                var inkyBounceY =  [-1, 0,-1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0,-1, 0,-1, 0, 0, 0, 0, 0, 1, 0, 1];
                var pinkyBounceX = [ 0, 0, 0, 0,-1, 0,-1, 0, 0,-1, 0,-1, 0,-1, 0, 0,-1, 0,-1, 0,-1, 0, 0,-1, 0,-1, 0,-1, 0, 0];
                var pinkyBounceY = [ 0, 0, 0,-1, 0,-1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0,-1, 0,-1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0];
                var inkyBounceFrame = 0;
                var pinkyBounceFrame = 0;
                var inkyBounceFrameLen = inkyBounceX.length;
                var pinkyBounceFrameLen = pinkyBounceX.length;

                // ramp animation for players
                var rampX = [0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1];
                var rampY = [0, 0,-1,-1,-1, 0, 0, 0, 0, 0, 0, 0, 0];
                var rampFrame = 0;
                var rampFrameLen = rampX.length;

                // climbing
                var climbFrame = 0;

                // meeting
                var meetFrame = 0;

                var ghostMode;
                var GHOST_RUN = 0;
                var GHOST_BUMP = 1;

                var playerMode;
                var PLAYER_RUN = 0;
                var PLAYER_RAMP = 1;
                var PLAYER_CLIMB = 2;
                var PLAYER_MEET = 3;
                     
                return {
                    init: function() {
                        // reset frames
                        inkyBounceFrame = pinkyBounceFrame = rampFrame = climbFrame = meetFrame = 0;

                        // set modes
                        ghostMode = GHOST_RUN;
                        playerMode = PLAYER_RUN;

                        // set initial positions and directions
                        mspac.setPos(-8,143);
                        mspac.setDir(DIR_RIGHT);

                        pinky.setPos(-81,143);
                        pinky.faceDirEnum = DIR_RIGHT;
                        pinky.setDir(DIR_RIGHT);

                        pac.setPos(223+8+3,142);
                        pac.setDir(DIR_LEFT);

                        inky.setPos(302,143);
                        inky.faceDirEnum = DIR_LEFT;
                        inky.setDir(DIR_LEFT);

                        // set ghost speed
                        inky.getNumSteps = pinky.getNumSteps = function() {
                            return "11211212"[this.frames%8];
                        };
                    },
                    update: function() {
                        var j;

                        // update players
                        if (playerMode == PLAYER_RUN) {
                            for (j=0; j<2; j++) {
                                pac.update(j);
                                mspac.update(j);
                            }
                            if (mspac.pixel.x == 102) {
                                playerMode++;
                            }
                        }
                        else if (playerMode == PLAYER_RAMP) {
                            pac.pixel.x -= rampX[rampFrame];
                            pac.pixel.y += rampY[rampFrame];
                            pac.commitPos();
                            mspac.pixel.x += rampX[rampFrame];
                            mspac.pixel.y += rampY[rampFrame];
                            mspac.commitPos();
                            rampFrame++;
                            if (rampFrame == rampFrameLen) {
                                playerMode++;
                            }
                        }
                        else if (playerMode == PLAYER_CLIMB) {
                            if (climbFrame == 0) {
                                // set initial climb state for mspac
                                mspac.pixel.y -= 2;
                                mspac.commitPos();
                                mspac.setDir(DIR_UP);
                            }
                            else {
                                for (j=0; j<2; j++) {
                                    mspac.update(j);
                                }
                            }
                            climbFrame++;
                            if (mspac.pixel.y == 91) {
                                playerMode++;
                            }
                        }
                        else if (playerMode == PLAYER_MEET) {
                            if (meetFrame == 0) {
                                // set initial meet state for mspac
                                mspac.pixel.y++;
                                mspac.setDir(DIR_RIGHT);
                                mspac.commitPos();
                            }
                            if (meetFrame > 18) {
                                // pause player frames after a certain period
                                mspac.frames--;
                            }
                            if (meetFrame == 78) {
                                exit();
                            }
                            meetFrame++;
                        }
                        pac.frames++;
                        mspac.frames++;

                        // update ghosts
                        if (ghostMode == GHOST_RUN) {
                            for (j=0; j<2; j++) {
                                inky.update(j);
                                pinky.update(j);
                            }

                            // stop at middle
                            inky.pixel.x = Math.max(120, inky.pixel.x);
                            inky.commitPos();
                            pinky.pixel.x = Math.min(105, pinky.pixel.x);
                            pinky.commitPos();

                            if (pinky.pixel.x == 105) {
                                ghostMode++;
                            }
                        }
                        else if (ghostMode == GHOST_BUMP) {
                            if (inkyBounceFrame < inkyBounceFrameLen) {
                                inky.pixel.x += inkyBounceX[inkyBounceFrame];
                                inky.pixel.y += inkyBounceY[inkyBounceFrame];
                            }
                            if (pinkyBounceFrame < pinkyBounceFrameLen) {
                                pinky.pixel.x += pinkyBounceX[pinkyBounceFrame];
                                pinky.pixel.y += pinkyBounceY[pinkyBounceFrame];
                            }
                            inkyBounceFrame++;
                            pinkyBounceFrame++;
                        }
                        inky.frames++;
                        pinky.frames++;
                    },
                    draw: function() {
                        renderer.blitMap();
                        renderer.beginMapClip();
                        renderer.renderFunc(function(ctx) {
                            if (playerMode <= PLAYER_RAMP) {
                                drawPlayer(ctx,pac);
                            }
                            drawPlayer(ctx,mspac);
                        });
                        if (inkyBounceFrame < inkyBounceFrameLen) {
                            renderer.drawGhost(inky);
                        }
                        if (pinkyBounceFrame < pinkyBounceFrameLen) {
                            renderer.drawGhost(pinky);
                        }
                        if (playerMode == PLAYER_MEET) {
                            renderer.renderFunc(function(ctx) {
                                drawHeartSprite(ctx, 112, 73);
                            });
                        }
                        renderer.endMapClip();
                    },
                }; // returned object
            })(), // trigger at 300
        }, // triggers
    }); // returned object
})(); // mspacCutscene1

var cutscenes = [
    [pacmanCutscene1], // GAME_PACMAN
    [mspacmanCutscene1, mspacmanCutscene2], // GAME_MSPACMAN
    [cookieCutscene1, cookieCutscene2], // GAME_COOKIE
    [mspacmanCutscene1, mspacmanCutscene2], // GAME_OTTO
];

var isInCutScene = function() {
    var scenes = cutscenes[gameMode];
    var i,len = scenes.length;
    for (i=0; i<len; i++) {
        if (state == scenes[i]) {
            return true;
        }
    }
    return false;
};

// TODO: no cutscene after board 17 (last one after completing board 17)
var triggerCutsceneAtEndLevel = function() {
    if (gameMode == GAME_PACMAN) {
        if (level == 2) {
            playCutScene(pacmanCutscene1, readyNewState);
            return true;
        }
        /*
        else if (level == 5) {
            playCutScene(pacmanCutscene2, readyNewState);
            return true;
        }
        else if (level >= 9 && (level-9)%4 == 0) {
            playCutScene(pacmanCutscene3, readyNewState);
            return true;
        }
        */
    }
    else if (gameMode == GAME_MSPACMAN || gameMode == GAME_OTTO) {
        if (level == 2) {
            playCutScene(mspacmanCutscene1, readyNewState);
            return true;
        }
        else if (level == 5) {
            playCutScene(mspacmanCutscene2, readyNewState);
            return true;
        }
    }
    else if (gameMode == GAME_COOKIE) {
        if (level == 2) {
            playCutScene(cookieCutscene1, readyNewState);
            return true;
        }
        else if (level == 5) {
            playCutScene(cookieCutscene2, readyNewState);
            return true;
        }
    }

    // no cutscene triggered
    return false;
};

//////////////////////////////////////////////////////////////////////////////////////
// Maps

// Definitions of playable maps

// current map
var map;

// actor starting states

blinky.startDirEnum = DIR_LEFT;
blinky.startPixel = {
    x: 14*tileSize-1,
    y: 14*tileSize+midTile.y
};
blinky.cornerTile = {
    x: 28-1-2,
    y: 0
};
blinky.startMode = GHOST_OUTSIDE;
blinky.arriveHomeMode = GHOST_LEAVING_HOME;

pinky.startDirEnum = DIR_DOWN;
pinky.startPixel = {
    x: 14*tileSize-1,
    y: 17*tileSize+midTile.y,
};
pinky.cornerTile = {
    x: 2,
    y: 0
};
pinky.startMode = GHOST_PACING_HOME;
pinky.arriveHomeMode = GHOST_PACING_HOME;

inky.startDirEnum = DIR_UP;
inky.startPixel = {
    x: 12*tileSize-1,
    y: 17*tileSize + midTile.y,
};
inky.cornerTile = {
    x: 28-1,
    y: 36 - 2,
};
inky.startMode = GHOST_PACING_HOME;
inky.arriveHomeMode = GHOST_PACING_HOME;

clyde.startDirEnum = DIR_UP;
clyde.startPixel = {
    x: 16*tileSize-1,
    y: 17*tileSize + midTile.y,
};
clyde.cornerTile = {
    x: 0,
    y: 36-2,
};
clyde.startMode = GHOST_PACING_HOME;
clyde.arriveHomeMode = GHOST_PACING_HOME;

pacman.startDirEnum = DIR_LEFT;
pacman.startPixel = {
    x: 14*tileSize-1,
    y: 26*tileSize + midTile.y,
};

// Learning Map
var mapLearn = new Map(28, 36, (
    "____________________________" +
    "____________________________" +
    "____________________________" +
    "____________________________" +
    "____________________________" +
    "____________________________" +
    "____________________________" +
    "____________________________" +
    "____________________________" +
    "__||||||||||||||||||||||||__" +
    "__|                      |__" +
    "__| ||||| |||||||| ||||| |__" +
    "__| ||||| |||||||| ||||| |__" +
    "__| ||    ||    ||    || |__" +
    "__| || || || || || || || |__" +
    "||| || || || || || || || |||" +
    "       ||    ||    ||       " +
    "||| ||||| |||||||| ||||| |||" +
    "__| ||||| |||||||| ||||| |__" +
    "__|    ||          ||    |__" +
    "__| || || |||||||| || || |__" +
    "__| || || |||||||| || || |__" +
    "__| ||    ||    ||    || |__" +
    "__| || || || || || || || |__" +
    "||| || || || || || || || |||" +
    "       ||    ||    ||       " +
    "||| |||||||| || |||||||| |||" +
    "__| |||||||| || |||||||| |__" +
    "__|                      |__" +
    "__||||||||||||||||||||||||__" +
    "____________________________" +
    "____________________________" +
    "____________________________" +
    "____________________________" +
    "____________________________" +
    "____________________________"));

mapLearn.name = "Pac-Man";
mapLearn.wallStrokeColor = "#47b897"; // from Pac-Man Plus
mapLearn.wallFillColor = "#000";
mapLearn.pelletColor = "#ffb8ae";
mapLearn.shouldDrawMapOnly = true;

// Original Pac-Man map
var mapPacman = new Map(28, 36, (
    "____________________________" +
    "____________________________" +
    "____________________________" +
    "||||||||||||||||||||||||||||" +
    "|............||............|" +
    "|.||||.|||||.||.|||||.||||.|" +
    "|o||||.|||||.||.|||||.||||o|" +
    "|.||||.|||||.||.|||||.||||.|" +
    "|..........................|" +
    "|.||||.||.||||||||.||.||||.|" +
    "|.||||.||.||||||||.||.||||.|" +
    "|......||....||....||......|" +
    "||||||.||||| || |||||.||||||" +
    "_____|.||||| || |||||.|_____" +
    "_____|.||          ||.|_____" +
    "_____|.|| |||--||| ||.|_____" +
    "||||||.|| |______| ||.||||||" +
    "      .   |______|   .      " +
    "||||||.|| |______| ||.||||||" +
    "_____|.|| |||||||| ||.|_____" +
    "_____|.||          ||.|_____" +
    "_____|.|| |||||||| ||.|_____" +
    "||||||.|| |||||||| ||.||||||" +
    "|............||............|" +
    "|.||||.|||||.||.|||||.||||.|" +
    "|.||||.|||||.||.|||||.||||.|" +
    "|o..||.......  .......||..o|" +
    "|||.||.||.||||||||.||.||.|||" +
    "|||.||.||.||||||||.||.||.|||" +
    "|......||....||....||......|" +
    "|.||||||||||.||.||||||||||.|" +
    "|.||||||||||.||.||||||||||.|" +
    "|..........................|" +
    "||||||||||||||||||||||||||||" +
    "____________________________" +
    "____________________________"));

mapPacman.name = "Pac-Man";
//mapPacman.wallStrokeColor = "#47b897"; // from Pac-Man Plus
mapPacman.wallStrokeColor = "#2121ff"; // from original
mapPacman.wallFillColor = "#000";
mapPacman.pelletColor = "#ffb8ae";
mapPacman.constrainGhostTurns = function(tile,openTiles) {
    // prevent ghost from turning up at these tiles
    if ((tile.x == 12 || tile.x == 15) && (tile.y == 14 || tile.y == 26)) {
        openTiles[DIR_UP] = false;
    }
};

// Levels are grouped into "acts."
// In Ms. Pac-Man (and Cookie-Man) a map only changes after the end of an act.
// The levels within an act progress in difficulty.
// But the beginning of an act is generally easier than the end of the previous act to stave frustration.
// Completing an act results in a cutscene.
var getLevelAct = function(level) {
    // Act 1: (levels 1,2)
    // Act 2: (levels 3,4,5)
    // Act 3: (levels 6,7,8,9)
    // Act 4: (levels 10,11,12,13)
    // Act 5: (levels 14,15,16,17)
    // ...
    if (level <= 2) {
        return 1;
    }
    else if (level <= 5) {
        return 2;
    }
    else {
        return 3 + Math.floor((level - 6)/4);
    }
};

var getActColor = function(act) {
    if (gameMode == GAME_PACMAN) {
        return {
            wallFillColor: mapPacman.wallFillColor,
            wallStrokeColor: mapPacman.wallStrokeColor,
            pelletColor: mapPacman.pelletColor,
        };
    }
    else if (gameMode == GAME_MSPACMAN || gameMode == GAME_OTTO) {
        return getMsPacActColor(act);
    }
    else if (gameMode == GAME_COOKIE) {
        return getCookieActColor(act);
    }
};

var getActRange = function(act) {
    if (act == 1) {
        return [1,2];
    }
    else if (act == 2) {
        return [3,5];
    }
    else {
        var start = act*4-6;
        return [start, start+3];
    }
};

var getCookieActColor = function(act) {
    var colors = [
        "#359c9c", "#80d8fc", // turqoise
        "#c2b853", "#e6f1e7", // yellow
        "#86669c", "#f2c1db", // purple
        "#ed0a04", "#e8b4cd", // red
        "#2067c1", "#63e0b6", // blue
        "#c55994", "#fd61c3", // pink
        "#12bc76", "#b4e671", // green
        "#5036d9", "#618dd4", // violet
        "#939473", "#fdfdf4", // grey
    ];
    var i = ((act-1)*2) % colors.length;
    return {
        wallFillColor: colors[i],
        wallStrokeColor: colors[i+1],
        pelletColor: "#ffb8ae",
    };
};

var setNextCookieMap = function() {
    // cycle the colors
    var i;
    var act = getLevelAct(level);
    if (!map || level == 1 || act != getLevelAct(level-1)) {
        map = mapgen();
        var colors = getCookieActColor(act);
        map.wallFillColor = colors.wallFillColor;
        map.wallStrokeColor = colors.wallStrokeColor;
        map.pelletColor = colors.pelletColor;
    }
};

// Ms. Pac-Man map 1

var getMsPacActColor = function(act) {
    act -= 1;
    var mapIndex = (act <= 1) ? act : (act%2)+2;
    var maps = [mapMsPacman1, mapMsPacman2, mapMsPacman3, mapMsPacman4];
    var map = maps[mapIndex];
    if (act >= 4) {
        return [
            {
                wallFillColor: "#ffb8ff",
                wallStrokeColor: "#FFFF00",
                pelletColor: "#00ffff",
            },
            {
                wallFillColor: "#FFB8AE",
                wallStrokeColor: "#FF0000",
                pelletColor: "#dedeff",
            },
            {
                wallFillColor: "#de9751",
                wallStrokeColor: "#dedeff",
                pelletColor: "#ff0000",
            },
            {
                wallFillColor: "#2121ff",
                wallStrokeColor: "#ffb851",
                pelletColor: "#dedeff",
            },
        ][act%4];
    }
    else {
        return {
            wallFillColor: map.wallFillColor,
            wallStrokeColor: map.wallStrokeColor,
            pelletColor: map.pelletColor,
        };
    }
};

var setNextMsPacMap = function() {
    var maps = [mapMsPacman1, mapMsPacman2, mapMsPacman3, mapMsPacman4];

    // The third and fourth maps repeat indefinitely after the second map.
    // (i.e. act1=map1, act2=map2, act3=map3, act4=map4, act5=map3, act6=map4, ...)
    var act = getLevelAct(level)-1;
    var mapIndex = (act <= 1) ? act : (act%2)+2;
    map = maps[mapIndex];
    if (act >= 4) {
        var colors = getMsPacActColor(act+1);
        map.wallFillColor = colors.wallFillColor;
        map.wallStrokeColor = colors.wallStrokeColor;
        map.pelletColor = colors.pelletColor;
    }
};

var mapMsPacman1 = new Map(28, 36, (
    "____________________________" +
    "____________________________" +
    "____________________________" +
    "||||||||||||||||||||||||||||" +
    "|......||..........||......|" +
    "|o||||.||.||||||||.||.||||o|" +
    "|.||||.||.||||||||.||.||||.|" +
    "|..........................|" +
    "|||.||.|||||.||.|||||.||.|||" +
    "__|.||.|||||.||.|||||.||.|__" +
    "|||.||.|||||.||.|||||.||.|||" +
    "   .||.......||.......||.   " +
    "|||.||||| |||||||| |||||.|||" +
    "__|.||||| |||||||| |||||.|__" +
    "__|.                    .|__" +
    "__|.||||| |||--||| |||||.|__" +
    "__|.||||| |______| |||||.|__" +
    "__|.||    |______|    ||.|__" +
    "__|.|| || |______| || ||.|__" +
    "|||.|| || |||||||| || ||.|||" +
    "   .   ||          ||   .   " +
    "|||.|||||||| || ||||||||.|||" +
    "__|.|||||||| || ||||||||.|__" +
    "__|.......   ||   .......|__" +
    "__|.|||||.||||||||.|||||.|__" +
    "|||.|||||.||||||||.|||||.|||" +
    "|............  ............|" +
    "|.||||.|||||.||.|||||.||||.|" +
    "|.||||.|||||.||.|||||.||||.|" +
    "|.||||.||....||....||.||||.|" +
    "|o||||.||.||||||||.||.||||o|" +
    "|.||||.||.||||||||.||.||||.|" +
    "|..........................|" +
    "||||||||||||||||||||||||||||" +
    "____________________________" +
    "____________________________"));

mapMsPacman1.name = "Ms. Pac-Man 1";
mapMsPacman1.wallFillColor = "#FFB8AE";
mapMsPacman1.wallStrokeColor = "#FF0000";
mapMsPacman1.pelletColor = "#dedeff";
mapMsPacman1.fruitPaths = {
             "entrances": [
                 { "start": { "y": 164, "x": 228 }, "path": "<<<<vvv<<<<<<<<<^^^" }, 
                 { "start": { "y": 164, "x": -4 }, "path": ">>>>vvvvvv>>>>>>>>>>>>>>>^^^<<<^^^" }, 
                 { "start": { "y": 92, "x": -4 }, "path": ">>>>^^^^>>>vvvv>>>vvv>>>>>>>>>vvvvvv<<<" }, 
                 { "start": { "y": 92, "x": 228 }, "path": "<<<<vvvvvvvvv<<<^^^<<<vvv<<<" }
             ], 
             "exits": [
                 { "path": "<vvv>>>>>>>>>^^^>>>>" }, 
                 { "path": "<<<<vvv<<<<<<<<<^^^<<<<" }, 
                 { "path": "<<<<<<<^^^^^^<<<<<<^^^<<<<" }, 
                 { "path": "<vvv>>>>>>>>>^^^^^^^^^^^^>>>>" }
             ]
         };

// Ms. Pac-Man map 2

var mapMsPacman2 = new Map(28, 36, (
    "____________________________" +
    "____________________________" +
    "____________________________" +
    "||||||||||||||||||||||||||||" +
    "       ||..........||       " +
    "|||||| ||.||||||||.|| ||||||" +
    "|||||| ||.||||||||.|| ||||||" +
    "|o...........||...........o|" +
    "|.|||||||.||.||.||.|||||||.|" +
    "|.|||||||.||.||.||.|||||||.|" +
    "|.||......||.||.||......||.|" +
    "|.||.|||| ||....|| ||||.||.|" +
    "|.||.|||| |||||||| ||||.||.|" +
    "|......|| |||||||| ||......|" +
    "||||||.||          ||.||||||" +
    "||||||.|| |||--||| ||.||||||" +
    "|......|| |______| ||......|" +
    "|.||||.|| |______| ||.||||.|" +
    "|.||||.   |______|   .||||.|" +
    "|...||.|| |||||||| ||.||...|" +
    "|||.||.||          ||.||.|||" +
    "__|.||.|||| |||| ||||.||.|__" +
    "__|.||.|||| |||| ||||.||.|__" +
    "__|.........||||.........|__" +
    "__|.|||||||.||||.|||||||.|__" +
    "|||.|||||||.||||.|||||||.|||" +
    "   ....||...    ...||....   " +
    "|||.||.||.||||||||.||.||.|||" +
    "|||.||.||.||||||||.||.||.|||" +
    "|o..||.......||.......||..o|" +
    "|.||||.|||||.||.|||||.||||.|" +
    "|.||||.|||||.||.|||||.||||.|" +
    "|..........................|" +
    "||||||||||||||||||||||||||||" +
    "____________________________" +
    "____________________________"));

mapMsPacman2.name = "Ms. Pac-Man 2";
mapMsPacman2.wallFillColor = "#47b8ff";
mapMsPacman2.wallStrokeColor = "#dedeff";
mapMsPacman2.pelletColor = "#ffff00";
mapMsPacman2.fruitPaths = {
             "entrances": [
                 { "start": { "y": 212, "x": 228 }, "path": "<<<<^^^<<<<<<<<^^^<" }, 
                 { "start": { "y": 212, "x": -4 }, "path": ">>>>^^^>>>>>>>>vvv>>>>>^^^^^^<" }, 
                 { "start": { "y": 36, "x": -4 }, "path": ">>>>>>>vvv>>>vvvvvvv>>>>>>>>>vvvvvv<<<" }, 
                 { "start": { "y": 36, "x": 228 }, "path": "<<<<<<<vvv<<<vvvvvvvvvvvvv<<<" }
             ], 
             "exits": [
                 { "path": "vvv>>>>>>>>vvv>>>>" }, 
                 { "path": "vvvvvv<<<<<^^^<<<<<<<<vvv<<<<" }, 
                 { "path": "<<<<<<<^^^^^^^^^^^^^<<<^^^<<<<<<<" }, 
                 { "path": "vvv>>>>>^^^^^^^^^^>>>>>^^^^^^<<<<<^^^>>>>>>>" }
             ]
         };

// Ms. Pac-Man map 3

var mapMsPacman3 = new Map(28, 36, (
    "____________________________" +
    "____________________________" +
    "____________________________" +
    "||||||||||||||||||||||||||||" +
    "|.........||....||.........|" +
    "|.|||||||.||.||.||.|||||||.|" +
    "|o|||||||.||.||.||.|||||||o|" +
    "|.||.........||.........||.|" +
    "|.||.||.||||.||.||||.||.||.|" +
    "|....||.||||.||.||||.||....|" +
    "||||.||.||||.||.||||.||.||||" +
    "||||.||..............||.||||" +
    " ....|||| |||||||| ||||.... " +
    "|.|| |||| |||||||| |||| ||.|" +
    "|.||                    ||.|" +
    "|.|||| || |||--||| || ||||.|" +
    "|.|||| || |______| || ||||.|" +
    "|.     || |______| ||     .|" +
    "|.|| |||| |______| |||| ||.|" +
    "|.|| |||| |||||||| |||| ||.|" +
    "|.||                    ||.|" +
    "|.|||| ||||| || ||||| ||||.|" +
    "|.|||| ||||| || ||||| ||||.|" +
    "|......||....||....||......|" +
    "|||.||.||.||||||||.||.||.|||" +
    "|||.||.||.||||||||.||.||.|||" +
    "|o..||.......  .......||..o|" +
    "|.||||.|||||.||.|||||.||||.|" +
    "|.||||.|||||.||.|||||.||||.|" +
    "|......||....||....||......|" +
    "|.||||.||.||||||||.||.||||.|" +
    "|.||||.||.||||||||.||.||||.|" +
    "|......||..........||......|" +
    "||||||||||||||||||||||||||||" +
    "____________________________" +
    "____________________________"));

mapMsPacman3.name = "Ms. Pac-Man 3";
mapMsPacman3.wallFillColor = "#de9751";
mapMsPacman3.wallStrokeColor = "#dedeff";
mapMsPacman3.pelletColor = "#ff0000";
mapMsPacman3.fruitPaths = {
             "entrances": [
                 { "start": { "y": 100, "x": 228 }, "path": "<<<<<vv<<<<<vvvvvv<<<" }, 
                 { "start": { "y": 100, "x": -4 }, "path": ">>>>>vv>>>>>>>>>>>>>>vvvvvv<<<" }, 
                 { "start": { "y": 100, "x": -4 }, "path": ">>>>>vv>>>>>>>>>>>>>>vvvvvv<<<" }, 
                 { "start": { "y": 100, "x": 228 }, "path": "<<vvvvv<<<vvv<<<<<<<<" }
             ], 
             "exits": [
                 { "path": "<vvv>>>vvv>>>^^^>>>>>^^^^^^^^^^^>>" }, 
                 { "path": "<<<<vvv<<<vvv<<<^^^<<<<<^^^^^^^^^^^<<" }, 
                 { "path": "<<<<vvv<<<vvv<<<^^^<<<<<^^^^^^^^^^^<<" }, 
                 { "path": "<vvv>>>vvv>>>^^^^^^<<<^^^^^^>>>>>^^>>>>>" }
             ]
         };
mapMsPacman3.constrainGhostTurns = function(tile,openTiles,dirEnum) {
    // prevent ghost from turning down when exiting tunnels
    if (tile.y == 12) {
        if ((tile.x == 1 && dirEnum == DIR_RIGHT) || (tile.x == 26 && dirEnum == DIR_LEFT)) {
            openTiles[DIR_DOWN] = false;
        }
    }
};

// Ms. Pac-Man map 4

var mapMsPacman4 = new Map(28, 36, (
    "____________________________" +
    "____________________________" +
    "____________________________" +
    "||||||||||||||||||||||||||||" +
    "|..........................|" +
    "|.||.||||.||||||||.||||.||.|" +
    "|o||.||||.||||||||.||||.||o|" +
    "|.||.||||.||....||.||||.||.|" +
    "|.||......||.||.||......||.|" +
    "|.||||.||.||.||.||.||.||||.|" +
    "|.||||.||.||.||.||.||.||||.|" +
    "|......||....||....||......|" +
    "|||.|||||||| || ||||||||.|||" +
    "__|.|||||||| || ||||||||.|__" +
    "__|....||          ||....|__" +
    "||| ||.|| |||--||| ||.|| |||" +
    "    ||.|| |______| ||.||    " +
    "||||||.   |______|   .||||||" +
    "||||||.|| |______| ||.||||||" +
    "    ||.|| |||||||| ||.||    " +
    "||| ||.||          ||.|| |||" +
    "__|....||||| || |||||....|__" +
    "__|.||.||||| || |||||.||.|__" +
    "__|.||....   ||   ....||.|__" +
    "__|.|||||.|| || ||.|||||.|__" +
    "|||.|||||.|| || ||.|||||.|||" +
    "|.........||    ||.........|" +
    "|.||||.||.||||||||.||.||||.|" +
    "|.||||.||.||||||||.||.||||.|" +
    "|.||...||..........||...||.|" +
    "|o||.|||||||.||.|||||||.||o|" +
    "|.||.|||||||.||.|||||||.||.|" +
    "|............||............|" +
    "||||||||||||||||||||||||||||" +
    "____________________________" +
    "____________________________"));

mapMsPacman4.name = "Ms. Pac-Man 4";
mapMsPacman4.wallFillColor = "#2121ff";
mapMsPacman4.wallStrokeColor = "#ffb851";
mapMsPacman4.pelletColor = "#dedeff";
mapMsPacman4.fruitPaths = {
             "entrances": [
                 { "start": { "y": 156, "x": 228 }, "path": "<<<<vv<<<vv<<<<<<^^^" }, 
                 { "start": { "y": 156, "x": -4 }, "path": ">>>>vv>>>vv>>>>>>vvv>>>^^^^^^" }, 
                 { "start": { "y": 132, "x": -4 }, "path": ">>>>^^^^^>>>^^^>>>vvv>>>vvv>>>>>>vvvvvv<<<" }, 
                 { "start": { "y": 132, "x": 228 }, "path": "<<<<^^<<<vvv<<<vvv<<<" }
             ], 
             "exits": [
                 { "path": "<vvv>>>>>>^^>>>^^>>>>" }, 
                 { "path": "<<<<vvv<<<<<<^^<<<^^<<<<" }, 
                 { "path": "<<<<<<<^^^<<<^^^<<<vv<<<<" }, 
                 { "path": "<vvv>>>>>>^^^^^^^^^>>>vv>>>>" }
             ]
         };
//////////////////////////////////////////////////////////////////////////////////////
// VCR
// This coordinates the recording, rewinding, and replaying of the game state.
// Inspired by Braid.

var VCR_NONE = -1;
var VCR_RECORD = 0;
var VCR_REWIND = 1;
var VCR_FORWARD = 2;
var VCR_PAUSE = 3;

var vcr = (function() {

    var mode;

    // controls whether to increment the frame before recording.
    var initialized;

    // current time
    var time;

    // tracking speed
    var speedIndex;
    var speeds = [-8,-4,-2,-1,0,1,2,4,8];
    var speedCount = speeds.length;
    var speedColors = [
        "rgba(255,255,0,0.25)",
        "rgba(255,255,0,0.20)",
        "rgba(255,255,0,0.15)",
        "rgba(255,255,0,0.10)",
        "rgba(0,0,0,0)",
        "rgba(0,0,255,0.10)",
        "rgba(0,0,255,0.15)",
        "rgba(0,0,255,0.20)",
        "rgba(0,0,255,0.25)",
    ];

    // This is the number of "footprint" frames to display along the seek direction around a player
    // to create the rewind/forward blurring.  
    // This is also inversely used to determine the number of footprint frames to display OPPOSITE the seek direction
    // around a player.
    //
    // For example: 
    //   nextFrames = speedPrints[speedIndex];
    //   prevFrames = speedPrints[speedCount-1-speedIndex];
    var speedPrints = [
        18,// -8x
        13,// -4x
        8, // -2x
        3, // -1x
        3, //  0x
        10,//  1x
        15,//  2x
        20,//  4x
        25,//  8x
    ];

    // The distance between each footprint used in the rewind/forward blurring.
    // Step size grows when seeking speed increases to show emphasize time dilation.
    var speedPrintStep = [
        6,  // -8x
        5,  // -4x
        4,  // -2x
        3,  // -1x
        3,  //  0x
        3,  //  1x
        4,  //  2x
        5,  //  4x
        6,  //  8x
    ];

    // current frame associated with current time
    // (frame == time % maxFrames)
    var frame;

    // maximum number of frames to record
    var maxFrames = 15*60;

    // rolling bounds of the recorded frames
    var startFrame; // can't rewind past this
    var stopFrame; // can't replay past this

    // reset the VCR
    var reset = function() {
        time = 0;
        frame = 0;
        startFrame = 0;
        stopFrame = 0;
        states = {};
        startRecording();
    };

    // load the state of the current time
    var load = function() {
        var i;
        for (i=0; i<5; i++) {
            actors[i].load(frame);
        }
        elroyTimer.load(frame);
        energizer.load(frame);
        fruit.load(frame);
        ghostCommander.load(frame);
        ghostReleaser.load(frame);
        map.load(frame,time);
        loadGame(frame);
        if (state == deadState) {
            deadState.load(frame);
        }
        else if (state == finishState) {
            finishState.load(frame);
        }
    };

    // save the state of the current time
    var save = function() {
        var i;
        for (i=0; i<5; i++) {
            actors[i].save(frame);
        }
        elroyTimer.save(frame);
        energizer.save(frame);
        fruit.save(frame);
        ghostCommander.save(frame);
        ghostReleaser.save(frame);
        map.save(frame);
        saveGame(frame);
        if (state == deadState) {
            deadState.save(frame);
        }
        else if (state == finishState) {
            finishState.save(frame);
        }
    };

    // erase any states after the current time
    // (only necessary for saves that do interpolation)
    var eraseFuture = function() {
        map.eraseFuture(time);
        stopFrame = frame;
    };

    // increment or decrement the time
    var addTime = function(dt) {
        time += dt;
        frame = (frame+dt)%maxFrames;
        if (frame < 0) {
            frame += maxFrames;
        }
    };

    // measures the modular distance if increasing from x0 to x1 on our circular frame buffer.
    var getForwardDist = function(x0,x1) {
        return (x0 <= x1) ? x1-x0 : x1+maxFrames-x0;
    };

    // caps the time increment or decrement to prevent going over our rolling bounds.
    var capSeekTime = function(dt) {
        if (!initialized || dt == 0) {
            return 0;
        }
        var maxForward = getForwardDist(frame,stopFrame);
        var maxReverse = getForwardDist(startFrame,frame);
        return (dt > 0) ? Math.min(maxForward,dt) : Math.max(-maxReverse,dt);
    };

    var init = function() {
        mode = VCR_NONE;
    };

    // seek to the state at the given relative time difference.
    var seek = function(dt) {
        if (dt == undefined) {
            dt = speeds[speedIndex];
        }
        if (initialized) {
            addTime(capSeekTime(dt));
            load();
        }
    };

    // record a new state.
    var record = function() {
        if (initialized) {
            addTime(1);
            if (frame == startFrame) {
                startFrame = (startFrame+1)%maxFrames;
            }
            stopFrame = frame;
        }
        else {
            initialized = true;
        }
        save();
    };

    var startRecording = function() {
        mode = VCR_RECORD;
        initialized = false;
        eraseFuture();
        seekUpBtn.disable();
        seekDownBtn.disable();
        seekToggleBtn.setIcon(function(ctx,x,y,frame) {
            drawRewindSymbol(ctx,x,y,"#FFF");
        });
        seekToggleBtn.setText();
    };

    var refreshSeekDisplay = function() {
        seekToggleBtn.setText(speeds[speedIndex]+"x");
    };

    var startSeeking = function() {
        speedIndex = 3;
        updateMode();
        seekUpBtn.enable();
        seekDownBtn.enable();
        seekToggleBtn.setIcon(undefined);
        refreshSeekDisplay();
    };

    var nextSpeed = function(di) {
        if (speeds[speedIndex+di] != undefined) {
            speedIndex = speedIndex+di;
        }
        updateMode();
        refreshSeekDisplay();
    };

    var x,y,w,h;
    var pad = 5;
    x = mapWidth+1;
    h = 25;
    w = 25;
    y = mapHeight/2-h/2;
    var seekUpBtn = new Button(x,y-h-pad,w,h,
        function() {
            nextSpeed(1);
        });
    seekUpBtn.setIcon(function(ctx,x,y,frame) {
        drawUpSymbol(ctx,x,y,"#FFF");
    });
    var seekDownBtn = new Button(x,y+h+pad,w,h,
        function() {
            nextSpeed(-1);
        });
    seekDownBtn.setIcon(function(ctx,x,y,frame) {
        drawDownSymbol(ctx,x,y,"#FFF");
    });
    var seekToggleBtn = new ToggleButton(x,y,w,h,
        function() {
            return mode != VCR_RECORD;
        },
        function(on) {
            on ? startSeeking() : startRecording();
        });
    seekToggleBtn.setIcon(function(ctx,x,y,frame) {
        drawRewindSymbol(ctx,x,y,"#FFF");
    });
    seekToggleBtn.setFont((tileSize-1)+"px ArcadeR", "#FFF");
    var slowBtn = new ToggleButton(-w-pad-1,y,w,h,
        function() {
            return executive.getFramePeriod() == 1000/15;
        },
        function(on) {
            executive.setUpdatesPerSecond(on ? 15 : 60);
        });
    slowBtn.setIcon(function(ctx,x,y) {
        atlas.drawSnail(ctx,x,y,1);
    });

    var onFramePeriodChange = function() {
        if (slowBtn.isOn()) {
            slowBtn.setIcon(function(ctx,x,y) {
                atlas.drawSnail(ctx,x,y,0);
            });
        }
        else {
            slowBtn.setIcon(function(ctx,x,y) {
                atlas.drawSnail(ctx,x,y,1);
            });
        }
    };

    var onHudEnable = function() {
        if (practiceMode) {
            if (mode == VCR_NONE || mode == VCR_RECORD) {
                seekUpBtn.disable();
                seekDownBtn.disable();
            }
            else {
                seekUpBtn.enable();
                seekDownBtn.enable();
            }
            seekToggleBtn.enable();
            slowBtn.enable();
        }
    };

    var onHudDisable = function() {
        if (practiceMode) {
            seekUpBtn.disable();
            seekDownBtn.disable();
            seekToggleBtn.disable();
            slowBtn.disable();
        }
    };

    var isValidState = function() {
        return (
            !inGameMenu.isOpen() && (
            state == playState ||
            state == finishState ||
            state == deadState));
    };

    var draw = function(ctx) {
        if (practiceMode) {
            if (isValidState() && vcr.getMode() != VCR_RECORD) {
                // change the hue to reflect speed
                renderer.setOverlayColor(speedColors[speedIndex]);
            }

            if (seekUpBtn.isEnabled) {
                seekUpBtn.draw(ctx);
            }
            if (seekDownBtn.isEnabled) {
                seekDownBtn.draw(ctx);
            }
            if (seekToggleBtn.isEnabled) {
                seekToggleBtn.draw(ctx);
            }
            if (slowBtn.isEnabled) {
                slowBtn.draw(ctx);
            }
        }
    };

    var updateMode = function() {
        var speed = speeds[speedIndex];
        if (speed == 0) {
            mode = VCR_PAUSE;
        }
        else if (speed < 0) {
            mode = VCR_REWIND;
        }
        else if (speed > 0) {
            mode = VCR_FORWARD;
        }
    };

    return {
        init: init,
        reset: reset,
        seek: seek,
        record: record,
        draw: draw,
        onFramePeriodChange: onFramePeriodChange,
        onHudEnable: onHudEnable,
        onHudDisable: onHudDisable,
        eraseFuture: eraseFuture,
        startRecording: startRecording,
        startSeeking: startSeeking,
        nextSpeed: nextSpeed,
        isSeeking: function() {
            return (
                mode == VCR_REWIND ||
                mode == VCR_FORWARD ||
                mode == VCR_PAUSE);
        },
        getTime: function() { return time; },
        getFrame: function() { return frame; },
        getMode: function() { return mode; },

        drawHistory: function(ctx,callback) {
            if (!this.isSeeking()) {
                return;
            }

            // determine start frame
            var maxReverse = getForwardDist(startFrame,frame);
            var start = (frame - Math.min(maxReverse,speedPrints[speedIndex])) % maxFrames;
            if (start < 0) {
                start += maxFrames;
            }

            // determine end frame
            var maxForward = getForwardDist(frame,stopFrame);
            var end = (frame + Math.min(maxForward,speedPrints[speedCount-1-speedIndex])) % maxFrames;

            var backupAlpha = ctx.globalAlpha;
            ctx.globalAlpha = 0.2;
            
            var t = start;
            var step = speedPrintStep[speedIndex];
            if (start > end) {
                for (; t<maxFrames; t+=step) {
                    callback(t);
                }
                t %= maxFrames;
            }
            for (; t<end; t+=step) {
                callback(t);
            }

            ctx.globalAlpha = backupAlpha;
        },
    };
})();
//////////////////////////////////////////////////////////////////////////////////////
// Entry Point

window.addEventListener("load", function() { fuzeAssets.whenReady(function() {
    loadHighScores();
    initRenderer();
    atlas.create();
    initSwipe();
	var anchor = window.location.hash.substring(1);
	if (anchor == "learn") {
		switchState(learnState);
	}
	else if (anchor == "cheat_pac" || anchor == "cheat_mspac") {
		gameMode = (anchor == "cheat_pac") ? GAME_PACMAN : GAME_MSPACMAN;
		practiceMode = true;
        switchState(newGameState);
		for (var i=0; i<4; i++) {
			ghosts[i].isDrawTarget = true;
			ghosts[i].isDrawPath = true;
		}
	}
	else {
		switchState(homeState);
	}
    executive.init();
}); });
})();
