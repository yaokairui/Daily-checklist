# 日常清单 - 桌面便利贴式待办事项管理工具

一款轻量级跨平台桌面清单工具，以便利贴风格悬浮在桌面上，帮助你高效管理每日待办事项，提升执行力。

## 功能特性

- **便利贴风格** - 类似 Apple 小组件的桌面悬浮设计，小巧不占空间
- **桌面置顶** - 窗口置顶悬浮，透明度可调节，贴附在桌面背景上
- **快速创建** - 使用快捷键 `Ctrl+Shift+N` 快速创建清单
- **清单管理** - 添加、编辑、删除待办事项，支持优先级设置（高/中/低）
- **完成追踪** - 标记完成状态，实时显示完成率和进度条
- **提醒功能** - 为事项设置提醒时间，到时自动通知
- **模板系统** - 保存常用清单格式，一键复用
- **回收站** - 删除的清单可恢复，支持永久删除和清空操作
- **主题切换** - 支持浅色/深色/跟随系统三种模式
- **数据导出** - 支持 JSON 和 TXT 格式导出
- **本地存储** - 所有数据本地保存，保护隐私安全
- **自动保存** - 每10秒自动保存，防止数据丢失
- **跨平台** - 支持 Windows、macOS、Linux

## 安装

### 下载安装包

从 [Releases](https://github.com/yaokairui/Daily-checklist/releases) 页面下载对应平台的安装包：

| 平台 | 格式 | 说明 |
|------|------|------|
| Windows | `Setup-x64.exe` | NSIS 安装程序，支持自定义安装路径、桌面快捷方式 |
| Windows | `Portable-x64.exe` | 免安装便携版，双击即可运行 |
| macOS | `.dmg` | 支持 Intel 和 Apple Silicon |
| Linux | `.AppImage` | 通用格式，无需安装 |
| Linux | `.deb` | Debian/Ubuntu |
| Linux | `.rpm` | Fedora/RHEL |

### Windows 安装说明

1. **安装版**：下载 `日常清单-x.x.x-Setup-x64.exe`，双击运行安装向导
   - 支持自定义安装路径
   - 自动创建桌面快捷方式和开始菜单项
   - 安装完成后从桌面快捷方式或开始菜单启动

2. **便携版**：下载 `日常清单-x.x.x-Portable-x64.exe`
   - 无需安装，双击即可运行
   - 可放在任意位置（如U盘），随身携带

### 从源码构建

**环境要求：**
- Node.js >= 18
- npm >= 9

```bash
# 克隆仓库
git clone https://github.com/yaokairui/Daily-checklist.git
cd Daily-checklist

# 安装依赖
npm install

# 生成图标资源
node generate-icons.js
node generate-ico.js

# 启动开发模式
npm start

# 打包构建
npm run build:win     # Windows
npm run build:mac     # macOS
npm run build:linux   # Linux
npm run build:all     # 全平台
```

## 使用说明

### 快速上手

1. 安装或解压后，双击 `日常清单` 图标启动应用
2. 应用以便利贴形式悬浮在桌面上
3. 在输入框中输入事项内容，按 Enter 或点击 + 按钮添加
4. 点击事项前的圆圈标记完成
5. 悬停事项可显示编辑和删除按钮

### 界面操作

| 操作 | 说明 |
|------|------|
| 拖拽标题栏 | 移动窗口位置 |
| 📌 按钮 | 切换窗口置顶 |
| ◐ 按钮 | 展开/收起透明度滑块 |
| ⋯ 按钮 | 打开更多菜单 |
| 标题文字 | 点击可编辑清单名称 |

### 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Shift+N` | 快速创建新清单 |
| `Enter` | 添加新事项 |

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

### 透明度调节

- 点击标题栏 ◐ 按钮展开透明度滑块
- 拖动滑块调节窗口透明度（30%~100%）
- 透明度设置在重启后保持

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
Daily-checklist/
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
├── build/               # 打包资源（图标）
├── test/                # 测试
├── .github/             # GitHub 配置
└── LICENSE              # MIT 许可证
```

## 使用截图
![alt text](image.png)
![alt text](image-1.png)

## 贡献

欢迎贡献代码！请阅读 [贡献指南](CONTRIBUTING.md) 了解详情。

## 许可证

[MIT License](LICENSE)
