# Firecracker 网络设置入门

这是一份简易快速入门指南，用于将一个或多个 Firecracker 微虚拟机通过主机连接至互联网。若您运行的是生产环境配置，应考虑修改此设置以满足您的具体需求。

> [!NOTE]
>
> 目前，Firecracker 仅支持 TUN/TAP 网络后端，且不支持多队列功能。

本指南中的步骤默认将 `eth0` 视为主机上连接互联网的网络接口。若 `eth0` 并非您的主网络接口，请在以下命令中将其替换为正确的接口名称。同时默认使用 IPv4 协议，若需支持 IPv6，请相应调整操作步骤。

每个微虚拟机都需要一个主机网络接口（如`eth0`）和一个由 Firecracker 使用的 Linux `tap`设备（如`tap0`），但配置差异主要源于路由设置：即数据包如何从`tap`设备到达网络接口（出站）以及反向路径（入站）。配置微虚拟机路由主要有三种方法。

1. **基于 NAT**，本指南主体部分将详细介绍该方案。其实现简单，但无法使微虚拟机暴露于局域网（LAN）。
1. **基于桥接**，可使微虚拟机暴露于局域网。更多信息请参阅本指南的 _Advanced: Bridge-based routing_ 章节。
1. **命名空间 NAT**，与其他方法相比，这种方法牺牲了一定的性能，但在需要同时运行同一 microVM 的两个克隆实例的场景下非常有用。更多详情请参阅[克隆实例的网络连接](snapshotting/network-for-clones.md)指南。

要同时运行多个微虚拟机并使用基于 NAT 的路由，请参阅 _Advanced:Multiple guests_ 章节。相同原理也可应用于其他路由方法，但需要稍作调整。

