const STORAGE_KEY = "rulesByHost";
let currentRule = null;
let observer = null;
let isApplying = false;
let pickerCleanup = null;
let lastApplyTimer = null;
let bootstrapObserver = null;
let bootstrapStopTimer = null;

function getHost() {
  return location.host;
}

function debounceApply() {
  if (lastApplyTimer) {
    clearTimeout(lastApplyTimer);
  }
  lastApplyTimer = setTimeout(() => {
    if (currentRule?.autoTrim) {
      applyRule(currentRule);
    }
  }, 300);
}

function isElementVisible(el) {
  if (!(el instanceof Element)) return false;
  const style = getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return rect.width > 8 && rect.height > 8;
}

function getTextLength(el) {
  if (!(el instanceof Element)) return 0;
  const text = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
  return text.length;
}

function cssEscapeSafe(value) {
  if (window.CSS?.escape) {
    return CSS.escape(value);
  }
  return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

function cleanSelectorParts(parts) {
  return parts.filter(Boolean).join(" > ").trim();
}

function getStableClassNames(el) {
  return Array.from(el.classList || []).filter(
    (name) => !/^((css|jsx|sc|tw|chakra|mantine|emotion)-|[a-z0-9]{8,}|[A-Z][a-zA-Z0-9]+__[a-zA-Z0-9_-]+)/.test(name)
  );
}

function getSimpleSelector(el) {
  if (!(el instanceof Element)) return "";
  const tag = el.tagName.toLowerCase();
  if (el.id && !/^react-/.test(el.id) && document.querySelectorAll(`#${cssEscapeSafe(el.id)}`).length === 1) {
    return `#${cssEscapeSafe(el.id)}`;
  }

  const stableAttrs = [
    "data-testid",
    "data-test",
    "data-message-id",
    "data-turn-id",
    "data-message-author-role",
    "role",
    "aria-label",
  ];
  for (const attr of stableAttrs) {
    const value = el.getAttribute(attr);
    if (value) {
      return `${tag}[${attr}="${cssEscapeSafe(value)}"]`;
    }
  }

  const classes = getStableClassNames(el)
    .slice(0, 3)
    .map((name) => `.${cssEscapeSafe(name)}`)
    .join("");

  return `${tag}${classes}`;
}

function getUniqueSelector(el) {
  if (!(el instanceof Element)) return "";
  if (el.id && document.querySelectorAll(`#${cssEscapeSafe(el.id)}`).length === 1) {
    return `#${cssEscapeSafe(el.id)}`;
  }

  const parts = [];
  let node = el;
  let depth = 0;
  while (node && node.nodeType === Node.ELEMENT_NODE && node !== document.body && depth < 6) {
    let part = getSimpleSelector(node);
    if (!part) break;

    const siblings = node.parentElement
      ? Array.from(node.parentElement.children).filter((sibling) => sibling.tagName === node.tagName)
      : [];
    if (siblings.length > 1) {
      const index = siblings.indexOf(node) + 1;
      part += `:nth-of-type(${index})`;
    }

    parts.unshift(part);
    const selector = cleanSelectorParts(parts);
    try {
      if (document.querySelectorAll(selector).length === 1) {
        return selector;
      }
    } catch {
      // ignore invalid intermediate selector
    }

    node = node.parentElement;
    depth += 1;
  }

  return cleanSelectorParts(parts) || getSimpleSelector(el);
}

function getSimilarityKey(el) {
  if (!(el instanceof Element)) return "";
  const tag = el.tagName.toLowerCase();
  const attrs = ["data-testid", "data-message-author-role", "role"]
    .map((attr) => el.getAttribute(attr))
    .filter(Boolean)
    .join("|");
  const classes = getStableClassNames(el).slice(0, 2).join(".");
  return `${tag}|${attrs}|${classes}`;
}

function getSharedItemSelector(el, listEl) {
  if (!(el instanceof Element)) return "";
  if (!(listEl instanceof Element) || !listEl.contains(el)) {
    return getUniqueSelector(el);
  }

  const tag = el.tagName.toLowerCase();
  const stableAttrs = ["data-testid", "data-test", "data-message-id", "data-turn-id", "data-message-author-role", "role"];
  for (const attr of stableAttrs) {
    const value = el.getAttribute(attr);
    if (value) {
      return `${tag}[${attr}="${cssEscapeSafe(value)}"]`;
    }
  }

  const stableClasses = getStableClassNames(el);
  if (stableClasses.length) {
    return `${tag}.${cssEscapeSafe(stableClasses[0])}`;
  }

  if (el.parentElement === listEl) {
    return `:scope > ${tag}`;
  }
  return tag;
}

function stopBootstrapObserver() {
  if (bootstrapObserver) {
    bootstrapObserver.disconnect();
    bootstrapObserver = null;
  }
  if (bootstrapStopTimer) {
    clearTimeout(bootstrapStopTimer);
    bootstrapStopTimer = null;
  }
}

function ensureBootstrapObserver() {
  if (!currentRule?.enabled) return;
  if (bootstrapObserver) return;
  const root = document.documentElement || document.body;
  if (!(root instanceof Element)) return;
  bootstrapObserver = new MutationObserver(() => {
    const result = applyRule(currentRule);
    if (result?.ok && result?.detected) {
      stopBootstrapObserver();
    }
  });
  bootstrapObserver.observe(root, { childList: true, subtree: true });
  bootstrapStopTimer = setTimeout(() => stopBootstrapObserver(), 20000);
}

function getRuleForHost(rulesByHost) {
  return rulesByHost?.[getHost()] || null;
}


function inferMessageRole(el) {
  if (!(el instanceof Element)) return "unknown";
  const fields = [
    el.getAttribute("data-message-author-role"),
    el.getAttribute("data-testid"),
    el.getAttribute("data-test"),
    el.getAttribute("aria-label"),
    el.getAttribute("role"),
    el.id,
    el.className,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/(^|[^a-z])(user|human|question|asker|sender)([^a-z]|$)/.test(fields)) return "user";
  if (/(^|[^a-z])(assistant|ai|bot|answer|reply|model|doubao)([^a-z]|$)/.test(fields)) return "assistant";
  if (/(^|[^a-z])(tool|plugin|search|reasoning)([^a-z]|$)/.test(fields)) return "tool";

  const ownText = (el.innerText || el.textContent || "").trim().slice(0, 120).toLowerCase();
  if (/^(你|我|user|human)[:：]/.test(ownText)) return "user";
  if (/^(ai|assistant|豆包|chatgpt|claude|gemini)[:：]/.test(ownText)) return "assistant";
  return "unknown";
}

function elementLooksLikeRoundBlock(el) {
  if (!(el instanceof Element)) return false;
  const roleNodes = Array.from(el.querySelectorAll("[data-message-author-role],[data-testid],[data-test],[aria-label],[role]"));
  let userCount = 0;
  let assistantCount = 0;
  for (const node of roleNodes.slice(0, 80)) {
    const role = inferMessageRole(node);
    if (role === "user") userCount += 1;
    if (role === "assistant") assistantCount += 1;
  }
  return userCount > 0 && assistantCount > 0;
}

function buildRoundGroups(items) {
  if (!items.length) {
    return { mode: "single", groups: [] };
  }

  const roles = items.map((el) => inferMessageRole(el));
  const userCount = roles.filter((r) => r === "user").length;
  const assistantCount = roles.filter((r) => r === "assistant").length;
  const roundBlockCount = items.filter((el) => elementLooksLikeRoundBlock(el)).length;

  if (roundBlockCount >= Math.max(1, Math.floor(items.length / 2))) {
    return { mode: "round-block", groups: items.map((el) => [el]) };
  }

  if (userCount && assistantCount) {
    const groups = [];
    let current = [];
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      const role = roles[i];
      if (role === "user") {
        if (current.length) groups.push(current);
        current = [item];
        continue;
      }
      if (role === "assistant") {
        if (!current.length) {
          const prev = items[i - 1];
          const prevRole = roles[i - 1];
          if (prev && prevRole !== "assistant") {
            current = [prev];
          }
        }
        current.push(item);
        groups.push(current);
        current = [];
        continue;
      }
      if (current.length) {
        current.push(item);
      }
    }
    if (current.length) groups.push(current);
    if (groups.length) {
      return { mode: "role-grouped", groups };
    }
  }

  if (items.length >= 2) {
    const groups = [];
    const start = items.length % 2;
    if (start === 1) groups.push([items[0]]);
    for (let i = start; i < items.length; i += 2) {
      groups.push(items.slice(i, i + 2));
    }
    return { mode: items.length % 2 === 0 ? "paired" : "paired-tail", groups };
  }

  return { mode: "single", groups: items.map((el) => [el]) };
}

