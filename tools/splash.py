import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from didier import rendu

POLICE = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FOND = (15, 10, 21)
ORANGE = (255, 122, 26)


def main():
    sortie = Path(sys.argv[1])
    largeur, hauteur = int(sys.argv[2]), int(sys.argv[3])
    image = Image.new("RGB", (largeur, hauteur), FOND)
    taille = hauteur // 4
    didier = rendu(False, taille)
    x = largeur // 2 - taille // 2
    image.paste(didier, (x, hauteur // 16), didier)
    dessin = ImageDraw.Draw(image)
    titre = ImageFont.truetype(POLICE, hauteur // 12)
    sous_titre = ImageFont.truetype(POLICE, hauteur // 30)
    y = hauteur // 16 + taille + hauteur // 40
    dessin.text((largeur // 2, y), "FuzeOS", font=titre, fill=ORANGE, anchor="mt")
    dessin.text((largeur // 2, y + hauteur // 10), "1.0 Améthyste", font=sous_titre, fill=(220, 210, 235), anchor="mt")
    image.save(sortie)


if __name__ == "__main__":
    main()
