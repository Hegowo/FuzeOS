#!/bin/sh
set -e
cd "$(dirname "$0")"
OUTPUT="pacman.js"
cat > "$OUTPUT" <<'HEADER'

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
HEADER
for file in \
    inherit.js sound.js random.js game.js direction.js Map.js colors.js \
    mapgen.js atlas.js renderers.js hud.js galagaStars.js Button.js Menu.js \
    inGameMenu.js sprites.js fuzeSprites.js fuze.js Actor.js Ghost.js Player.js \
    actors.js targets.js ghostCommander.js ghostReleaser.js elroyTimer.js \
    energizer.js fruit.js executive.js states.js input.js cutscenes.js maps.js \
    vcr.js main.js
do
    cat "src/$file" >> "$OUTPUT"
done
echo "})();" >> "$OUTPUT"
