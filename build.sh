#!/bin/bash
set -euo pipefail

ARCH="${ARCH:-amd64}"
export ARCH

rsync -a --delete --filter='P cache/' --exclude .git --exclude out /src/ /work/
cd /work

root=config/includes.chroot
install -d "$root/usr/share/fuzeos/games" "$root/usr/share/wallpapers" \
    "$root/usr/share/icons/hicolor/256x256/apps" "$root/usr/share/pixmaps"

cp -a games/pacman "$root/usr/share/fuzeos/games/pacman"
cp branding/didier/*.png "$root/usr/share/fuzeos/"
cp branding/didier/didier.png branding/didier/didier-blink.png "$root/usr/share/plymouth/themes/fuzeos/"
cp branding/didier/didier-256.png "$root/usr/share/icons/hicolor/256x256/apps/fuzeos.png"
cp branding/didier/didier-256.png "$root/usr/share/pixmaps/fuzeos.png"
cp branding/didier/didier-256.png "$root/etc/calamares/branding/fuzeos/didier.png"

defaut=1
while IFS=$'\t' read -r fichier id nom; do
    [ -n "$fichier" ] || continue
    taille=$(python3 -c 'import sys; from PIL import Image; w, h = Image.open(sys.argv[1]).size; print(f"{w}x{h}")' "wallpaper/$fichier")
    dossier="$root/usr/share/wallpapers/$id"
    install -d "$dossier/contents/images"
    cp "wallpaper/$fichier" "$dossier/contents/images/$taille.png"
    printf '{\n    "KPlugin": {\n        "Id": "%s",\n        "Name": "%s",\n        "Authors": [{ "Name": "FuzeOS" }]\n    }\n}\n' "$id" "$nom" > "$dossier/metadata.json"
    if [ "$defaut" = 1 ]; then
        ln -sf "/usr/share/wallpapers/$id/contents/images/$taille.png" "$root/usr/share/fuzeos/wallpaper-defaut.png"
        defaut=0
    fi
done < wallpaper/wallpapers.tsv

lb clean
lb config
lb build

install -d /out
cp -v ./*.iso "/out/fuzeos-$ARCH.iso"