function getMatchedItems(rule) {
  if (!rule?.listSelector || !rule?.itemSelector) {
    return { listEl: null, items: [] };
  }

  let listEl;
  try {
    listEl = document.querySelector(rule.listSelector);
  } catch {
    throw new Error(`对话容器选择器无效：${rule.listSelector}`);
  }
  if (!listEl) {
    throw new Error(`未找到对话容器：${rule.listSelector}`);
  }

  let items;
  try {
    items = Array.from(listEl.querySelectorAll(rule.itemSelector));
  } catch {
    throw new Error(`对话项选择器无效：${rule.itemSelector}`);
  }

  items = items.filter((el) => el instanceof HTMLElement && isElementVisible(el) && !el.hasAttribute("data-llm-dom-trimmer-skip"));

  const unique = [];
  const seen = new Set();
  for (const item of items) {
    if (seen.has(item)) continue;
    seen.add(item);
    unique.push(item);
  }

  return { listEl, items: unique };
}

function removeItems(itemsToTrim) {
  for (const el of itemsToTrim) {
    if (!(el instanceof HTMLElement)) continue;
    el.remove();
  }
}

function applyRule(rule) {
  if (!rule?.enabled || !rule.listSelector || !rule.itemSelector) {
    return { ok: true, trimmedCount: 0, totalCount: 0, detected: false };
  }
  if (isApplying) {
    return { ok: true, trimmedCount: 0, totalCount: 0, detected: true };
  }

  isApplying = true;
  try {
    const { listEl, items } = getMatchedItems(rule);
    if (!listEl) {
      return { ok: false, error: "未找到对话容器" };
    }

    const keepCount = Math.max(1, Number.parseInt(rule.keepCount || 5, 10));
    const grouping = buildRoundGroups(items);
    const totalCount = grouping.groups.length;
    const trimmedCount = Math.max(0, totalCount - keepCount);
    if (trimmedCount > 0) {
      const itemsToTrim = grouping.groups.slice(0, trimmedCount).flat();
      removeItems(itemsToTrim);
    }

    stopBootstrapObserver();
    ensureObserver(listEl);
    return {
      ok: true,
      trimmedCount,
      totalCount,
      keepCount,
      detected: true,
      groupingMode: grouping.mode,
    };
  } catch (error) {
    if (rule?.enabled) {
      ensureBootstrapObserver();
    }
    return { ok: false, error: error.message || String(error) };
  } finally {
    isApplying = false;
  }
}

