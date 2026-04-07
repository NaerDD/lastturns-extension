<div align="center">

# LastTurns

**Keep only the last few chat turns. Make long AI conversations fast again.**  
**只保留最近几轮对话，让超长 AI 聊天页面重新流畅起来。**

[中文](#中文说明) | [English](#english)

</div>

---

## 中文说明

### LastTurns 是什么？

LastTurns 是一个面向长对话场景的浏览器扩展。  
当你在各类大语言模型网页里连续聊天很多轮之后，页面中的 DOM 会越来越多，浏览器可能出现明显卡顿、滚动掉帧、输入延迟变高等问题。

LastTurns 的作用就是：

- 自动识别当前网页中的对话区域
- 只保留最近几轮对话
- 清理更早的旧对话 DOM
- 缓解长会话带来的页面性能问题

它不会删除你的账号聊天记录，也不会修改服务端数据。  
它只是在当前页面里对已经渲染出来的旧内容进行清理。

---

### 主要功能

- 只需设置“保留最近多少轮对话”
- 自动识别常见 AI 聊天网页的对话区域
- 识别失败时，支持手动点选一条完整对话进行校准
- 支持自动保持，页面更新后持续清理旧内容
- 按站点保存规则，不同网站可分别生效
- 轻量、直接、没有多余设置

---

### 一轮对话的定义

在 LastTurns 中：

**1 轮对话 = 1 次用户提问 + 1 次 AI 回复**

例如：
- 你问一次，AI 回一次，这算 1 轮
- 你连续问两次，AI 连续回两次，通常会按页面结构尽量配对识别

---

### 适用场景

如果你经常遇到这些情况，这个扩展会比较有用：

- 聊天轮数一多，网页明显变卡
- 滚动很不流畅
- 输入框延迟变高
- 页面占用内存越来越大
- 某些 AI 网站长对话后几乎无法继续使用

---

### 工作原理

LastTurns 会在当前网页中识别“对话轮次”对应的 DOM 结构。  
当检测到页面中的对话数量超过你设置的保留数量时，它会清理更早的旧对话节点，只保留最近几轮。

这是一种前端页面级优化，不涉及：

- 账号数据删除
- 历史记录永久移除
- 服务端接口修改
- 第三方数据上传

---

### 安装方式

#### 开发者模式安装

1. 下载本项目源码或发行包
2. 打开浏览器扩展管理页面
3. 开启“开发者模式”
4. 选择“加载已解压的扩展程序”
5. 选中项目目录

支持基于 Chromium 的浏览器，例如：

- Google Chrome
- Microsoft Edge
- Arc
- Brave

---

### 使用方法

1. 打开任意支持的大模型聊天网页
2. 点击浏览器工具栏中的 LastTurns 图标
3. 设置“保留最近多少轮对话”
4. 可选：勾选“自动保持”
5. 点击清理或保存并应用

如果自动识别不准确：

1. 点击“手动选择对话框”
2. 回到网页中，点击一条完整对话
3. 扩展会记录当前站点规则并重新应用

---

### 清除站点规则是什么意思？

“清除站点规则”会删除这个网站当前保存的识别规则。

它的作用是：

- 重置当前站点的识别结果
- 删除之前自动识别或手动点选保存的规则
- 让扩展下次重新识别当前网站

它**不会**：

- 删除你的聊天记录
- 删除账号历史
- 清空网站服务器上的数据

---

### 隐私说明

LastTurns 默认不上传你的聊天内容，不读取账号信息，也不将对话发送到外部服务器。

它只在本地浏览器中工作，用于识别和清理当前网页里的旧对话 DOM。

如果未来版本加入任何联网功能，本项目会在更新日志和隐私说明中明确写出。

---

### GitHub

你可以在这里查看项目源码、提交问题或建议：

**GitHub:** `https://github.com/yourname/lastturns`

请将上面的地址替换成你自己的仓库链接。

---

### 支持项目

如果 LastTurns 对你有帮助，欢迎支持这个项目。

#### Buy Me a Coffee

<div align="center">

**微信赞赏**

<img src="assets/wechat-pay.png" alt="WeChat Pay" width="220" />

**支付宝赞赏**

<img src="assets/alipay-pay.png" alt="Alipay" width="220" />

</div>

请将以下占位图片替换成你自己的收款码：

- `assets/wechat-pay.png`
- `assets/alipay-pay.png`

---

### 免责声明

LastTurns 通过识别网页结构进行页面级清理。  
由于不同网站的 DOM 结构和更新机制不同，某些页面可能需要手动校准，且网站改版后规则可能需要重新识别。

本项目不保证对所有聊天网站始终 100% 适配，但会持续改进兼容性。

---

## English

### What is LastTurns?

LastTurns is a lightweight browser extension designed for long AI chat sessions.

After many turns of conversation, large language model websites often accumulate a huge amount of DOM nodes, which can cause severe lag, slow scrolling, input delay, and heavy memory usage.

LastTurns helps by:

- detecting the conversation area automatically
- keeping only the most recent chat turns
- removing older rendered DOM nodes
- improving responsiveness on long chat pages

It does **not** delete your account history or modify server-side data.  
It only cleans up older rendered content in the current page.

---

### Features

- Simple setup: only choose how many recent turns to keep
- Automatic detection of chat structures on AI websites
- Manual fallback when auto-detection is inaccurate
- Auto-keep mode for continuous cleanup as the page updates
- Per-site saved rules
- Lightweight and easy to use

---

### What counts as one turn?

In LastTurns:

**1 turn = 1 user message + 1 AI reply**

For example:
- One question from you and one answer from the AI = one turn
- If a website uses a more complex message structure, LastTurns will try to group them as accurately as possible

---

### Use cases

LastTurns is useful when:

- long chat pages become very slow
- scrolling starts lagging
- typing feels delayed
- memory usage keeps growing
- some AI chat websites become hard to use after many turns

---

### How it works

LastTurns identifies DOM structures corresponding to conversation turns on the current page.

When the number of rendered chat turns exceeds your configured limit, it removes older rendered DOM nodes and keeps only the most recent turns.

This is a front-end optimization only. It does **not** involve:

- deleting account data
- permanently removing chat history
- modifying server APIs
- uploading your chat content to third parties

---

### Installation

#### Load in developer mode

1. Download the source code or release package
2. Open your browser's extensions page
3. Enable **Developer mode**
4. Click **Load unpacked**
5. Select the project folder

Supported browsers include Chromium-based browsers such as:

- Google Chrome
- Microsoft Edge
- Arc
- Brave

---

### How to use

1. Open a supported AI chat website
2. Click the LastTurns icon in the browser toolbar
3. Set how many recent turns to keep
4. Optionally enable auto-keep
5. Click clean or save and apply

If automatic detection is not accurate:

1. Click **Manually select conversation block**
2. Go back to the page and click one complete conversation block
3. LastTurns will save the site rule and re-apply cleanup

---

### What does “Clear site rule” mean?

“Clear site rule” removes the saved detection rule for the current website.

This is useful when:

- the site layout has changed
- a previous manual selection was incorrect
- you want LastTurns to re-detect the chat structure from scratch

It does **not**:

- delete your chat history
- remove account conversations
- erase anything from the website server

---

### Privacy

LastTurns does not upload your chat content by default, does not read your account information, and does not send conversation data to any external server.

It works locally in your browser and only processes rendered DOM elements on the current page.

If any future version adds network-based features, that will be clearly documented in the privacy policy and changelog.

---

### GitHub

You can view the source code, report issues, or suggest improvements here:

**GitHub:** `https://github.com/yourname/lastturns`

Replace the placeholder above with your actual repository URL.

---

### Support the project

If LastTurns helps you, you can support the project here.

#### Buy Me a Coffee

<div align="center">

**WeChat Pay**

<img src="assets/wechat-pay.png" alt="WeChat Pay" width="220" />

**Alipay**

<img src="assets/alipay-pay.png" alt="Alipay" width="220" />

</div>

Please replace these placeholder images with your own QR codes:

- `assets/wechat-pay.png`
- `assets/alipay-pay.png`

---

### Disclaimer

LastTurns performs page-level cleanup by detecting website structures.

Because chat websites use different DOM patterns and may update their layouts over time, some sites may require manual calibration, and saved rules may need to be reset after site updates.

This project does not guarantee perfect compatibility with every AI chat website at all times, but compatibility will continue to improve.