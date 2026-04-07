const DEFAULT_RULE = {
  enabled: true,
  keepCount: 5,
  autoTrim: true,
  listSelector: "",
  itemSelector: "",
  detectionMode: "auto",
};

let currentHost = "";
let currentTabId = null;
let currentTabUrl = "";
let currentRule = { ...DEFAULT_RULE };

const els = {
  countBadge: document.getElementById("countBadge"),
  autoTrim: document.getElementById("autoTrim"),
  siteInfo: document.getElementById("siteInfo"),
  keepCount: document.getElementById("keepCount"),
  detectedInfo: document.getElementById("detectedInfo"),
  status: document.getElementById("status"),
  saveApply: document.getElementById("saveApply"),
  trimNow: document.getElementById("trimNow"),
  autoDetect: document.getElementById("autoDetect"),
  pickTurn: document.getElementById("pickTurn"),
  clearRule: document.getElementById("clearRule"),
};

function setStatus(text, isError = false) {
  els.status.textContent = text;
  els.status.style.color = isError ? "#dc2626" : "";
}

function syncCountBadge() {
  const count = getKeepCount();
  if (els.countBadge) {
    els.countBadge.textContent = `${count} 轮`;
  }
}

function getKeepCount() {
  return Math.max(1, Number.parseInt(els.keepCount.value || "20", 10));
}

function updateDetectedInfo(rule) {
  if (!rule?.listSelector || !rule?.itemSelector) {
    els.detectedInfo.textContent = "未配置。点击“保存并应用”时会先自动识别。";
    return;
  }
  const modeText = rule.detectionMode === "manual" ? "手动点选" : "自动识别";
  els.detectedInfo.textContent = `已识别当前站点对话块（${modeText}）。以后只需要改保留轮数即可。`;
}

function normalizeRule(rule, { fromUI = true } = {}) {
  const merged = {
    ...DEFAULT_RULE,
    ...(rule || {}),
    enabled: true,
  };

  if (fromUI) {
    merged.keepCount = getKeepCount();
    merged.autoTrim = !!els.autoTrim?.checked;
  } else {
    merged.keepCount = Math.max(1, Number.parseInt(String(merged.keepCount || DEFAULT_RULE.keepCount), 10));
    merged.autoTrim = !!merged.autoTrim;
  }

  return merged;
}

async function getStorage(keys) {
  return chrome.storage.local.get(keys);
}

async function setStorage(obj) {
  return chrome.storage.local.set(obj);
}

async function getCurrentTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

function isRestrictedUrl(url) {
  if (!url) return true;
  return /^(chrome|edge|about|brave|vivaldi|opera|moz-extension|chrome-extension):/i.test(url);
}

async function ensureContentScriptReady() {
  if (currentTabId == null) {
    throw new Error("当前标签页不可用");
  }
  if (isRestrictedUrl(currentTabUrl)) {
    throw new Error("当前页面不允许扩展注入。请切到具体的大模型网页后再使用。\n例如不要在 chrome://、扩展页、应用商店页里操作。");
  }

  try {
    const pong = await chrome.tabs.sendMessage(currentTabId, { type: "ping" });
    if (pong?.ok) return;
  } catch (error) {
    const msg = String(error?.message || error || "");
    const canRetry = /Receiving end does not exist|Could not establish connection|The message port closed/i.test(msg);
    if (!canRetry) {
      throw error;
    }
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: currentTabId },
      files: ["content.js"],
    });
  } catch (error) {
    throw new Error("当前页面无法注入扩展脚本。请刷新目标网页后重试，或切到普通网页标签页。\n若你在 ChatGPT/Claude/Gemini 页面里仍报错，点一下扩展管理页的“重新加载”再试。");
  }

  try {
    const pong = await chrome.tabs.sendMessage(currentTabId, { type: "ping" });
    if (!pong?.ok) {
      throw new Error("页面脚本未成功启动");
    }
  } catch {
    throw new Error("扩展脚本没有成功连接到当前页面。请先刷新该网页，再重新打开扩展。")
  }
}

async function sendToContent(message) {
  await ensureContentScriptReady();
  return chrome.tabs.sendMessage(currentTabId, message);
}

async function loadCurrentRule() {
  const tab = await getCurrentTab();
  currentTabId = tab?.id ?? null;
  currentTabUrl = tab?.url || "";

  if (!currentTabUrl || isRestrictedUrl(currentTabUrl)) {
    currentHost = "";
    els.siteInfo.textContent = currentTabUrl || "当前标签页";
    currentRule = { ...DEFAULT_RULE };
    els.keepCount.value = String(currentRule.keepCount || 5);
    if (els.autoTrim) els.autoTrim.checked = currentRule.autoTrim !== false;
    syncCountBadge();
    updateDetectedInfo(null);
    setStatus("请切到具体的大模型对话网页后再使用。", true);
    return;
  }

  const url = new URL(currentTabUrl);
  currentHost = url.host;
  els.siteInfo.textContent = `${url.host}${url.pathname.length > 1 ? ` · ${url.pathname}` : ""}`;

  const data = await getStorage(["rulesByHost"]);
  const rulesByHost = data.rulesByHost || {};
  currentRule = normalizeRule(rulesByHost[currentHost] || DEFAULT_RULE, { fromUI: false });
  els.keepCount.value = String(currentRule.keepCount || 5);
  if (els.autoTrim) els.autoTrim.checked = currentRule.autoTrim !== false;
  syncCountBadge();
  updateDetectedInfo(currentRule);
}

