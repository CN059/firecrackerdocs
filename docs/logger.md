# firecracker logger 配置

对于日志记录功能，Firecracker 使用单一的 Logger 对象。该 Logger 既可通过向 `/logger` 路径发送 `PUT` API 请求进行配置，也可通过命令行配置。您只能通过上述任一方式对 Logger 进行一次配置，配置完成后无法更新。

## 先决条件

要配置 Logger，首先需要创建用于记录日志的资源：

```bash
# 创建所需的命名管道：
mkfifo logs.fifo

# 该 logger 也可处理常规文件：
touch logs.file
```

## 使用 API 套接字进行配置

您可以通过发送以下 API 命令来配置 Logger：

```bash
curl --unix-socket /tmp/firecracker.socket -i \
    -X PUT "http://localhost/logger" \
    -H "accept: application/json" \
    -H "Content-Type: application/json" \
    -d "{
             "log_path": "logs.fifo",
             "level": "Warning",
             "show_level": false,
             "show_log_origin": false
    }"
```

有关必填字段和可选字段的详细信息，请参阅[Swagger 定义文件](https://github.com/firecracker-microvm/firecracker/blob/main/src/firecracker/swagger/firecracker.yaml)。

## 使用命令行参数进行配置

若需在启动时配置 Logger 且不使用 API 套接字，可通过向 Firecracker 进程传递参数`--log-path`实现：

```bash
./firecracker --api-sock /tmp/firecracker.socket --log-path
<path_to_the_logging_fifo_or_file>
```

其他 Logger 字段在此情况下采用默认值：`Level -> Warning`, `show_level -> false`, `show_log_origin -> false`。
若需配置这些参数，也可传递以下可选参数：`--level <log_level>`, `--show-level`, `--show-log-origin`：

```bash
./firecracker --api-sock /tmp/firecracker.socket --log-path
logs.fifo --level Error --show-level --show-log-origin
```

## 从日志记录目标读取

`logs.fifo` 管道将存储可供人类阅读的日志，例如错误、警告等（具体取决于日志级别）。

若指定的路径为命名管道，可使用以下脚本从中读取数据：

```shell
logs=logs.fifo

while true
do
    if read line <$logs; then
        echo $line
    fi
done

echo "Reader exiting"

```

否则，如果路径指向普通文件，只需执行：

```shell script
cat logs.file
```
