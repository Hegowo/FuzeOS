# Crédits

**FUZE VS AYWEN** est un mod fan-made pour FuzeOS du remake de Pac-Man de Shaun Williams (contributions de Mason Borda).

- Source : https://github.com/masonicGIT/pacman (commit `7407174`), fork de https://github.com/shaunew/Pac-Man
- Licence : GNU GPL v3 (voir `LICENSE` et `COPYING`), le mod est distribué sous la même licence.
- Polices : `ARCADE_R.TTF` fournie avec le dépôt d’origine ; Press Start 2P de CodeMan38 (SIL Open Font License, voir `font/LICENSE.txt`).
- Pac-Man © Namco (1980). Projet non officiel, sans lien avec Namco, FuzeIII ou Aywen.

Modifications : sprites de Pac-Man et des fantômes remplacés par les têtes de FuzeIII et d'Aywen (`src/fuze.js`, `src/fuzeSprites.js`), écran d'accueil et game over refaits, contrôles ZQSD, modes Ms. Pac-Man et Cookie-Man retirés du menu. `./build.sh` régénère `pacman.js` à partir de `src/`.
