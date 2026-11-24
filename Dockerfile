FROM debian:trixie
RUN apt-get update \
    && case "$(dpkg --print-architecture)" in \
         amd64) boot="grub-efi-amd64-bin grub-pc-bin syslinux syslinux-common isolinux" ;; \
         arm64) boot="grub-efi-arm64-bin" ;; \
       esac \
    && apt-get install -y --no-install-recommends \
       live-build debootstrap xorriso squashfs-tools mtools dosfstools $boot \
       ca-certificates rsync python3 python3-pil \
    && rm -rf /var/lib/apt/lists/*
