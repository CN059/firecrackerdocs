# 为 Firecracker 创建和使用 [`initrd`](https://zh.wikipedia.org/wiki/Initrd)

## 创建

### 基于 Alpine 或 SUSE

你可以使用 [`此脚本`](https://github.com/marcov/firecracker-initrd)  来生成基于 Alpine Linux 或 SUSE Linux 的 initrd。

该脚本会从各个发行版中提取其初始化系统（init system），并创建一个 initrd。

### 自定义方式

如果你正在构建自己的初始化程序（init），或需要在 initrd 中包含特定的文件或逻辑，可以使用此方法手动创建 initrd。

```bash
mkdir initrd
cp /path/to/your/init initrd/init
# 复制 initrd/ 中所需的一切
cd initrd
find . -print0 | cpio --null --create --verbose --format=newc > initrd.cpio
```

## 使用方法

在设置启动源（boot source）时，添加 `initrd_path` 字段，如下所示：

```shell
curl --unix-socket /tmp/firecracker.socket -i \
    -X PUT 'http://localhost/boot-source'   \
    -H 'Accept: application/json'           \
    -H 'Content-Type: application/json'     \
    -d "{
        \"kernel_image_path\": \"/path/to/kernel\",
        \"boot_args\": \"console=ttyS0 reboot=k panic=1 pci=off\",
        \"initrd_path\": \"/path/to/initrd.cpio\"
    }"
```

### Notes

- 不要在使用 initrd 时指定 `is_root_device: true` 的磁盘
- 确保内核配置中启用了 `CONFIG_BLK_DEV_INITRD=y`
- 如果您不想将 init 放置在 initrd 的根目录下，可以将`rdinit=/path/to/init` 添加到 `boot_args` 属性中。
- 如果您打算在 init 中使用 `pivot_root`, 则无法实现。因为 initrd 已作为 rootfs 挂载，无法卸载。 您需要使用`switch_root` 来代替。
