ARCH ?= amd64
IMAGE = fuzeos-builder:$(ARCH)

.PHONY: iso test clean

iso:
	docker build --platform linux/$(ARCH) -t $(IMAGE) .
	mkdir -p out
	docker run --rm --name fuzeos-build-$(ARCH) --privileged --platform linux/$(ARCH) \
		-e ARCH=$(ARCH) \
		-v "$(CURDIR)":/src:ro \
		-v fuzeos-work-$(ARCH):/work \
		-v "$(CURDIR)/out":/out \
		$(IMAGE) /src/build.sh

test:
ifeq ($(ARCH),arm64)
	qemu-system-aarch64 -M virt -accel hvf -cpu host -m 4G -smp 4 \
		-bios /opt/homebrew/share/qemu/edk2-aarch64-code.fd \
		-device virtio-gpu-pci -device qemu-xhci -device usb-kbd -device usb-tablet \
		-cdrom out/fuzeos-arm64.iso
else
	qemu-system-x86_64 -m 4G -smp 4 \
		-bios /opt/homebrew/share/qemu/edk2-x86_64-code.fd \
		-vga virtio -device qemu-xhci -device usb-tablet \
		-cdrom out/fuzeos-amd64.iso
endif

clean:
	docker volume rm -f fuzeos-work-amd64 fuzeos-work-arm64
	rm -rf out
