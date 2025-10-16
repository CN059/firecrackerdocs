# 开始使用 Firecracker

**所有资源仅用于演示目的，不用于生产。**

## 先决条件

您可以通过运行`firecracker/tools/devtool checkenv`来检查您的系统是否满足要求。

运行 Firecracker 的一种惯用方法是使用 Ubuntu 24.04 启动一个
[EC2](https://aws.amazon.com/ec2/) `c5.metal` 实例。

Firecracker 需要 [KVM Linux 内核模块](https://www.linux-kvm.org/)
来执行其虚拟化和仿真任务。

我们专门使用 `.metal` 实例类型，因为 EC2 仅支持 `.metal` 实例类型上的 KVM。

### 架构与操作系统

Firecracker 支持 **x86_64** 和 **aarch64** Linux，请参阅
[具体支持的内核](kernel-policy)。

### KVM

Firecracker 需要对 KVM 模块公开的 `/dev/kvm` 进行读/写访问。

可以使用以下方法检查 KVM 模块是否存在：

```bash
lsmod | grep kvm
```

如果KVM存在，则示例输出如下：

```bash
kvm_intel             348160  0
kvm                   970752  1 kvm_intel
irqbypass              16384  1 kvm
```

一些 Linux 发行版使用 `kvm` 组来管理对 `/dev/kvm` 的访问，
而其他发行版则依赖访问控制列表。如果您已安装发行版的 ACL 包，则可以使用以下命令授予读写权限：

```bash
sudo setfacl -m u:${USER}:rw /dev/kvm
```

如果通过 `kvm` 组管理访问，请检查 KVM 组是否存在：

```bash
getent group kvm
```

并检查 `/dev/kvm` 是否与 kvm 组关联：

```bash
ls -l /dev/kvm
```

您可以通过运行以下命令查看当前用户是否已在 kvm 组中：

```bash
groups
```

否则，运行以下命令将当前用户添加到组中：

```bash
[ $(stat -c "%G" /dev/kvm) = kvm ] && sudo usermod -aG kvm ${USER} \
&& echo "Access granted."
```

如果以上方法均无效，您需要为您的发行版安装文件系统 [`ACL 包`](https://wiki.archlinuxcn.org/wiki/%E8%AE%BF%E9%97%AE%E6%8E%A7%E5%88%B6%E5%88%97%E8%A1%A8) 并使用上述 `setfacl` 命令，或者以 `root` 权限运行Firecracker（通过 `sudo` ）。

您可以使用以下命令检查您是否有权访问 `/dev/kvm` ：

```bash
[ -r /dev/kvm ] && [ -w /dev/kvm ] && echo "OK" || echo "FAIL"
```

## 运行Firecracker

在生产环境中，Firecracker 被设计为在 **隔离执行环境** （execution jail）内安全运行，
该环境由 [`jailer`](../src/jailer/) 二进制文件设置。我们的
[集成测试套件](#运行集成测试套件) 就是这样实现的。

为了简单起见，本指南将不使用 [`jailer`](../src/jailer/)。

### 获取 rootfs 和客户机内核映像（Guest Kernel Image）

要成功启动 microVM，您需要一个未压缩的 Linux 内核二进制文件，
以及一个 ext4 文件系统映像（用作 rootfs）。本指南使用我们 CI 中提供的最新版本的内核映像和 Ubuntu rootfs。

```bash
ARCH="$(uname -m)"
release_url="https://github.com/firecracker-microvm/firecracker/releases"
latest_version=$(basename $(curl -fsSLI -o /dev/null -w  %{url_effective} ${release_url}/latest))
CI_VERSION=${latest_version%.*}
latest_kernel_key=$(curl "http://spec.ccfc.min.s3.amazonaws.com/?prefix=firecracker-ci/$CI_VERSION/$ARCH/vmlinux-&list-type=2" \
    | grep -oP "(?<=<Key>)(firecracker-ci/$CI_VERSION/$ARCH/vmlinux-[0-9]+\.[0-9]+\.[0-9]{1,3})(?=</Key>)" \
    | sort -V | tail -1)

# 下载 Linux 内核二进制文件
wget "https://s3.amazonaws.com/spec.ccfc.min/${latest_kernel_key}"

latest_ubuntu_key=$(curl "http://spec.ccfc.min.s3.amazonaws.com/?prefix=firecracker-ci/$CI_VERSION/$ARCH/ubuntu-&list-type=2" \
    | grep -oP "(?<=<Key>)(firecracker-ci/$CI_VERSION/$ARCH/ubuntu-[0-9]+\.[0-9]+\.squashfs)(?=</Key>)" \
    | sort -V | tail -1)
ubuntu_version=$(basename $latest_ubuntu_key .squashfs | grep -oE '[0-9]+\.[0-9]+')

# 从 Firecracker CI 下载 rootfs
wget -O ubuntu-$ubuntu_version.squashfs.upstream "https://s3.amazonaws.com/spec.ccfc.min/$latest_ubuntu_key"

# 我们的 CI 中的 rootfs 不包含用于连接到 VM 的 SSH 密钥
# 为了演示的目的，让我们创建一个并将其放入 rootfs 中
unsquashfs ubuntu-$ubuntu_version.squashfs.upstream
ssh-keygen -f id_rsa -N ""
cp -v id_rsa.pub squashfs-root/root/.ssh/authorized_keys
mv -v id_rsa ./ubuntu-$ubuntu_version.id_rsa
# 创建 ext4 文件系统映像
sudo chown -R root:root squashfs-root
truncate -s 1G ubuntu-$ubuntu_version.ext4
sudo mkfs.ext4 -d squashfs-root -F ubuntu-$ubuntu_version.ext4

# 验证所有设置是否正确并打印版本
echo
echo "The following files were downloaded and set up:"
KERNEL=$(ls vmlinux-* | tail -1)
[ -f $KERNEL ] && echo "Kernel: $KERNEL" || echo "ERROR: Kernel $KERNEL does not exist"
ROOTFS=$(ls *.ext4 | tail -1)
e2fsck -fn $ROOTFS &>/dev/null && echo "Rootfs: $ROOTFS" || echo "ERROR: $ROOTFS is not a valid ext4 fs"
KEY_NAME=$(ls *.id_rsa | tail -1)
[ -f $KEY_NAME ] && echo "SSH Key: $KEY_NAME" || echo "ERROR: Key $KEY_NAME does not exist"
```

### 获取 Firecracker 二进制文件

获取 Firecracker 二进制文件有两种方式：

- 从我们的[发布页面](https://github.com/firecracker-microvm/firecracker/releases) 下载 Firecracker 官方版本
- 从源代码构建

要下载最新的 firecracker 版本，请运行：

```bash
ARCH="$(uname -m)"
release_url="https://github.com/firecracker-microvm/firecracker/releases"
latest=$(basename $(curl -fsSLI -o /dev/null -w  %{url_effective} ${release_url}/latest))
curl -L ${release_url}/download/${latest}/firecracker-${latest}-${ARCH}.tgz \
| tar -xz

# 将二进制文件重命名为“firecracker”
mv release-${latest}-$(uname -m)/firecracker-${latest}-${ARCH} firecracker
```

要从源代码构建 Firecracker，您需要安装 `docker`：

```bash
ARCH="$(uname -m)"

# 克隆 Firecracker 存储库
git clone https://github.com/firecracker-microvm/firecracker firecracker_src

# 启动docker
sudo systemctl start docker

# 构建 Firecracker
#
# 可以通过传递参数“-l gnu”来构建 GNU 版本。
#
# 这将在
# `./firecracker/build/cargo_target/${toolchain}/debug` 下生成 Firecracker 和 Jailer 二进制文件。
#
sudo ./firecracker_src/tools/devtool build

# 将二进制文件重命名为“firecracker”
sudo cp ./firecracker_src/build/cargo_target/${ARCH}-unknown-linux-musl/debug/firecracker firecracker
```

### 启动 Firecracker

运行 Firecracker 需要两个终端，第一个终端运行 Firecracker 二进制文件，第二个终端用于通过 HTTP 请求与 Firecracker 进程通信：
：

```bash
API_SOCKET="/tmp/firecracker.socket"

# 删除 API unix 套接字
sudo rm -f $API_SOCKET

# 运行 firecracker
sudo ./firecracker --api-sock "${API_SOCKET}" --enable-pci
```

`--enable-pci` 标志指示 Firecracker 使用PCI VirtIO transport 创建所有 VirtIO 设备。此标志是可选的。如果未指定，Firecracker 将使用传统的 MMIO transport 创建设备。我们建议用户启用PCI transport，因为它可以为 VirtIO 设备带来更高的吞吐量和更低的延迟。有关使用 PCI 的客户机内核要求的更多信息，请参阅我们的[内核策略文档](./kernel-policy.md)。

在新终端中（不要关闭第一个终端）：

```bash
TAP_DEV="tap0"
TAP_IP="172.16.0.1"
MASK_SHORT="/30"

# 设置网络接口
sudo ip link del "$TAP_DEV" 2> /dev/null || true
sudo ip tuntap add dev "$TAP_DEV" mode tap
sudo ip addr add "${TAP_IP}${MASK_SHORT}" dev "$TAP_DEV"
sudo ip link set dev "$TAP_DEV" up

# 启用 IP 转发
sudo sh -c "echo 1 > /proc/sys/net/ipv4/ip_forward"
sudo iptables -P FORWARD ACCEPT

# 这会尝试确定要转发客户机出站网络流量的主机网络接口的名称。
# 如果出站流量不起作用，请仔细检查是否返回了正确的接口！
HOST_IFACE=$(ip -j route list default |jq -r '.[0].dev')

# 设置 microVM 互联网访问
sudo iptables -t nat -D POSTROUTING -o "$HOST_IFACE" -j MASQUERADE || true
sudo iptables -t nat -A POSTROUTING -o "$HOST_IFACE" -j MASQUERADE

API_SOCKET="/tmp/firecracker.socket"
LOGFILE="./firecracker.log"

# 创建日志文件
touch $LOGFILE

# 设置日志文件
sudo curl -X PUT --unix-socket "${API_SOCKET}" \
    --data "{
        \"log_path\": \"${LOGFILE}\",
        \"level\": \"Debug\",
        \"show_level\": true,
        \"show_log_origin\": true
    }" \
    "http://localhost/logger"

KERNEL="./$(ls vmlinux* | tail -1)"
KERNEL_BOOT_ARGS="console=ttyS0 reboot=k panic=1"

ARCH=$(uname -m)

if [ ${ARCH} = "aarch64" ]; then
    KERNEL_BOOT_ARGS="keep_bootcon ${KERNEL_BOOT_ARGS}"
fi

# 设置启动源（boot source）
sudo curl -X PUT --unix-socket "${API_SOCKET}" \
    --data "{
        \"kernel_image_path\": \"${KERNEL}\",
        \"boot_args\": \"${KERNEL_BOOT_ARGS}\"
    }" \
    "http://localhost/boot-source"

ROOTFS="./$(ls *.ext4 | tail -1)"

# 设置 rootfs
sudo curl -X PUT --unix-socket "${API_SOCKET}" \
    --data "{
        \"drive_id\": \"rootfs\",
        \"path_on_host\": \"${ROOTFS}\",
        \"is_root_device\": true,
        \"is_read_only\": false
    }" \
    "http://localhost/drives/rootfs"

# 客户端的 IP 地址是通过 `fcnet-setup.sh` 从其 MAC 地址获取的，该地址已在客户端 rootfs 中预先配置。
# 重要的是，`TAP_IP` 和 `FC_MAC` 必须匹配。
FC_MAC="06:00:AC:10:00:02"

# 设置网络接口
sudo curl -X PUT --unix-socket "${API_SOCKET}" \
    --data "{
        \"iface_id\": \"net1\",
        \"guest_mac\": \"$FC_MAC\",
        \"host_dev_name\": \"$TAP_DEV\"
    }" \
    "http://localhost/network-interfaces/net1"

# API 请求是异步处理的，因此在 `InstanceStart`（实例启动） 之前设置配置非常重要。
sleep 0.015s

# 启动 microVM
sudo curl -X PUT --unix-socket "${API_SOCKET}" \
    --data "{
        \"action_type\": \"InstanceStart\"
    }" \
    "http://localhost/actions"

# API 请求是异步处理的，因此，在我们尝试通过 SSH 连接到 microVM 之前，务必确保 microVM 已经启动。

sleep 2s

KEY_NAME=./$(ls *.id_rsa | tail -1)

# 在客户机中设置互联网访问
ssh -i $KEY_NAME root@172.16.0.2  "ip route add default via 172.16.0.1 dev eth0"

# 在客户机中设置 DNS 解析
ssh -i $KEY_NAME root@172.16.0.2  "echo 'nameserver 8.8.8.8' > /etc/resolv.conf"

# 通过 SSH 进入 microVM
ssh -i $KEY_NAME root@172.16.0.2

# 使用 `root` 作为登录名和密码。
# 运行 `reboot` 退出。
```

在客户机中发出 `rebo​​ot` 命令将正常关闭 Firecracker 。这是因为 Firecracker 未实现客户机的电源管理。

### 在不发送 API 请求的情况下配置 microVM

你可以通过向 Firecracker 进程传递 `--config-file` 参数，在不使用 API 套接字的情况下启动客户机。例如：

```wrap
sudo ./firecracker --api-sock /tmp/firecracker.socket --config-file <path_to_the_configuration_file>
```

`path_to_the_configuration_file` 是一个 JSON 文件的路径，其中包含 microVM 所有资源的配置。该 JSON 必须包含客户机内核（guest kernel）和根文件系统（rootfs）的配置，其他资源均为可选。 使用此配置方式会直接启动 microVM，因此你需要在 JSON 中指定所有希望在启动前配置的资源。各资源的名称可参见 [`firecracker.yaml`](https://github.com/firecracker-microvm/firecracker/blob/main/src/firecracker/swagger/firecracker.yaml)  ，其字段名称与 API 请求中使用的字段名称完全一致。

这里提供了一个配置文件示例：
[`tests/framework/vm_config.json`](https://github.com/firecracker-microvm/firecracker/tree/main/tests/framework/vm_config.json)。

客户机启动后，请参阅 [network-setup](./network-setup.md#in-the-guest)在客户机中启动网络。

microVM 启动后，您仍然可以使用套接字发送 API 请求以执行启动后操作。

### 构建 Firecracker

可以通过传递 `--ssh-keys` 标志来使用 SSH 从私有 Git 仓库中拉取代码库，该标志用于指定主机上公钥和私钥的路径。在拉取仓库时，Git 身份验证需要同时提供公钥和私钥。

```bash
tools/devtool build --ssh-keys ~/.ssh/id_rsa.pub ~/.ssh/id_rsa
```

仅支持一组凭据。`devtool` 无法拉取依赖不同凭据的多个私有仓库。

`tools/devtool build` 默认以 `debug` 模式进行构建。若要构建发布版（release）二进制文件，请传递 `--release` 参数，例如：`tools/devtool build --release`。

可通过运行 `tools/devtool --help` 查看 `devtool` 的使用说明文档。

## 运行集成测试套件

集成测试可以通过 `tools/devtool test` 命令运行。

该测试套件旨在确保我们在 EC2 .metal 实例上测得的 [SLA 指标](../SPECIFICATION.md)。因此，如果不在这些机型上运行，性能测试可能会失败。特别地，如果你在非 EC2 .metal 实例上运行时看到 `tests/integration_tests/performance/test_process_startup_time.py` 测试失败，请不必担心。你可以通过以下方式跳过性能测试：

```bash
./tools/devtool test -- --ignore integration_tests/performance
```

如果你在 EC2 `.metal` 实例上运行集成测试时遇到如下所示的失败：

`FAILED integration_tests/style/test_markdown.py::test_markdown_style -  requests.exceptions.ReadTimeout: HTTPConnectionPool(host='169.254.169.254', port=80): Read timed out. (read timeout=2)`

请尝试运行`aws ec2 modify-instance-metadata-options --instance-id i-<your  instance id> --http-put-response-hop-limit 2`。
集成测试框架使用 IMDSv2（EC2 实例元数据服务 v2）来获取实例类型等信息。由于 IMDS 请求将经过 Docker，因此需要额外的跃点。

## 使用 `curl` 访问 API 时出现错误

请检查以下几点，以确认 API 套接字正在运行且可访问：

- 检查运行 Firecracker 进程的用户和使用 `curl` 的用户是否拥有同等权限。例如，如果您使用 **sudo** 运行 Firecracker，则请确保也使用 **sudo** 运行 `curl`。
- [SELinux](https://man7.org/linux/man-pages/man8/selinux.8.html) 可以基于 RHEL 的发行版管控对套接字的访问。用户权限的配置方式因环境而异，但为了便于排查问题，你可以检查 `/etc/selinux/config` 文件，确认 SELinux 是否已启用。
- 使用 `--api-sock /tmp/firecracker.socket` 命令运行 Firecracker 进程，确认套接字已打开：
  - `ss -a | grep '/tmp/firecracker.socket'`
  - 如果您有可用的 socat，请尝试`socat - UNIX-CONNECT:/tmp/firecracker.socket` 命令。如果套接字无法访问，这将抛出一个明确的错误，或者暂停并等待输入以继续。
