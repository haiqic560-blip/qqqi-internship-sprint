(() => {
  "use strict";

  const LOCAL_KEY = "qqqi-growth-records-v1";
  const MIGRATION_KEY = "qqqi-cloud-migration-v1";
  const config = window.QQQI_SUPABASE_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const state = {
    client: null,
    session: null,
    records: [],
    loading: false,
    authLoading: false,
    authMode: "signin",
    activeUserId: null,
  };

  const AUTH_CONTENT = {
    signin: {
      title: "继续你的实习逆袭之路",
      copy: "使用邮箱和密码登录，双周记录会安全同步到手机和电脑。",
      hint: "输入创建账号时设置的密码。",
      submit: "登录成长站",
      pending: "正在登录…",
    },
    signup: {
      title: "创建你的专属成长账号",
      copy: "首次使用时，用邮箱和至少 8 位密码创建账号；之后即可直接登录。",
      hint: "设置至少 8 位密码，并妥善保存。",
      submit: "创建账号并进入",
      pending: "正在创建账号…",
    },
  };

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

  function setAuthLoading(loading) {
    state.authLoading = loading;
    const content = AUTH_CONTENT[state.authMode];
    const form = $("authForm");
    form.setAttribute("aria-busy", String(loading));
    $("authSubmit").disabled = loading;
    $("authSubmitLabel").textContent = loading ? content.pending : content.submit;
    form.querySelectorAll("input, [data-auth-mode]").forEach((element) => {
      element.disabled = loading;
    });
  }

  function setAuthMode(mode, clearMessage = true) {
    if (!AUTH_CONTENT[mode]) return;
    state.authMode = mode;
    const content = AUTH_CONTENT[mode];
    $("authTitle").textContent = content.title;
    $("authCopy").textContent = content.copy;
    $("authPasswordHint").textContent = content.hint;
    $("authSubmitLabel").textContent = content.submit;
    $("authPassword").autocomplete = mode === "signup" ? "new-password" : "current-password";
    document.querySelectorAll("[data-auth-mode]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.authMode === mode));
    });
    if (clearMessage) setAuthMessage("");
  }

  function getAuthErrorMessage(error, mode = state.authMode) {
    const code = String(error?.code || "").toLowerCase();
    const message = String(error?.message || "").toLowerCase();
    const matches = (...terms) => terms.some((term) => code.includes(term) || message.includes(term));

    if (matches("invalid_credentials", "invalid login credentials")) {
      return "邮箱或密码不正确。请检查后重试；首次使用请先创建账号。";
    }
    if (matches("email_not_confirmed", "email not confirmed")) {
      return "该账号尚未完成认证，请联系管理员检查邮箱确认设置。";
    }
    if (matches("user_already_exists", "user already registered", "already been registered")) {
      return "这个邮箱已经创建过账号，请切换到“已有账号”登录。";
    }
    if (matches("weak_password", "password should be", "password must be", "password is too short")) {
      return "密码强度不足。请至少设置 8 位，并避免使用过于简单的密码。";
    }
    if (matches("signup_disabled", "signups not allowed", "signup is disabled")) {
      return "当前暂不开放创建账号，请使用已有账号登录。";
    }
    if (matches("over_request_rate_limit", "rate limit", "too many requests")) {
      return "操作太频繁，请稍等几分钟后再试。";
    }
    if (matches("invalid email", "email address is invalid", "unable to validate email")) {
      return "邮箱格式不正确，请检查后重新输入。";
    }
    if (matches("failed to fetch", "networkerror", "network request failed", "load failed")) {
      return "网络连接失败，请检查网络后重试。";
    }
    if (matches("database error", "unexpected_failure")) {
      return "账号服务暂时不可用，请稍后重试。";
    }
    return mode === "signup"
      ? "账号创建失败，请检查信息后稍后重试。"
      : "登录失败，请检查邮箱和密码后重试。";
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
      state.activeUserId = null;
      return;
    }
    $("userEmail").textContent = session.user.email || "已登录";
    if (state.activeUserId === session.user.id) return;
    state.activeUserId = session.user.id;
    try {
      await loadRecords();
      await migrateLocalRecords();
    } catch (error) {
      state.activeUserId = null;
      throw error;
    }
  }

  async function signIn(email, password) {
    return state.client.auth.signInWithPassword({ email, password });
  }

  async function signUp(email, password) {
    return state.client.auth.signUp({ email, password });
  }

  async function authenticate(email, password) {
    if (state.authLoading) return;
    const mode = state.authMode;
    setAuthMessage(mode === "signup" ? "正在创建账号…" : "正在验证账号…");
    setAuthLoading(true);
    try {
      const { data, error } = mode === "signup"
        ? await signUp(email, password)
        : await signIn(email, password);
      if (error) throw error;

      if (mode === "signup" && !data.session && data.user?.identities?.length === 0) {
        setAuthMode("signin", false);
        setAuthMessage("这个邮箱已经创建过账号，请使用刚才输入的密码登录。", "error");
        return;
      }
      if (!data.session) {
        setAuthMessage("账号已创建，但认证服务仍要求邮箱确认。请联系管理员关闭邮箱确认后再登录。", "error");
        return;
      }

      setAuthMessage(mode === "signup" ? "账号创建成功，正在进入…" : "登录成功，正在读取记录…", "success");
      try {
        await applySession(data.session);
      } catch (syncError) {
        console.error(syncError);
        setAuthMessage("账号已登录，但云端记录暂时无法读取。请稍后刷新页面重试。", "error");
      }
    } catch (error) {
      setAuthMessage(getAuthErrorMessage(error, mode), "error");
      throw error;
    } finally {
      setAuthLoading(false);
    }
  }

  async function signOut() {
    setLoading(true, "正在退出");
    const { error } = await state.client.auth.signOut({ scope: "local" });
    setLoading(false);
    if (error) {
      showToast("退出失败，请重试", "error");
      return;
    }
    await applySession(null);
    setAuthMode("signin");
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
    document.querySelectorAll("[data-auth-mode]").forEach((button) => {
      button.addEventListener("click", () => setAuthMode(button.dataset.authMode));
    });
    $("authForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const email = String(data.get("email") || "").trim();
      const password = String(data.get("password") || "");
      if (password.length < 8) {
        setAuthMessage("密码至少需要 8 位。", "error");
        $("authPassword").focus();
        return;
      }
      try { await authenticate(email, password); } catch { /* surfaced in the form */ }
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

  window.QQQIBackend = { init, signIn, signUp, signOut, loadRecords, migrateLocalRecords };
  init().catch((error) => {
    console.error(error);
    setAuthMessage("云端服务初始化失败，请稍后重试。", "error");
  });
})();
