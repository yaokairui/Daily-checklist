# 贡献指南

感谢你对「日常清单」项目的关注！欢迎通过以下方式参与贡献。

## 如何贡献

### 报告问题

1. 在 [Issues](../../issues) 页面搜索是否已有相关问题
2. 如果没有，点击「New Issue」创建新问题
3. 使用提供的 Issue 模板填写详细信息

### 提交代码

1. **Fork** 本仓库
2. 创建功能分支：`git checkout -b feature/your-feature`
3. 提交更改：`git commit -m 'Add some feature'`
4. 推送分支：`git push origin feature/your-feature`
5. 创建 **Pull Request**

### 开发流程

```bash
# 克隆你的 Fork
git clone https://github.com/your-username/daily-checklist.git
cd daily-checklist

# 安装依赖
npm install

# 生成图标
node generate-icons.js

# 启动开发
npm start

# 运行测试
npm test
```

### 代码规范

- JavaScript 使用 ES6+ 语法
- CSS 使用 CSS 变量管理主题色彩
- 文件命名使用 kebab-case
- 提交信息使用简洁明了的描述

### 提交信息格式

```
<type>: <description>

类型:
  feat:     新功能
  fix:      修复 Bug
  docs:     文档更新
  style:    代码格式（不影响功能）
  refactor: 重构
  test:     测试
  chore:    构建/工具变更
```

### PR 检查清单

- [ ] 代码通过测试
- [ ] 新功能有对应测试
- [ ] 遵循项目代码风格
- [ ] 提交信息格式正确
- [ ] 如有必要，更新了文档

## 行为准则

- 尊重所有贡献者
- 建设性的讨论和反馈
- 专注于对项目最有利的事情