function disconnectObserver() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

function ensureObserver(listEl) {
  disconnectObserver();
  if (!currentRule?.enabled || !currentRule?.autoTrim || !(listEl instanceof Element)) {
    return;
  }
  observer = new MutationObserver(() => debounceApply());
  observer.observe(listEl, {
    childList: true,
    subtree: true,
  });
}

async function loadRuleFromStorage() {
  const data = await chrome.storage.local.get([STORAGE_KEY]);
  currentRule = getRuleForHost(data[STORAGE_KEY]);
  const result = applyRule(currentRule);
  if (currentRule?.enabled) {
    [600, 1800, 4000].forEach((delay) => {
      setTimeout(() => applyRule(currentRule), delay);
    });
  }
  return result;
}

async function savePickedSelection(payload) {
  const key = `picked:${getHost()}:turn`;
  await chrome.storage.local.set({
    [key]: {
      ...payload,
      time: Date.now(),
      url: location.href,
    },
  });
}

function destroyPicker() {
  if (pickerCleanup) {
    pickerCleanup();
    pickerCleanup = null;
  }
}

function getAncestors(el, maxDepth = 8) {
  const result = [];
  let node = el;
  let depth = 0;
  while (node && node.nodeType === Node.ELEMENT_NODE && node !== document.body && depth < maxDepth) {
    result.push(node);
    node = node.parentElement;
    depth += 1;
  }
  return result;
}

