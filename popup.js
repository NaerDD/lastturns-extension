const STORAGE_KEY = "rulesByHost";

const keepCountInput = document.getElementById("keepCount");
const autoTrimInput = document.getElementById("autoTrim");
const statusEl = document.getElementById("status");
const btnApply = document.getElementById("btnApply");
const btnGuess = document.getElementById("btnGuess");
const btnPick = document.getElementById("btnPick");
const btnClear = document.getElementById("btnClear");
const platformInfoEl = document.getElementById("platformInfo");

let currentTab = null;
let currentHost = "";
let currentPlatform = null;
let currentRule = null;

function setStatus(text, type = "info") {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.dataset.type = type;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

function getHostFromUrl(url) {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

function isSupportedPage(url) {
  if (!url) return false;
  return /^https?:\/\//i.test(url);
}

async function pingContentScript(tabId) {
  try {
    const resp = await chrome.tabs.sendMessage(tabId, { type: "ping" });
    return !!resp?.ok;
  } catch {
    return false;
  }
}

async function ensureContentScript(tabId) {
  const ok = await pingContentScript(tabId);
  if (ok) return true;

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"],
    });
  } catch (error) {
    console.error("inject content.js failed:", error);
    return false;
  }

  return await pingContentScript(tabId);
}

async function getRulesByHost() {
  const data = await chrome.storage.local.get([STORAGE_KEY]);
  return data[STORAGE_KEY] || {};
}

async function saveRulesByHost(rulesByHost) {
  await chrome.storage.local.set({ [STORAGE_KEY]: rulesByHost });
}

async function loadSavedRule() {
  const rulesByHost = await getRulesByHost();
  currentRule = rulesByHost[currentHost] || null;

  if (keepCountInput) {
    keepCountInput.value = String(currentRule?.keepCount || 5);
  }
  if (autoTrimInput) {
    autoTrimInput.checked = currentRule?.autoTrim ?? true;
  }
}

async function loadPlatformInfo() {
  if (!currentTab?.id) return;

  try {
    const ok = await ensureContentScript(currentTab.id);
    if (!ok) {
      setStatus("当前页面无法连接扩展脚本", "error");
      return;
    }

    const resp = await chrome.tabs.sendMessage(currentTab.id, { type: "getPlatformInfo" });
    if (resp?.ok) {
      currentPlatform = resp;
      if (platformInfoEl) {
        const presetText = resp.presetCount > 0 ? ` · 预设 ${resp.presetCount} 条` : "";
        platformInfoEl.textContent = `站点：${resp.platformLabel}${presetText}`;
      }
    }
  } catch (error) {
    console.error(error);
  }
}

function buildRule(baseRule = {}) {
  const keepCount = Math.max(1, parseInt(keepCountInput?.value || "5", 10));
  const autoTrim = !!autoTrimInput?.checked;

  return {
    ...baseRule,
    enabled: true,
    autoTrim,
    keepCount,
  };
}

async function saveRule(rule) {
  const rulesByHost = await getRulesByHost();
  rulesByHost[currentHost] = rule;
  await saveRulesByHost(rulesByHost);
  currentRule = rule;
}

async function clearRule() {
  const rulesByHost = await getRulesByHost();
  delete rulesByHost[currentHost];
  await saveRulesByHost(rulesByHost);
  currentRule = null;
}

async function applyRule(rule) {
  const ok = await ensureContentScript(currentTab.id);
  if (!ok) {
    setStatus("页面脚本未成功加载，请刷新网页后重试", "error");
    return null;
  }

  return chrome.tabs.sendMessage(currentTab.id, {
    type: "applyRuleNow",
    rule,
  });
}

async function guessRule() {
  const ok = await ensureContentScript(currentTab.id);
  if (!ok) {
    setStatus("页面脚本未成功加载，请刷新网页后重试", "error");
    return null;
  }

  return chrome.tabs.sendMessage(currentTab.id, {
    type: "guessTurnRule",
  });
}

