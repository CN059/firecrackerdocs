# 创建自定义根文件系统和内核映像

## 创建 Linux 内核映像

### 手动编译

目前，Firecracker 在 x86_64 架构上支持未压缩的 ELF 内核映像，而在 aarch64 架构上则支持 PE 格式映像。

以下是快速构建可供 Firecracker 启动的自定义内核的分步指南：

1. 获取 Linux 源代码：

   ```bash
   git clone https://github.com/torvalds/linux.git linux.git
   cd linux.git
   ```

1. 检出要构建的 Linux 版本（例如，我们这里将使用 v4.20）：

   ```bash
   git checkout v4.20
   ```

1. 您需要配置 Linux 构建环境。可从我们推荐的[客户机内核配置](../resources/guest_configs/) 开始，将相关配置文件复制到 `.config`（位于 Linux 源代码目录下）。您可通过以下命令进行交互式配置调整：

   ```bash
   make menuconfig
   ```

> [!NOTE]
>
> 构建内核配置文件的方式多种多样，不仅限于 `menuconfig`。
> 您可自由选择任意一种方式。

1. 构建内核映像：

   ```bash
   arch=$(uname -m)
   if [ "$arch" = "x86_64" ]; then
        make vmlinux
   elif [ "$arch" = "aarch64" ]; then
        make Image
   fi
   ```

1. 构建成功后，您可以在 `./vmlinux`（x86 架构）或 `./arch/arm64/boot/Image`（aarch64 架构）目录下找到内核映像文件。

有关当前支持的内核版本列表，请查看[内核支持策略](kernel-policy.md)。

### 使用预设方案

我们在持续集成中用于测试 Firecracker 功能的内核镜像是通过运行脚本`resources/rebuild.sh`获取的。

用户可通过运行以下命令在本地构建这些内容：

```bash
./tools/devtool build_ci_artifacts kernels
```

这将构建我们当前在 CI 中使用的所有内核版本。`kernels` 子命令允许传入一个特定的内核版本进行构建。例如：

```bash
./tools/devtool build_ci_artifacts kernels 6.1
```

将仅构建 6.1 内核。

当前支持的内核版本为：`5.10`、`5.10-no-acpi`（与 5.10 相同，但不支持 ACPI）以及 `6.1`。

命令执行完成后，构建好的内核及其对应的 KConfig 配置文件将被存储在 `resources/$(uname -m)` 目录下。

## 创建 Linux 根文件系统映像

根文件系统映像本质上就是一个文件系统映像，至少包含一个初始化系统。
例如，我们的入门指南使用的是 ext4 文件系统映像。请注意，无论选择哪种文件系统，都必须将其支持编译到内核中，以便在启动时挂载。

要获取可与 Firecracker 配合使用的 ext4 映像，您有以下几种选择：

### 手动构建

1. 准备大小合适的文件。此处使用 50MiB，但具体取决于您希望放入多少数据：

   ```bash
   dd if=/dev/zero of=rootfs.ext4 bs=1M count=50
   ```

1. 在创建的文件上建立空文件系统：

   ```bash
   mkfs.ext4 rootfs.ext4
   ```

此时`rootfs.ext4`已生成空的 EXT4 映像，接下来准备填充内容。首先需挂载新文件系统以便访问其内容：

```bash
mkdir /tmp/my-rootfs
sudo mount rootfs.ext4 /tmp/my-rootfs
```

最简化的初始化系统仅是一个 ELF 二进制文件，位于`/sbin/init`路径下。Linux 启动过程的最后一步会执行`/sbin/init`，并期望该程序永不退出。更复杂的初始化系统在此基础上构建，提供服务配置文件、各类服务的启动/关闭脚本以及诸多其他功能。

为简化操作，我们建立一个基于 Alpine 的根文件系统，并采用 OpenRC 作为初始化系统。为此，我们将使用官方的 Alpine Linux Docker 镜像：

1. 首先启动 Alpine 容器，将先前创建的 EXT4 镜像挂载到 `/my-rootfs`：

   ```bash
   docker run -it --rm -v /tmp/my-rootfs:/my-rootfs alpine
   ```

1. 然后，在容器内部安装 OpenRC 初始化系统以及一些基本工具：

   ```bash
   apk add openrc
   apk add util-linux
   ```

1. 并设置用户空间初始化程序（仍处于容器 shell 中）：

   ```bash
   # 在串行控制台（ttyS0）上设置登录终端：
   ln -s agetty /etc/init.d/agetty.ttyS0
   echo ttyS0 > /etc/securetty
   rc-update add agetty.ttyS0 default

   # 确保特殊文件系统在启动时挂载：
   rc-update add devfs boot
   rc-update add procfs boot
   rc-update add sysfs boot

   # 然后，将新配置的系统复制到根文件系统映像中：
   for d in bin etc lib root sbin usr; do tar c "/$d" | tar x -C /my-rootfs; done

   # 上述命令可能会触发以下提示：
   # tar: Removing leading "/" from member names
   # 但这仅为警告信息，您仍可继续执行设置流程。

   for dir in dev proc run sys var; do mkdir /my-rootfs/${dir}; done

   # 完成，退出 Docker 终端。
   exit
   ```

1. 最后，卸载您的根文件系统映像：

   ```bash
   sudo umount /tmp/my-rootfs
   ```

### 使用预设配置

我们 CI 中用于测试 Firecracker 功能的磁盘镜像，是通过以下方法（在 Ubuntu 22.04 主机上）生成的：

```bash
./tools/devtool build_ci_artifacts rootfs
```

使用此方法生成的镜像为精简版 Ubuntu 22.04。请根据实际需求自由调整脚本。

您现在应获得一个根文件系统镜像（`ubuntu-22.04.ext4`），可通过 Firecracker 进行引导。

## 创建 FreeBSD 根文件系统和内核映像

以下是快速构建 FreeBSD 根文件系统和内核的分步指南，Firecracker 可由此启动：

1. 启动 FreeBSD 系统。在 EC2 中，[FreeBSD 13 市场映像](https://aws.amazon.com/marketplace/pp/prodview-ukzmy5dzc6nbq)是不错的选择；您也可以使用 FreeBSD 项目发布的每周快照 AMI。（Firecracker 支持需 FreeBSD 14 及以上版本，因此构建时需使用 FreeBSD 13 或更高版本。）

   构建过程约需 50 GB 磁盘空间，请预留足够容量。

1. 登录 FreeBSD 系统并获取 root 权限。若使用 EC2，请通过 SSH 以`ec2-user`身份登录（需使用预先配置的 SSH 密钥），随后执行`su`切换至 root 用户。

1. 安装 git 并检出 FreeBSD 源代码树：

   ```sh
   pkg install -y git
   git clone https://git.freebsd.org/src.git /usr/src
   ```

   自 FreeBSD 14.0 版本（2023 年 11 月发布）起支持 Firecracker。

1. 构建 FreeBSD：

   ```sh
   make -C /usr/src buildworld buildkernel KERNCONF=FIRECRACKER
   make -C /usr/src/release firecracker DESTDIR=`pwd`
   ```

你现在应该在当前目录（或者如果你修改了 DESTDIR 的值，则在指定目录）中得到了一个 rootfs 文件 freebsd-rootfs.bin 和一个内核文件 freebsd-kern.bin，它们可以直接用于 Firecracker 启动。需要注意的是，通过这种方式生成的 FreeBSD rootfs 相比“标准版” FreeBSD 已经过一定程度的精简；它移除了仅在物理系统上有用的工具（例如与软盘、USB 设备和某些网络接口相关的工具），同时也去除了调试文件和系统编译器。
