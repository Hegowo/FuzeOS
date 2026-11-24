# FuzeOS

OS Linux fan-made non officiel autour de FuzeIII, basé sur Debian 13 (trixie) avec KDE Plasma.

## Télécharger l'ISO amd64

Récupère les fichiers `fuzeos-amd64.iso.part*` et `fuzeos-amd64.iso.sha256` dans [Releases](https://github.com/Hegowo/FuzeOS/releases), puis assemble-les.

Linux :

```
cat fuzeos-amd64.iso.part* > fuzeos-amd64.iso
sha256sum -c fuzeos-amd64.iso.sha256
```

macOS :

```
cat fuzeos-amd64.iso.part* > fuzeos-amd64.iso
shasum -a 256 -c fuzeos-amd64.iso.sha256
```

Windows (invite de commandes) :

```
copy /b fuzeos-amd64.iso.part0 + fuzeos-amd64.iso.part1 fuzeos-amd64.iso
certutil -hashfile fuzeos-amd64.iso SHA256
```

Compare le résultat de `certutil` avec le contenu de `fuzeos-amd64.iso.sha256`.

## Construire l'ISO

Il faut environ 20 Go libres. L'ISO est créée dans `out/`.

### Linux

```
sudo apt install docker.io make git
sudo usermod -aG docker $USER
```

Déconnecte-toi puis reconnecte-toi, puis :

```
git clone https://github.com/Hegowo/FuzeOS.git
cd FuzeOS
make iso
```

### macOS

Installe [Docker Desktop](https://www.docker.com/products/docker-desktop/) et lance-le, puis :

```
xcode-select --install
git clone https://github.com/Hegowo/FuzeOS.git
cd FuzeOS
make iso ARCH=arm64
```

`ARCH=arm64` donne une ISO pour Mac Apple Silicon (UTM). Sur un Mac Intel, utilise `make iso`.

### Windows

1. Installe WSL dans PowerShell en administrateur, puis redémarre :

   ```
   wsl --install
   ```

2. Installe [Docker Desktop](https://www.docker.com/products/docker-desktop/), puis active Ubuntu dans Settings > Resources > WSL integration.
3. Dans le terminal Ubuntu :

   ```
   sudo apt install make git
   git clone https://github.com/Hegowo/FuzeOS.git
   cd FuzeOS
   make iso
   ```

L'ISO est accessible depuis l'Explorateur dans `\\wsl$\Ubuntu\home\<utilisateur>\FuzeOS\out`.

Clone le dépôt dans Ubuntu (`~`), pas dans `/mnt/c` : les fichiers Windows perdent leurs droits Linux.

### Libérer l'espace après le build

```
make clean
```
