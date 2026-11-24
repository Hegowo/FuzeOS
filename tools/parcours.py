import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

HAUTEUR = 420
LARGEUR_COIN = 480
FPS = 30


def extraire(clip, dossier):
    dossier.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-i", str(clip), "-vf", f"fps={FPS}", str(dossier / "%03d.png")],
        check=True,
    )


def detourer(images, cache):
    from rembg import new_session, remove

    cache.mkdir(parents=True, exist_ok=True)
    session = None
    for image in images:
        cible = cache / image.name
        if cible.exists():
            continue
        session = session or new_session("birefnet-general")
        remove(Image.open(image), session=session).save(cible)
    return sorted(cache.glob("*.png"))


def nettoyer(image):
    rgba = np.array(image.convert("RGBA"))
    alpha = rgba[:, :, 3].astype(np.float32) / 255
    alpha[alpha < 0.12] = 0
    etiquettes, nombre = ndimage.label(alpha > 0.5)
    if nombre:
        aires = ndimage.sum(np.ones_like(alpha), etiquettes, range(1, nombre + 1))
        gardees = [i + 1 for i, aire in enumerate(aires) if aire >= 0.3 * aires.max()]
        zone = ndimage.binary_dilation(np.isin(etiquettes, gardees), iterations=6)
        alpha[~zone] = 0
    rgba[:, :, 3] = (alpha * 255).astype(np.uint8)
    return Image.fromarray(rgba)


def exporter_detoure(images, sortie):
    nettoyees = [nettoyer(Image.open(image)) for image in images]
    boites = [image.getbbox() for image in nettoyees if image.getbbox()]
    gauche = min(b[0] for b in boites)
    haut = min(b[1] for b in boites)
    droite = max(b[2] for b in boites)
    bas = max(b[3] for b in boites)
    echelle = HAUTEUR / (bas - haut)
    taille = (round((droite - gauche) * echelle), HAUTEUR)
    sortie.mkdir(parents=True, exist_ok=True)
    for i, image in enumerate(nettoyees):
        image.crop((gauche, haut, droite, bas)).resize(taille, Image.LANCZOS).save(sortie / f"{i:03d}.png", optimize=True)


def exporter_complet(images, sortie):
    sortie.mkdir(parents=True, exist_ok=True)
    for i, image in enumerate(images):
        trame = Image.open(image).convert("RGB")
        hauteur = round(trame.height * LARGEUR_COIN / trame.width)
        trame.resize((LARGEUR_COIN, hauteur), Image.LANCZOS).save(sortie / f"{i:03d}.jpg", quality=82)


def main():
    racine = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    sources = racine / "parcours"
    destination = racine / "branding" / "parcours"
    for clip in sorted(sources.glob("*.mp4")):
        with tempfile.TemporaryDirectory() as temporaire:
            trames = Path(temporaire)
            extraire(clip, trames)
            images = sorted(trames.glob("*.png"))
            detourees = detourer(images, sources / ".cache" / clip.stem)
            cible = destination / clip.stem
            shutil.rmtree(cible, ignore_errors=True)
            exporter_detoure(detourees, cible / "detoure")
            exporter_complet(images, cible / "complet")
        print(f"{clip.stem} : {len(images)} images")


if __name__ == "__main__":
    main()