async function saveRule(rule) {
  const normalized = normalizeRule(rule);
  const data = await getStorage(["rulesByHost"]);
  const rulesByHost = data.rulesByHost || {};
  rulesByHost[currentHost] = normalized;
  await setStorage({ rulesByHost });
  currentRule = normalized;
  updateDetectedInfo(currentRule);
  return normalized;
}

async function clearCurrentRule() {
  const data = await getStorage(["rulesByHost"]);
  const rulesByHost = data.rulesByHost || {};
  delete rulesByHost[currentHost];
  await setStorage({ rulesByHost });
  currentRule = normalizeRule({ ...DEFAULT_RULE, keepCount: getKeepCount(), autoTrim: !!els.autoTrim?.checked }, { fromUI: false });
  updateDetectedInfo(null);
}

async function detectRule(auto = true) {
  if (!auto) {
    throw new Error("不支持的识别方式");
  }
  const result = await sendToContent({ type: "guessTurnRule" });
  if (!result?.ok || !result.rule) {
    throw new Error(result?.error || "自动识别失败");
  }
  const nextRule = normalizeRule({ ...currentRule, ...result.rule, detectionMode: "auto" });
  setStatus(`已自动识别对话块：${result.preview || "成功"}`);
  return nextRule;
}

function listenPickedRule() {
  chrome.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName !== "local") return;
    const key = `picked:${currentHost}:turn`;
    const change = changes[key];
    if (!change?.newValue) return;

    const picked = change.newValue;
    const nextRule = normalizeRule({
      ...currentRule,
      listSelector: picked.listSelector,
      itemSelector: picked.itemSelector,
      detectionMode: "manual",
    });
    await saveRule(nextRule);
    const result = await sendToContent({ type: "setRule", rule: nextRule });
    if (!result?.ok) {
      setStatus(result?.error || "手动应用失败", true);
      return;
    }
    setStatus(`已按你点选的对话框保存，当前共有 ${result.totalCount} 轮对话。`);
  });
}

els.autoDetect.addEventListener("click", async () => {
  try {
    const rule = await detectRule(true);
    const result = await sendToContent({ type: "setRule", rule });
    if (!result?.ok) {
      throw new Error(result?.error || "应用失败");
    }
    await saveRule(rule);
    setStatus(`重新识别完成，已清理 ${result.trimmedCount} 轮旧对话。`);
  } catch (error) {
    setStatus(error.message || String(error), true);
  }
});

els.pickTurn.addEventListener("click", async () => {
  try {
    setStatus("请回到网页，点击一整条对话框…");
    await sendToContent({ type: "startPicker" });
  } catch (error) {
    setStatus(error.message || String(error), true);
  }
});

els.trimNow.addEventListener("click", async () => {
  try {
    let rule = normalizeRule(currentRule);
    if (!rule.listSelector || !rule.itemSelector) {
      rule = await detectRule(true);
    }
    const result = await sendToContent({ type: "applyRuleNow", rule });
    if (!result?.ok) {
      throw new Error(result?.error || "清理失败");
    }
    await saveRule(rule);
    setStatus(`已清理 ${result.trimmedCount} 轮旧对话，当前识别到 ${result.totalCount} 轮。`);
  } catch (error) {
    setStatus(error.message || String(error), true);
  }
});

els.saveApply.addEventListener("click", async () => {
  try {
    let rule = normalizeRule(currentRule);
    if (!rule.listSelector || !rule.itemSelector) {
      rule = await detectRule(true);
    }
    const result = await sendToContent({ type: "setRule", rule });
    if (!result?.ok) {
      throw new Error(result?.error || "应用失败");
    }
    await saveRule(rule);
    setStatus(`规则已保存，已保留最后 ${rule.keepCount} 轮，当前清理了 ${result.trimmedCount} 轮旧对话。`);
  } catch (error) {
    setStatus(error.message || String(error), true);
  }
});

els.clearRule.addEventListener("click", async () => {
  try {
    await clearCurrentRule();
    await sendToContent({ type: "clearRule" });
    setStatus("当前站点规则已清除。刷新页面后可恢复原始内容。", false);
  } catch (error) {
    setStatus(error.message || String(error), true);
  }
});

(async function init() {
  try {
    await loadCurrentRule();
    listenPickedRule();
    els.keepCount.addEventListener("input", syncCountBadge);
    els.autoTrim?.addEventListener("change", () => { currentRule.autoTrim = !!els.autoTrim.checked; });
    if (!isRestrictedUrl(currentTabUrl)) {
      await ensureContentScriptReady().catch(() => {});
      setStatus("准备就绪");
    }
  } catch (error) {
    setStatus(error.message || String(error), true);
  }
})();