async function handleGuessAndApply() {
  if (!currentTab?.id) return;

  setStatus("正在识别对话区域…", "info");

  const guessed = await guessRule();
  if (!guessed?.ok || !guessed.rule) {
    setStatus(guessed?.error || "自动识别失败，请手动选择对话框", "error");
    return;
  }

  const finalRule = buildRule(guessed.rule);
  const result = await applyRule(finalRule);

  if (!result?.ok) {
    setStatus(result?.error || "应用规则失败", "error");
    return;
  }

  await saveRule(finalRule);

  const trimmed = result.trimmedCount || 0;
  const total = result.totalCount || 0;
  const preview = guessed.preview ? ` · ${guessed.preview}` : "";

  setStatus(
      `规则已保存，已保留最后 ${finalRule.keepCount} 轮，当前共识别 ${total} 轮，清理了 ${trimmed} 轮旧对话${preview}`,
      "success"
  );
}

async function handleApplySavedRule() {
  if (!currentRule) {
    await handleGuessAndApply();
    return;
  }

  const finalRule = buildRule(currentRule);
  const result = await applyRule(finalRule);

  if (!result?.ok) {
    setStatus(result?.error || "应用规则失败", "error");
    return;
  }

  await saveRule(finalRule);

  const trimmed = result.trimmedCount || 0;
  const total = result.totalCount || 0;

  setStatus(
      `规则已保存，已保留最后 ${finalRule.keepCount} 轮，当前共识别 ${total} 轮，清理了 ${trimmed} 轮旧对话`,
      "success"
  );
}

async function handleStartPicker() {
  if (!currentTab?.id) return;

  const ok = await ensureContentScript(currentTab.id);
  if (!ok) {
    setStatus("页面脚本未成功加载，请刷新网页后重试", "error");
    return;
  }

  const resp = await chrome.tabs.sendMessage(currentTab.id, { type: "startPicker" });
  if (resp?.ok) {
    setStatus("请回到网页，点击一整条对话框", "info");
  } else {
    setStatus(resp?.error || "无法启动手动选择", "error");
  }
}

async function init() {
  currentTab = await getActiveTab();

  if (!currentTab || !isSupportedPage(currentTab.url)) {
    setStatus("请在一个正常的聊天网页中使用此扩展", "error");
    if (btnApply) btnApply.disabled = true;
    if (btnGuess) btnGuess.disabled = true;
    if (btnPick) btnPick.disabled = true;
    if (btnClear) btnClear.disabled = true;
    return;
  }

  currentHost = getHostFromUrl(currentTab.url);

  await loadSavedRule();
  await loadPlatformInfo();

  if (currentRule) {
    setStatus(`已加载当前站点规则，保留最近 ${currentRule.keepCount || 5} 轮`, "info");
  } else {
    setStatus("可先自动识别，也可手动选择对话框", "info");
  }
}

btnGuess?.addEventListener("click", async () => {
  await handleGuessAndApply();
});

btnApply?.addEventListener("click", async () => {
  await handleApplySavedRule();
});

btnPick?.addEventListener("click", async () => {
  await handleStartPicker();
});

btnClear?.addEventListener("click", async () => {
  await clearRule();

  const pickedKey = `picked:${currentHost}:turn`;
  await chrome.storage.local.remove([pickedKey]);

  if (currentTab?.id) {
    try {
      await ensureContentScript(currentTab.id);
      await chrome.tabs.sendMessage(currentTab.id, { type: "clearRule" });
    } catch (error) {
      console.error(error);
    }
  }

  currentRule = null;
  setStatus("当前站点规则已清除", "success");
});

keepCountInput?.addEventListener("change", async () => {
  if (!currentRule) return;
  currentRule = buildRule(currentRule);
});

autoTrimInput?.addEventListener("change", async () => {
  if (!currentRule) return;
  currentRule = buildRule(currentRule);
});

init().catch((error) => {
  console.error(error);
  setStatus("初始化失败", "error");
});