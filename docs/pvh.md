# PVH boot mode

Firecracker 支持以“PVH 直接启动”模式引导 x86 内核[具体规范详见 Xen 项目](https://github.com/xen-project/xen/blob/master/docs/misc/pvh.pandoc)。
若提供的内核包含 XEN_ELFNOTE_PHYS32_ENTRY ELF 注释，则将采用此启动模式。该模式专为直接加载内核的虚拟化环境设计，相较于从传统引导加载程序启动的“Linux 引导”模式更为简洁。

可在内核配置中设置 `CONFIG_PVH=y` 以启用 Linux 的 PVH 引导模式（此设置并非默认配置）。

自 FreeBSD 14.0 起支持 Firecracker，FreeBSD 默认启用 PVH 引导模式。构建 FreeBSD 内核和根文件系统的说明可参阅[此处](rootfs-and-kernel-setup.md)。
