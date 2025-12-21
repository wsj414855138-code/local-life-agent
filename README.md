# 本地生活Agent - 美团核心本地商业CEO

与美团核心本地商业CEO对话，获取专业的战略建议和业务洞察。

## 🌐 在线体验

**访问地址：** https://wsj414855138-code.github.io/local-life-agent/

## ✨ 功能特性

- **智能问答** - 基于Gemini API的AI对话，提供专业CEO视角建议
- **结构化输出** - 金字塔原理思维框架，多种报告模板（PR/FAQ、WHY-WHAT-HOW、研报型等）
- **AI配图** - 自动生成报告配图（Gemini 3 Pro Image）
- **历史记录** - 保存对话历史，随时回顾
- **追问评论** - 选中报告文本添加追问，获取深度解答
- **日/夜间模式** - 支持主题切换
- **响应式设计** - 自适应手机/平板/桌面

## 🛠️ 技术栈

- **前端**: HTML + CSS + JavaScript
- **AI**: Google Gemini API (REST)
- **Markdown**: marked.js
- **代码高亮**: highlight.js
- **存储**: localStorage

## 📁 项目结构

```
local-life-agent/
├── index.html    # 主页面
├── styles.css    # 样式文件（含响应式）
├── app.js        # 核心逻辑
└── README.md     # 项目说明
```

## 🚀 本地运行

1. 直接用浏览器打开 `index.html`
2. 点击右上角设置⚙️，输入你的 Gemini API Key
3. 开始对话！

## 📝 API Key 获取

1. 访问 [Google AI Studio](https://aistudio.google.com/)
2. 登录Google账号
3. 创建API Key

## 🔄 更新部署

修改代码后，将文件上传到GitHub仓库，GitHub Pages会自动更新。

## 📅 开发记录

### 2025-12-21 智能优化版本
- **升级Gemini 3模型** - 使用最新gemini-3-pro-preview和gemini-3-flash-preview
- **Pro优先策略** - 默认使用Pro模型，只有极简单问题(复杂度≤3)才用Flash
- **泛化用户身份** - 支持所有本地生活业务，不再限定到店餐饮
- **移动端划线评论** - 修复手机端无法选择文字评论的问题
- **CEO融合式输出** - 不再机械标注"XX视角"，自然融合多角色视角
- **Prompt优化：汇报级思考助手** - 新增WHY思考框架、Benchmark对标分析
- **问题类型智能判断** - 探索型/执行型/决策型/诊断型，灵活匹配输出
- **一句话汇报版** - 每个报告都有30秒电梯演讲版本
- **报告反馈机制** - 👍👎按钮收集反馈，存储本地
- **代码清理** - 删除无用的Anthropic SDK引用
- **PDF导出修复** - 修复图片显示bug，自动隐藏加载失败的图片

### 2025-12 初始版本
- 实现基础对话功能
- 添加历史记录和追问评论
- UI升级：日夜间模式、响应式设计
- AI配图功能（Imagen 4）
- 部署到GitHub Pages

---

Made with ❤️ using AI Coding