在防火墙选择方面，建议在生产环境的 Linux 系统上使用 `nft`。但出于兼容性考虑，本指南同时提供 `nft` 与 `iptables-nft` 转换层两种选择。虽然后者[已不再推荐](https://access.redhat.com/solutions/6739041)，但可能更符合读者的使用习惯。

## 在主机上

任何微虚拟机在宿主机上的第一步都是创建一个 Linux `tap` 设备，Firecracker 将使用该设备进行网络通信。

对于此配置，仅需两个 IP 地址——一个用于`tap`设备，另一个用于客户机本身，您可通过该地址（例如使用`ssh`）连接至客户机。因此，我们将选择满足两个地址需求的最小 IPv4 子网：`/30`。
本虚拟机中，`tap`设备使用`172.16.0.1`，客户机使用`172.16.0.2`。

```bash
# 创建 tap 设备。
sudo ip tuntap add tap0 mode tap
# 为其分配 tap IP地址并启动设备。
sudo ip addr add 172.16.0.1/30 dev tap0
sudo ip link set tap0 up
```

> [!NOTE]
>
> TAP 设备的 IP 地址应选择为与主机 IP 地址不在同一子网。

我们需要在系统上启用 IPv4 转发功能。

```bash
echo 1 | sudo tee /proc/sys/net/ipv4/ip_forward
```

### 通过 `nft` 进行配置

我们需要一个用于路由需求的 nftables 表，并在该表内创建两个链：
一个用于`postrouting`阶段的 NAT，另一个用于`forward`阶段的过滤：

```bash
sudo nft add table firecracker
sudo nft 'add chain firecracker postrouting { type nat hook postrouting priority srcnat; policy accept; }'
sudo nft 'add chain firecracker filter { type filter hook forward priority filter; policy accept; }'
```

第一条规则需要伪装来自客户机 IP 的数据包，使其看起来像是来自主机 IP 发送的，具体方法是修改这些数据包的源 IP 地址：

```bash
sudo nft add rule firecracker postrouting ip saddr 172.16.0.2 oifname eth0 counter masquerade
```

第二条规则将接受来自 tap IP 的数据包（客户机将使用 tap IP 作为其网关，因此会将自身数据包通过 tap IP 进行路由），并将这些数据包转发至主机网络接口：

```bash
sudo nft add rule firecracker filter iifname tap0 oifname eth0 accept
```

### 通过 `iptables-nft` 进行配置

表和链由 `iptables-nft` 自动管理，但我们需要三条规则来执行 NAT 步骤：

```bash
sudo iptables-nft -t nat -A POSTROUTING -o eth0 -s 172.16.0.2 -j MASQUERADE
sudo iptables-nft -A FORWARD -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
sudo iptables-nft -A FORWARD -i tap0 -o eth0 -j ACCEPT
```

## 设置 Firecracker

> [!NOTE]
>
> 若使用[入门指南](getting-started.md)中的根文件系统，需指定特定`MAC`地址（如`06:00:AC:10:00:02`）。
> 在此 `MAC` 地址中，最后 4 个字节（`AC:10:00:02`）将代表虚拟机的 IP 地址。默认情况下为 `172.16.0.2`。
> 否则，可跳过网络配置中的 `guest_mac` 字段。此时虚拟机启动时将自动生成随机 MAC 地址。

---

> [!NOTE]
>
> 在虚拟机配置过程中使用的`iface_id`属于 Firecracker 内部标识，仅用于管理目的。
> 网络接口在客户机中的名称由客户机自身决定。
> 本例中假设客户机将该网络接口命名为`eth0`。

---

> [!NOTE]
>
> Firecracker 无法保证在客户机中初始化的网络接口顺序与用于配置它们的 API 调用顺序一致。
> 同时，大多数内核/发行版确实会按照 API 定义的顺序初始化设备。

在启动客户机之前，请使用 Firecracker 的 API 配置网络接口：

```bash
curl --unix-socket /tmp/firecracker.socket -i \
  -X PUT 'http://localhost/network-interfaces/my_network0' \
  -H 'Accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
      "iface_id": "my_network0",
      "guest_mac": "06:00:AC:10:00:02",
      "host_dev_name": "tap0"
    }'
```

若您使用的是配置文件而非 API，请在配置文件中添加如下内容：

```json
"network-interfaces": [
  {
    "iface_id": "my_network0",
    "guest_mac": "06:00:AC:10:00:02",
    "host_dev_name": "tap0"
  }
],
```

或者，如果您使用的是 firectl，请在命令行中添加`--tap-device=tap0/06:00:AC:10:00:02\`。

## 在客户机上

现在您需要为虚拟机分配 IP 地址，激活其网络接口，并将`tap`设备的 IP 设置为虚拟机的网关地址。这样数据包就能通过`tap`设备进行路由，随后由主机上预先配置的设置接收：

```bash
ip addr add 172.16.0.2/30 dev eth0
ip link set eth0 up
ip route add default via 172.16.0.1 dev eth0
```

现在您的访客设备应该能够将流量路由到互联网（假设您的主机能够访问互联网）。要完成任何有用的操作，您可能需要解析域名。在生产环境中，您需要使用适合您环境的正确 DNS 服务器。测试时，您可以在`/etc/resolv.conf`文件中添加一行类似以下内容的公共 DNS 服务器：

```console
nameserver 8.8.8.8
```

> [!NOTE]
>
> 有时，在客户机操作系统上安装`iproute2`（提供`ip`命令）并非理想选择，或者您希望这些步骤自动执行。
> 要实现此目标，请参阅[高级：使用内核命令行配置客户机网络](#高级-使用内核命令行配置客户机网络)章节。

## 清理

清理的第一步是删除主机上的 tap 设备：

```bash
sudo ip link del tap0
```

### 使用 `nft` 进行清理

您需要删除位于`postrouting`和`filter`链中的两条用于 NAT 路由的 nftables 规则。使用 nftables 实现此操作时，需通过以下命令查询这些规则的 _句柄_ （标识符）：

```bash
sudo nft -a list ruleset
```

现在，找到与两条规则相关的`# handle`注释并删除它们。例如，如果伪装规则的句柄为 1，转发规则的句柄为 2：

```bash
sudo nft delete rule firecracker postrouting handle 1
sudo nft delete rule firecracker filter handle 2
```

仅当主机上**没有其他客户机进程运行**时，请执行以下步骤：

将 IPv4 转发设置回禁用状态：

```bash
echo 0 | sudo tee /proc/sys/net/ipv4/ip_forward
```

若您正在使用 `nft`，请删除 `firecracker` 表以将您的 nftables 配置完全恢复至初始状态：

```bash
sudo nft delete table firecracker
```

### 使用 `iptables-nft` 进行清理

在已配置的 `iptables-nft` 规则中，若客户机仍存在于您的配置中，则应删除以下两条规则：

```bash
sudo iptables-nft -t nat -D POSTROUTING -o eth0 -s 172.16.0.2 -j MASQUERADE
sudo iptables-nft -D FORWARD -i tap0 -o eth0 -j ACCEPT
```

如果主机上**已无客户机运行**则同样将 IPv4 转发设置回禁用状态：

```bash
echo 0 | sudo tee /proc/sys/net/ipv4/ip_forward
```

并删除适用于所有访客的剩余 `conntrack` 规则：

```bash
sudo iptables-nft -D FORWARD -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
```

如果系统上没有其他进程使用 `iptables-nft`，您甚至可以像这样删除整个系统规则集：

```bash
sudo iptables-nft -F
sudo iptables-nft -t nat -F
```

## 高级：多客户机

要配置多个客户机，我们只需为每个微虚拟机重复本设置中的部分步骤：

1. 每个微虚拟机（microVM）拥有独立子网及两个内部 IP 地址：`tap` IP 和客户机 IP。
1. 每个 microVM 都有自己用于伪装（masquerading）和转发（forwarding）的两条 nftables 规则，而这些 microVM 可以共享同一张表和两个链。
1. 每个微虚拟机在客户系统内部拥有独立的路由配置（通过`iproute2`实现，或采用《高级：内核级宾客网络配置》章节所述方法）。

为了给出更具体的示例，让我们在已配置的微虚拟机基础上**添加第二个微虚拟机**：

假设我们在 172.16.0.0/16 范围内按顺序分配/30 子网，以尽可能少地分配地址。

在 172.16.0.0/16 范围内，下一个 /30 子网将提供以下两个 IP 地址：
172.16.0.5 作为 `tap` 接口的 IP 地址，172.16.0.6 作为虚拟机（guest）的 IP 地址。

我们的新`tap`设备将依次命名为`tap1`：

```bash
sudo ip tuntap add tap1 mode tap
sudo ip addr add 172.16.0.5/30 dev tap1
sudo ip link set tap1 up
```

现在，让我们添加两个新的 `nft` 规则，同时使用新的值：

```bash
sudo nft add rule firecracker postrouting ip saddr 172.16.0.6 oifname eth0 counter masquerade
sudo nft add rule firecracker filter iifname tap1 oifname eth0 accept
```

若使用 `iptables-nft`，请按以下方式添加规则：

```bash
sudo iptables-nft -t nat -A POSTROUTING -o eth0 -s 172.16.0.6 -j MASQUERADE
sudo iptables-nft -A FORWARD -i tap1 -o eth0 -j ACCEPT
```

修改您的 Firecracker 配置，将`host_dev_name`从`tap0`改为`tap1`，启动客户机并在其中执行路由设置，具体操作如下：修改虚拟机 IP 地址和`tap`接口 IP 地址：

```bash
ip addr add 172.16.0.6/30 dev eth0
ip link set eth0 up
ip route add default via 172.16.0.5 dev eth0
```

或者，您可以使用[高级：客户机网络配置](#高级-使用内核命令行配置客户机网络)中的设置方案，只需修改 G 和 T 变量即可，即访客 IP 和`tap`接口 IP。

> [!NOTE]
>
> 若需使用本文采用的顺序子网分配法计算访客和`tap` IP 地址，可使用以下针对 IPv4 地址的专用公式：
>
> `tap` IP = `172.16.[(A*O+1)/256].[(A*O+1)%256]`.
>
> Guest IP = `172.16.[(A*O+2)/256].[(A*O+2)%256]`.
>
> 将除法结果向下取整，并将`A`替换为子网内的 IP 地址数量（例如对于/30 子网，该值为 4 个地址），同时将`O`替换为微虚拟机的序列号（从 0 开始计数）。您> 可将`172.16`替换为 1 至 255 之间的任意数值，此操作与常规 IPv4 地址处理方式相同。
>
> 例如，让我们计算`172.16.0.0/16`范围内具有/30 子网的第 1000 个微虚拟机的地址：
>
> `tap` IP = `172.16.[(4*999+1)/256].[(4*999+1)%256]` = `172.16.15.157`.
>
> Guest IP = `172.16.[(4*999+2)/256].[(4*999+2)%256]` = `172.16.15.158`.
>
> 该分配方案已在`firecracker-demo`项目中成功应用，用于在同一主机上启动数千个微虚拟机：
> [相关代码行](https://github.com/firecracker-microvm/firecracker-demo/blob/63717c6e7fbd277bdec8e26a5533d53544a760bb/start-firecracker.sh#L45).

## 高级：基于桥接的路由

### 在主机上（基于桥接）

1. 创建桥接接口：

   ```bash
   sudo ip link add name br0 type bridge
   ```

1. 将[上面创建的](#在主机上) `tap` 设备添加到网桥中：

   ```bash
   sudo ip link set dev tap0 master br0
   ```

1. 为桥接器在您的网络中定义一个 IP 地址：

   例如，如果您的网关位于`192.168.1.1`，且您希望使用该地址获取动态 IP，则应为桥接器分配`192.168.1.0/24`子网中未使用的 IP 地址。

   ```bash
   sudo ip address add 192.168.1.7/24 dev br0
   ```

1. 添加防火墙规则以允许流量路由至虚拟机：

   ```bash
   sudo iptables -t nat -A POSTROUTING -o br0 -j MASQUERADE
   ```

1. 在清理配置时，请务必删除桥接器：

   ```bash
   sudo ip link del br0
   ```

### 在客户机上（基于桥接）

1. 在桥接子网中定义一个未使用的 IP 地址，例如`192.168.1.169/24`。

   **注意**：您也可以依赖 DHCP 从网关获取动态 IP 地址。

   ```bash
   ip addr add 192.168.1.169/24 dev eth0
   ```

1. 启用网络接口：

   ```bash
   ip link set eth0 up
   ```

1. 创建到桥接设备的路由

   ```bash
   ip r add 192.168.1.1 via 192.168.1.7 dev eth0
   ```

1. 通过桥接器创建通往互联网的路由

   ```bash
   ip r add default via 192.168.1.7 dev eth0
   ```

   完成后，您的路由表应类似于以下内容：

   ```bash
   ip r
   default via 192.168.1.7 dev eth0
   192.168.1.0/24 dev eth0 scope link
   192.168.1.1 via 192.168.1.7 dev eth0
   ```

1. 将您的域名服务器添加到 `/etc/resolve.conf` 中

   ```bash
   # cat /etc/resolv.conf
   nameserver 192.168.1.1
   ```

## 高级：使用内核命令行配置客户机网络

Linux 内核支持在启动时传递的 `ip` 命令行参数。在 Firecracker 中，启动参数通过启动源的 `boot_args` 属性进行配置（即 JSON 配置中的 `boot-source` 对象，或 API 服务器中对应的端点）。

在我们的配置中，`ip` CLI 参数的值将采用以下格式：`G::T:GM::GI:off`。其中 G 表示客户机 IP（不含子网），T 表示 `tap` IP（不含子网），GM 是客户机 CIDR 的“长”掩码 IP，GI 是客户机网络接口的名称。

代入我们的值，得到：
`ip=172.16.0.2::172.16.0.1:255.255.255.252::eth0:off`。将此内容添加至微虚拟机的启动参数末尾，宾客 Linux 内核将自动执行 _In the Guest_ 章节中的路由配置，无需在客户系统中安装`iproute2`。

一旦启动虚拟机，它就会自动连接到网络（前提是你正确执行了其他步骤）。
