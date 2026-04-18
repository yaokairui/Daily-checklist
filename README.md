# 日常清单 - 桌面待办事项管理工具

一款轻量级跨平台桌面清单工具，帮助你高效管理每日待办事项，提升执行力。

## 功能特性

- **快速创建** - 双击空白区域或使用快捷键 `Ctrl+Shift+N` 快速创建清单
- **清单管理** - 添加、编辑、删除待办事项，支持优先级设置（高/中/低）
- **完成追踪** - 标记完成状态，实时显示完成率和进度条
- **提醒功能** - 为事项设置提醒时间，到时自动通知
- **模板系统** - 保存常用清单格式，一键复用
- **回收站** - 删除的清单可恢复，支持永久删除和清空操作
- **桌面置顶** - 窗口置顶功能，透明度可调节
- **主题切换** - 支持浅色/深色/跟随系统三种模式
- **数据导出** - 支持 JSON 和 TXT 格式导出，支持导入
- **本地存储** - 所有数据本地保存，保护隐私安全
- **自动保存** - 每10秒自动保存，防止数据丢失
- **跨平台** - 支持 Windows、macOS、Linux

## 安装

### 下载安装包

从 [Releases](../../releases) 页面下载对应平台的安装包：

| 平台 | 格式 | 说明 |
|------|------|------|
| Windows | `.exe` | NSIS 安装程序，支持自定义安装路径 |
| Windows | `.exe` (Portable) | 免安装便携版 |
| macOS | `.dmg` | 支持 Intel 和 Apple Silicon |
| Linux | `.AppImage` | 通用格式，无需安装 |
| Linux | `.deb` | Debian/Ubuntu |
| Linux | `.rpm` | Fedora/RHEL |

### 从源码构建

**环境要求：**
- Node.js >= 18
- npm >= 9

```bash
# 克隆仓库
git clone https://github.com/your-username/daily-checklist.git
cd daily-checklist

# 安装依赖
npm install

# 生成图标资源
node generate-icons.js

# 启动开发模式
npm start

# 打包构建
npm run build:win     # Windows
npm run build:mac     # macOS
npm run build:linux   # Linux
npm run build:all     # 全平台
```

## 使用说明

### 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Shift+N` | 快速创建新清单 |
| `Enter` | 添加新事项 |
| `Escape` | 关闭弹窗 |
| `双击侧边栏空白` | 创建新清单 |

### 命令行启动

```bash
# 正常启动
daily-checklist

# 启动并创建新清单
daily-checklist --new
daily-checklist -n

# 启动并显示主窗口
daily-checklist --show
daily-checklist -s
```

### 置顶功能

- 点击标题栏的 📌 按钮切换窗口置顶
- 在设置中调节窗口透明度（30%~100%）
- 置顶状态在重启后保持

### 回收站

- 删除清单时自动移入回收站
- 可从回收站恢复或永久删除
- 支持一键清空回收站

## 技术栈

- **框架**: Electron 35
- **前端**: 原生 HTML/CSS/JS
- **存储**: 本地文件系统 (JSON)
- **打包**: electron-builder

## 项目结构

```
daily-checklist/
├── main.js              # Electron 主进程
├── preload.js           # 预加载脚本（IPC 桥接）
├── package.json         # 项目配置
├── src/
│   ├── index.html       # 主界面
│   ├── css/
│   │   └── style.css    # 样式（含主题变量）
│   ├── js/
│   │   ├── app.js       # 应用逻辑
│   │   └── store.js     # 数据存储模块
│   └── assets/          # 图标资源
├── build/               # 打包资源
├── test/                # 测试
├── .github/             # GitHub 配置
└── LICENSE              # MIT 许可证
```

## 贡献

欢迎贡献代码！请阅读 [贡献指南](CONTRIBUTING.md) 了解详情。

## 许可证

[MIT License](LICENSE)
