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

    fetch(url)
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