function scoreTurnCandidate(itemEl) {
  if (!(itemEl instanceof Element) || !isElementVisible(itemEl)) return -1;
  const parent = itemEl.parentElement;
  if (!(parent instanceof Element) || !isElementVisible(parent)) return -1;

  const rect = itemEl.getBoundingClientRect();
  const parentRect = parent.getBoundingClientRect();
  const textLen = getTextLength(itemEl);
  if (textLen < 12) return -1;
  if (rect.width < 120 || rect.height < 24) return -1;
  if (rect.height > window.innerHeight * 0.85 || rect.width > window.innerWidth * 0.98) return -1;
  if (parentRect.height < 150) return -1;

  const siblings = Array.from(parent.children).filter((child) => child instanceof Element && isElementVisible(child));
  if (siblings.length < 3) return -1;

  const key = getSimilarityKey(itemEl);
  const similarSiblings = siblings.filter((sibling) => {
    if (!(sibling instanceof Element)) return false;
    if (getSimilarityKey(sibling) === key) return true;
    return sibling.tagName === itemEl.tagName && getStableClassNames(sibling)[0] && getStableClassNames(sibling)[0] === getStableClassNames(itemEl)[0];
  });
  if (similarSiblings.length < 3) return -1;

  const avgText = similarSiblings.reduce((sum, el) => sum + Math.min(getTextLength(el), 600), 0) / similarSiblings.length;
  const scrollBonus = parent.scrollHeight > parent.clientHeight * 1.15 ? 1.25 : 1;
  const tagBonus = /article|section|li/i.test(itemEl.tagName) ? 1.2 : 1;
  const ownRole = inferMessageRole(itemEl);
  const containsRoundBonus = elementLooksLikeRoundBlock(itemEl) ? 120 : 0;
  const directMessagePenalty = ownRole === "user" || ownRole === "assistant" ? 60 : 0;

  return similarSiblings.length * 40 + avgText * 0.35 + Math.min(rect.height, 500) * 0.25 + scrollBonus * 20 + tagBonus * 10 + containsRoundBonus - directMessagePenalty;
}

function inferTurnRuleFromElement(rawEl) {
  if (!(rawEl instanceof Element)) {
    return null;
  }

  const candidates = [];
  const ancestors = getAncestors(rawEl, 8);
  for (const anc of ancestors) {
    const score = scoreTurnCandidate(anc);
    if (score <= 0) continue;
    const listEl = anc.parentElement;
    if (!(listEl instanceof Element)) continue;
    const itemSelector = getSharedItemSelector(anc, listEl);
    const listSelector = getUniqueSelector(listEl);
    candidates.push({
      score,
      rule: {
        enabled: true,
        autoTrim: true,
        listSelector,
        itemSelector,
        detectionMode: "manual",
      },
      pickedSelector: getUniqueSelector(anc),
      preview: getSimpleSelector(anc),
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0] || null;
}

function startPicker() {
  destroyPicker();

  const box = document.createElement("div");
  box.setAttribute("data-llm-dom-trimmer-picker", "1");
  Object.assign(box.style, {
    position: "fixed",
    zIndex: "2147483647",
    border: "2px solid #2563eb",
    background: "rgba(37, 99, 235, 0.12)",
    pointerEvents: "none",
    left: "0",
    top: "0",
    width: "0",
    height: "0",
  });

  const tip = document.createElement("div");
  tip.setAttribute("data-llm-dom-trimmer-picker-tip", "1");
  Object.assign(tip.style, {
    position: "fixed",
    zIndex: "2147483647",
    right: "16px",
    top: "16px",
    background: "#111827",
    color: "#fff",
    padding: "10px 12px",
    borderRadius: "10px",
    boxShadow: "0 6px 20px rgba(0,0,0,0.2)",
    font: "13px/1.4 system-ui, sans-serif",
    maxWidth: "360px",
  });
  tip.textContent = "请选择一整条对话框（最好是包含用户提问和 AI 回复的那一整块），Esc 取消";

  document.documentElement.appendChild(box);
  document.documentElement.appendChild(tip);

  let hoveredCandidate = null;

  const updateBox = (candidate) => {
    const el = candidate?.element;
    if (!(el instanceof Element)) return;
    const rect = el.getBoundingClientRect();
    Object.assign(box.style, {
      left: `${Math.max(0, rect.left)}px`,
      top: `${Math.max(0, rect.top)}px`,
      width: `${Math.max(0, rect.width)}px`,
      height: `${Math.max(0, rect.height)}px`,
    });
  };

  const onMove = (event) => {
    box.style.pointerEvents = "none";
    tip.style.pointerEvents = "none";
    const el = document.elementFromPoint(event.clientX, event.clientY);
    if (!el || el === box || el === tip) return;
    const inferred = inferTurnRuleFromElement(el);
    if (!inferred) return;
    hoveredCandidate = { ...inferred, element: document.querySelector(inferred.pickedSelector) || el };
    updateBox(hoveredCandidate);
    tip.textContent = `将按这类对话块识别：${hoveredCandidate.preview}`;
  };

  const onClick = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const inferred = hoveredCandidate || inferTurnRuleFromElement(event.target);
    if (!inferred) {
      tip.textContent = "没识别出可重复的对话块，请点一个更外层的完整对话区域";
      return;
    }

    await savePickedSelection({
      target: "turn",
      ...inferred.rule,
      pickedSelector: inferred.pickedSelector,
      preview: inferred.preview,
    });
    destroyPicker();
  };

  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      destroyPicker();
    }
  };

  window.addEventListener("mousemove", onMove, true);
  window.addEventListener("click", onClick, true);
  window.addEventListener("keydown", onKeyDown, true);

  pickerCleanup = () => {
    window.removeEventListener("mousemove", onMove, true);
    window.removeEventListener("click", onClick, true);
    window.removeEventListener("keydown", onKeyDown, true);
    box.remove();
    tip.remove();
  };

  return { ok: true };
}

