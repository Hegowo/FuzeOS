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
