import sys
from pathlib import Path

from PIL import Image, ImageFilter

SOURCE = Path("branding/didier/peluche.png")
MARGE = 0.06


def est_oeil(r, g, b, a):
    return a > 200 and r > 150 and r > g + 60 and g > b


def charger():
    image = Image.open(SOURCE).convert("RGBA")
    boite = image.getbbox()
    image = image.crop(boite)
    cote = round(max(image.size) * (1 + 2 * MARGE))
    carre = Image.new("RGBA", (cote, cote))
    carre.paste(image, ((cote - image.width) // 2, (cote - image.height) // 2))
    return carre


def cligner(image):
    resultat = image.copy()
    pixels = resultat.load()
    masque = Image.new("L", image.size)
    trace = masque.load()
    for y in range(image.height):
        for x in range(image.width):
            if est_oeil(*pixels[x, y]):
                trace[x, y] = 255
    masque = masque.filter(ImageFilter.MaxFilter(15))
    boite = masque.getbbox()
    if not boite:
        return resultat
    gauche, haut, droite, bas = boite
    trait = bas - (bas - haut) // 5
    hauteur = trait - haut
    tissu = image.crop((gauche, haut - hauteur - 10, droite, haut - 10))
    paupiere = Image.new("RGBA", image.size)
    paupiere.paste(tissu, (gauche, haut))
    zone = masque.point(lambda v: 255 if v else 0)
    zone.paste(0, (0, trait, image.width, image.height))
    resultat.paste(paupiere, (0, 0), zone.filter(ImageFilter.GaussianBlur(3)))
    return resultat


def main():
    sortie = Path(sys.argv[1] if len(sys.argv) > 1 else "branding/didier")
    sortie.mkdir(parents=True, exist_ok=True)
    ouvert = charger()
    ferme = cligner(ouvert)
    ouvert.resize((192, 192), Image.LANCZOS).save(sortie / "didier.png")
    ferme.resize((192, 192), Image.LANCZOS).save(sortie / "didier-blink.png")
    ouvert.resize((256, 256), Image.LANCZOS).save(sortie / "didier-256.png")
    ouvert.resize((512, 512), Image.LANCZOS).save(sortie / "didier-512.png")


if __name__ == "__main__":
    main()
