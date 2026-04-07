# LastTurns

Keep only the most recent chat turns on long AI conversation pages, so heavy conversation DOM does not drag the page down.

**Repository:** https://github.com/yourname/lastturns

## Support the project

If LastTurns helps you, you can support future maintenance here:

- 微信赞赏 / WeChat
- 支付宝 / Alipay

<p align="left">
  <img src="assets/wechat-pay.png" alt="WeChat pay QR" width="220" />
  <img src="assets/alipay-pay.png" alt="Alipay pay QR" width="220" />
</p>

> Replace these placeholder QR images before publishing.

## What it does

LastTurns trims old chat DOM and keeps only the latest **N turns**.

A **turn** means:
- one user message
- one assistant reply

The extension first tries to detect chat blocks automatically. If detection is inaccurate, the user can click one full turn on the page once, and the site rule will be remembered.

## Core features

- Keep only the latest N turns
- Save rules per site
- Automatic detection first, manual fallback when needed
- Auto-trim when the page changes
- Works for many AI chat sites

## Install

1. Open the extensions page in Chrome or Edge
2. Turn on Developer mode
3. Click **Load unpacked**
4. Select this project folder

## Use

1. Open an AI chat page
2. Click the LastTurns icon
3. Set how many recent turns to keep
4. Click **Clean History**
5. If auto-detection is wrong, click **Pick Turn Manually** and select one full turn on the page

## Notes

- Different sites structure turns differently, so some sites may need one manual pick
- If a site already virtualizes or recycles DOM, the performance gain may be smaller
- Removed DOM comes back after refresh unless auto-trim runs again on the page
- Update the repository URL and payment QR images before publishing
