# FuzeOS

OS Linux fan-made non officiel autour de FuzeIII, basé sur Debian 13 (trixie) avec KDE Plasma.

## Construire l'ISO

Prérequis : Docker Desktop, QEMU (`brew install qemu`) et environ 20 Go libres.

```
make iso ARCH=arm64
make test ARCH=arm64
```

L'ISO amd64 se construit sur GitHub Actions (onglet Actions, workflow « ISO », ou en poussant un tag `v*`). Elle est publiée en release, découpée en morceaux :

```
cat fuzeos-amd64.iso.part* > fuzeos-amd64.iso
sha256sum -c fuzeos-amd64.iso.sha256
```

## Organisation

- `config/` : configuration live-build (paquets, hook, fichiers du système)
- `branding/` : Didier et les parcours générés
- `games/pacman/` : Pac-Man « Fuze VS Aywen » (basé sur masonicGIT/pacman, GPL-3.0)
- `wallpaper/` : fonds d'écran, le premier de `wallpapers.tsv` est celui par défaut
- `parcours/` : clips sources, `tools/parcours.py` les détoure (rembg, BiRefNet)
- `tools/` : génération de Didier, du splash et des parcours
