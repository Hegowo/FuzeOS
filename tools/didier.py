import random
import sys
from pathlib import Path

from PIL import Image

OBSIDIENNE = [(15, 10, 21), (28, 20, 38), (43, 29, 58), (61, 42, 82)]
BORD = (8, 5, 12)
OEIL = (255, 122, 26)
REFLET = (255, 192, 97)
PAUPIERE = (150, 62, 14)


def pixels(cligne):
    rng = random.Random(83)
    grille = [[rng.choices(OBSIDIENNE, weights=[5, 4, 2, 1])[0] for _ in range(16)] for _ in range(16)]
    for i in range(16):
        grille[0][i] = grille[15][i] = grille[i][0] = grille[i][15] = BORD
    for x0 in (3, 10):
        if cligne:
            for x in range(x0, x0 + 3):
                grille[8][x] = PAUPIERE
        else:
            for y in range(6, 9):
                for x in range(x0, x0 + 3):
                    grille[y][x] = OEIL
            grille[6][x0] = REFLET
    return grille


def rendu(cligne, taille):
    image = Image.new("RGBA", (16, 16))
    for y, ligne in enumerate(pixels(cligne)):
        for x, couleur in enumerate(ligne):
            image.putpixel((x, y), couleur + (255,))
    return image.resize((taille, taille), Image.NEAREST)


def main():
    sortie = Path(sys.argv[1] if len(sys.argv) > 1 else "branding/didier")
    sortie.mkdir(parents=True, exist_ok=True)
    rendu(False, 192).save(sortie / "didier.png")
    rendu(True, 192).save(sortie / "didier-blink.png")
    rendu(False, 256).save(sortie / "didier-256.png")


if __name__ == "__main__":
    main()
