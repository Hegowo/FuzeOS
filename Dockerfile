FROM debian:trixie
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       live-build debootstrap xorriso squashfs-tools mtools dosfstools \
       grub-efi-amd64-bin grub-pc-bin grub-efi-arm64-bin syslinux syslinux-common isolinux \
       ca-certificates rsync python3 python3-pil \
    && rm -rf /var/lib/apt/lists/*
