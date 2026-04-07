const listEl = document.getElementById("list");
const exportBtn = document.getElementById("exportBtn");
const importFile = document.getElementById("importFile");
const statusEl = document.getElementById("status");

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.style.color = isError ? "#dc2626" : "";
}

async function getRules() {
  const { rulesByHost = {} } = await chrome.storage.local.get(["rulesByHost"]);
  return rulesByHost;
}

async function saveRules(rulesByHost) {
  await chrome.storage.local.set({ rulesByHost });
}

function renderRuleCard(host, rule) {
  const card = document.createElement("section");
  card.className = "card";
  const modeText = rule.detectionMode === "manual" ? "手动点选" : "自动识别";
  card.innerHTML = `
    <h2>${host}</h2>
    <div class="meta">保留 ${rule.keepCount || 20} 轮 · ${modeText}</div>
    <details>
      <summary>查看技术细节</summary>
      <pre>${escapeHtml(JSON.stringify(rule, null, 2))}</pre>
    </details>
    <div class="row">
      <button data-host="${host}" data-action="delete" class="danger">删除规则</button>
    </div>
  `;
  return card;
}

function escapeHtml(str) {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function render() {
  const rules = await getRules();
  listEl.innerHTML = "";
  const entries = Object.entries(rules);
  if (!entries.length) {
    listEl.innerHTML = '<p class="muted">还没有保存任何站点规则。</p>';
    return;
  }
  for (const [host, rule] of entries.sort((a, b) => a[0].localeCompare(b[0]))) {
    listEl.appendChild(renderRuleCard(host, rule));
  }
}

listEl.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action='delete']");
  if (!button) {
    return;
  }
  const host = button.dataset.host;
  const rules = await getRules();
  delete rules[host];
  await saveRules(rules);
  setStatus(`已删除 ${host} 的规则`);
  await render();
});

exportBtn.addEventListener("click", async () => {
  const rules = await getRules();
  const blob = new Blob([JSON.stringify({ rulesByHost: rules }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "llm-dom-trimmer-rules.json";
  a.click();
  URL.revokeObjectURL(url);
  setStatus("已导出规则 JSON");
});

importFile.addEventListener("change", async () => {
  const file = importFile.files?.[0];
  if (!file) {
    return;
  }
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || typeof parsed.rulesByHost !== "object") {
      throw new Error("JSON 格式不正确，需要包含 rulesByHost 对象");
    }
    await saveRules(parsed.rulesByHost);
    setStatus("已导入规则 JSON");
    await render();
  } catch (error) {
    setStatus(error.message || String(error), true);
  } finally {
    importFile.value = "";
  }
});

render().catch((error) => setStatus(error.message || String(error), true));