function getLikelySeedElements() {
  const selector = [
    "[data-testid*='conversation']",
    "[data-testid*='turn']",
    "[data-message-id]",
    "[data-turn-id]",
    "[data-message-author-role]",
    "article",
    "[role='article']",
    "[class*='conversation']",
    "[class*='message']",
    "[class*='turn']",
    "main section",
    "main article",
    "main div",
  ].join(",");

  const picked = Array.from(document.querySelectorAll(selector))
    .filter((el) => el instanceof HTMLElement && isElementVisible(el) && getTextLength(el) >= 12)
    .slice(0, 500);

  if (picked.length >= 20) {
    return picked;
  }

  const fallback = Array.from(document.querySelectorAll("main *"))
    .filter((el) => el instanceof HTMLElement && isElementVisible(el) && getTextLength(el) >= 20)
    .slice(0, 400);

  return [...new Set([...picked, ...fallback])];
}

function guessTurnRule() {
  const seeds = getLikelySeedElements();
  const candidates = [];

  for (const seed of seeds) {
    const inferred = inferTurnRuleFromElement(seed);
    if (inferred) {
      candidates.push(inferred);
    }
  }

  if (!candidates.length) {
    return { ok: false, error: "暂时无法自动识别对话框，请手动点选一条对话" };
  }

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  return {
    ok: true,
    rule: {
      ...best.rule,
      detectionMode: "auto",
    },
    preview: best.preview,
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message?.type === "ping") {
        sendResponse({ ok: true });
        return;
      }

      if (message?.type === "setRule") {
        currentRule = message.rule;
        const result = applyRule(currentRule);
        sendResponse(result);
        return;
      }

      if (message?.type === "clearRule") {
        currentRule = null;
        disconnectObserver();
        destroyPicker();
        sendResponse({ ok: true });
        return;
      }

      if (message?.type === "applyRuleNow") {
        const result = applyRule(message.rule || currentRule);
        sendResponse(result);
        return;
      }

      if (message?.type === "startPicker") {
        const result = startPicker();
        sendResponse(result);
        return;
      }

      if (message?.type === "guessTurnRule") {
        const result = guessTurnRule();
        sendResponse(result);
        return;
      }

      sendResponse({ ok: false, error: "未知消息类型" });
    } catch (error) {
      sendResponse({ ok: false, error: error.message || String(error) });
    }
  })();
  return true;
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes[STORAGE_KEY]) {
    return;
  }
  const nextRules = changes[STORAGE_KEY].newValue || {};
  currentRule = getRuleForHost(nextRules);
  applyRule(currentRule);
});

loadRuleFromStorage().catch(() => {
  // ignore initialization errors on unsupported pages
});

window.addEventListener("pageshow", () => { if (currentRule?.enabled) applyRule(currentRule); });
window.addEventListener("load", () => { if (currentRule?.enabled) applyRule(currentRule); });
