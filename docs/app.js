(() => {
  "use strict";

  const LOCAL_KEY = "qqqi-growth-records-v1";
  const MIGRATION_KEY = "qqqi-cloud-migration-v1";
  const config = window.QQQI_SUPABASE_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const state = { client: null, session: null, records: [], loading: false };

  function make(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function setAuthMessage(message, tone = "info") {
    const target = $("authMessage");
    target.textContent = message;
    target.dataset.tone = tone;
    target.hidden = !message;
  }

  function showToast(message, tone = "success") {
    const toast = $("toast");
    toast.textContent = `${tone === "success" ? "✓" : "!"} ${message}`;
    toast.dataset.tone = tone;
    toast.hidden = false;
    clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => { toast.hidden = true; }, 3600);
  }

  function setLoading(loading, label = "正在同步") {
    state.loading = loading;
    const sync = $("syncState");
    sync.textContent = loading ? label : "已同步";
    sync.dataset.loading = String(loading);
    document.querySelectorAll("[data-cloud-action]").forEach((element) => {
      element.disabled = loading;
    });
  }

  function formatDate(value) {
    if (!value) return "";
    return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" })
      .format(new Date(`${value}T00:00:00`));
  }

  function render() {
    const completed = state.records.filter((record) => record.status === "已完成").length;
    const progress = state.records.length
      ? Math.round((completed / state.records.length) * 100)
      : 0;

    $("total").textContent = String(state.records.length);
    $("completed").textContent = String(completed);
    $("progress").textContent = `${progress}%`;
    $("orbit").style.setProperty("--progress", `${progress * 3.6}deg`);
    $("count").textContent = `${state.records.length} 条`;

    const timeline = $("timeline");
    timeline.replaceChildren();
    if (!state.records.length) {
      const empty = make("div", "empty");
      empty.append(
        make("strong", "", "第一份双周总结，从今天开始"),
        make("p", "", "记录真实进展，不必等待一切完美。"),
      );
      timeline.append(empty);
      return;
    }

    [...state.records].reverse().forEach((item) => {
      const row = make("div", "record");
      const node = make("span", `node ${item.status === "已完成" ? "done" : "active"}`);
      const content = make("div", "record-content");
      const top = make("div", "record-top");
      const dateText = item.period_start && item.period_end
        ? `${formatDate(item.period_start)} — ${formatDate(item.period_end)}`
        : new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" })
          .format(new Date(item.created_at));
      top.append(make("small", "", dateText));

      const status = make(
        "button",
        `status ${item.status === "已完成" ? "done" : "active"}`,
        item.status,
      );
      status.type = "button";
      status.dataset.cloudAction = "toggle";
      status.dataset.id = item.id;
      status.setAttribute("aria-label", `将“${item.period}”切换完成状态`);
      top.append(status);

      content.append(top, make("h3", "", item.period), make("p", "", item.work));
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = "查看复盘";
      details.append(summary, make("p", "", item.review));
      content.append(details);

      if (item.feedback) {
        const feedback = make("div", "feedback");
        feedback.append(make("strong", "", "本期反馈"), make("p", "", item.feedback));
        content.append(feedback);
      }

      const actions = make("div", "actions");
      if (item.link) {
        const link = make("a", "", "查看成果 ↗");
        link.href = item.link;
        link.target = "_blank";
        link.rel = "noreferrer";
        actions.append(link);
      }
      const remove = make("button", "", "删除");
      remove.type = "button";
      remove.dataset.cloudAction = "delete";
      remove.dataset.id = item.id;
      remove.setAttribute("aria-label", `删除“${item.period}”`);
      actions.append(remove);
      content.append(actions);
      row.append(node, content);
      timeline.append(row);
    });
  }

  async function loadRecords() {
    setLoading(true, "正在读取云端记录");
    const { data, error } = await state.client
      .from("progress_entries")
      .select("id,user_id,period,period_start,period_end,work,link,review,status,feedback,created_at,updated_at")
      .order("period_start", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) {
      setLoading(false);
      showToast("云端记录读取失败，请稍后重试", "error");
      throw error;
    }
    state.records = data || [];
    render();
    setLoading(false);
  }

  async function migrateLocalRecords() {
    if (localStorage.getItem(MIGRATION_KEY) || state.records.length) return;
    let localRecords;
    try {
      localRecords = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
    } catch {
      localRecords = [];
    }
    if (!Array.isArray(localRecords) || !localRecords.length) {
      localStorage.setItem(MIGRATION_KEY, "no-local-records");
      return;
    }

    const today = new Date();
    const end = today.toISOString().slice(0, 10);
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 13);
    const start = startDate.toISOString().slice(0, 10);
    const payload = localRecords.map((item) => ({
      user_id: state.session.user.id,
      period: String(item.period || "历史双周记录"),
      period_start: item.period_start || start,
      period_end: item.period_end || end,
      work: String(item.work || "历史记录"),
      link: item.link || null,
      review: String(item.review || "由本地记录迁移"),
      status: item.status === "已完成" ? "已完成" : "进行中",
    }));
    const { error } = await state.client.from("progress_entries").insert(payload);
    if (error) {
      showToast("本地记录暂未迁移，原数据仍保留在浏览器中", "error");
      return;
    }
    localStorage.setItem(MIGRATION_KEY, new Date().toISOString());
    await loadRecords();
    showToast(`已将 ${payload.length} 条本地记录迁移到云端`);
  }

  async function applySession(session) {
    state.session = session;
    const signedIn = Boolean(session?.user);
    $("authScreen").hidden = signedIn;
    $("appShell").hidden = !signedIn;
    if (!signedIn) {
      state.records = [];
      return;
    }
    $("userEmail").textContent = session.user.email || "已登录";
    await loadRecords();
    await migrateLocalRecords();
  }

  async function signIn(email) {
    setAuthMessage("正在发送登录链接…");
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error } = await state.client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo, shouldCreateUser: config.allowSignup === true },
    });
    if (error) {
      setAuthMessage(error.message || "登录链接发送失败", "error");
      throw error;
    }
    setAuthMessage("登录链接已发送，请到邮箱中点击确认。", "success");
  }

  async function signOut() {
    setLoading(true, "正在退出");
    const { error } = await state.client.auth.signOut({ scope: "local" });
    setLoading(false);
    if (error) showToast("退出失败，请重试", "error");
  }

  async function createRecord(form) {
    const data = new FormData(form);
    setLoading(true, "正在保存");
    const payload = {
      user_id: state.session.user.id,
      period: String(data.get("period") || ""),
      period_start: String(data.get("period_start") || ""),
      period_end: String(data.get("period_end") || ""),
      work: String(data.get("work") || ""),
      link: String(data.get("link") || "") || null,
      review: String(data.get("review") || ""),
      status: String(data.get("status") || "进行中"),
    };
    const { data: saved, error } = await state.client
      .from("progress_entries")
      .insert(payload)
      .select()
      .single();
    if (error) {
      setLoading(false);
      showToast(error.message || "保存失败，请检查填写内容", "error");
      throw error;
    }
    state.records.push(saved);
    render();
    form.reset();
    form.querySelector('[value="进行中"]').checked = true;
    setDefaultDates();
    setLoading(false);
    showToast("本期成果已保存到云端");
  }

  async function toggleRecord(id) {
    const record = state.records.find((item) => item.id === id);
    if (!record) return;
    const nextStatus = record.status === "已完成" ? "进行中" : "已完成";
    setLoading(true, "正在更新状态");
    const { error } = await state.client
      .from("progress_entries")
      .update({ status: nextStatus })
      .eq("id", id);
    if (error) {
      setLoading(false);
      showToast("状态更新失败", "error");
      return;
    }
    record.status = nextStatus;
    render();
    setLoading(false);
  }

  async function deleteRecord(button) {
    if (button.dataset.confirmDelete !== "true") {
      button.dataset.confirmDelete = "true";
      button.textContent = "再次点击确认";
      window.setTimeout(() => {
        if (button.isConnected) {
          button.dataset.confirmDelete = "false";
          button.textContent = "删除";
        }
      }, 4000);
      return;
    }
    const id = button.dataset.id;
    setLoading(true, "正在删除");
    const { error } = await state.client.from("progress_entries").delete().eq("id", id);
    if (error) {
      setLoading(false);
      showToast("删除失败", "error");
      return;
    }
    state.records = state.records.filter((item) => item.id !== id);
    render();
    setLoading(false);
    showToast("记录已删除");
  }

  function exportRecords() {
    const blob = new Blob([JSON.stringify(state.records, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "小淇的双周成长记录.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function setDefaultDates() {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 13);
    $("periodStart").value = start.toISOString().slice(0, 10);
    $("periodEnd").value = end.toISOString().slice(0, 10);
  }

  function bindEvents() {
    $("authForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = String(new FormData(event.currentTarget).get("email") || "").trim();
      try { await signIn(email); } catch { /* surfaced in the form */ }
    });
    $("signOut").addEventListener("click", signOut);
    $("export").addEventListener("click", exportRecords);
    $("form").addEventListener("submit", async (event) => {
      event.preventDefault();
      try { await createRecord(event.currentTarget); } catch { /* surfaced in toast */ }
    });
    $("timeline").addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-cloud-action]");
      if (!button || state.loading) return;
      if (button.dataset.cloudAction === "toggle") await toggleRecord(button.dataset.id);
      if (button.dataset.cloudAction === "delete") await deleteRecord(button);
    });
  }

  async function init() {
    bindEvents();
    setDefaultDates();
    if (!window.supabase || !config.url || !config.publishableKey) {
      setAuthMessage("云端服务尚未完成配置，请稍后再试。", "error");
      return;
    }
    state.client = window.supabase.createClient(config.url, config.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    const { data, error } = await state.client.auth.getSession();
    if (error) setAuthMessage("登录状态读取失败，请刷新页面。", "error");
    await applySession(data.session);
    state.client.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => { applySession(session).catch(console.error); }, 0);
    });
  }

  window.QQQIBackend = { init, signIn, signOut, loadRecords, migrateLocalRecords };
  init().catch((error) => {
    console.error(error);
    setAuthMessage("云端服务初始化失败，请稍后重试。", "error");
  });
})();
