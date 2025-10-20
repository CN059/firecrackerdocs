# 使用 Firecracker 熵设备

## 什么是熵设备

熵设备是一种[`virtio-rng`设备][1]，为客户机提供“用于客户机的优质随机数”。客户机以缓冲区形式发出请求，该缓冲区将由设备填充随机字节。设备用于填充缓冲区的随机字节来源是一个实现上的决定。

在客户机侧，内核将通过设备接收的随机字节作为额外的熵源。此外，客户机 VirtIO 驱动程序暴露了`/dev/hwrng`字符设备。用户空间应用程序可以使用此设备向该设备请求随机字节。

## Firecracker 实现

Firecracker 提供附加单个 `virtio-rng` 设备的功能。用户可通过 `/entropy` API 接口进行配置。请求主体包含一个（可选）参数用于配置速率限制器。

例如，用户可以像这样为熵设备配置 10KB/秒的带宽速率限制器：

```console
curl --unix-socket $socket_location -i \
    -X PUT 'http://localhost/entropy' \
    -H 'Accept: application/json' \
    -H 'Content-Type: application/json' \
    -d "{
        \"rate_limiter\": {
            \"bandwidth\": {
                \"size\": 1000,
                \"one_time_burst\": 0,
                \"refill_time\": 100
            }
        }
    }"
```

若使用配置文件配置微虚拟机，可通过添加如下部分实现相同设置：

```json
"entropy": {
    "rate_limiter": {
        "bandwidth" {
            "size": 1000,
            "one_time_burst": 0,
            "refill_time": 100
        }
    }
}
```

在主机端，Firecracker 依赖[`aws-lc-rs`][2]获取随机字节。`aws-lc-rs`使用[`AWS-LC`加密库][3]。

## 先决条件

要使用熵设备，用户必须使用以`virtio-rng` 前端驱动程序作为模块编译或加载的内核。相关的内核配置选项是`CONFIG_HW_RANDOM_VIRTIO`（该选项依赖于
`CONFIG_HW_RANDOM` 和 `CONFIG_VIRTIO`）。

[1]: https://docs.oasis-open.org/virtio/virtio/v1.2/cs01/virtio-v1.2-cs01.html#x1-3050004
[2]: https://docs.rs/aws-lc-rs/latest/aws_lc_rs/index.html
[3]: https://github.com/aws/aws-lc
