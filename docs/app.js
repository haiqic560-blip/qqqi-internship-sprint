(() => {
  "use strict";

  const LOCAL_KEY = "qqqi-growth-records-v1";
  const MIGRATION_KEY = "qqqi-cloud-migration-v1";
  const GITHUB_CACHE_KEY = "qqqi-github-activity-v1";
  const GITHUB_CACHE_TTL = 15 * 60 * 1000;
  const FONT_SCALE_KEY = "qqqi-font-scale-v1";
  const config = window.QQQI_SUPABASE_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const state = {
    client: null,
    session: null,
    records: [],
    tasks: [],
    loading: false,
    authLoading: false,
    authMode: "signin",
    activeUserId: null,
    taskLoadingKey: null,
    evidenceTaskKey: null,
    githubLoading: false,
    githubActivity: null,
  };

  const AUTH_CONTENT = {
    signin: {
      title: "继续你的实习逆袭之路",
      copy: "使用邮箱和密码登录，学习任务与双周记录会安全同步到手机和电脑。",
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

  const TASK_STATUSES = ["未开始", "进行中", "已完成"];
  const CHECKPOINTS = [
    { date: "2026-07-31", title: "JavaSE 阶段总结" },
    { date: "2026-08-14", title: "数据结构与数据库准备总结" },
    { date: "2026-08-28", title: "暑期项目开发总结" },
    { date: "2026-08-31", title: "第一阶段最终验收" },
  ];

  const ROADMAP_STAGES = [
    {
      key: "stage-1",
      title: "第一阶段 · 大一下 + 暑假",
      period: "2026.07 — 2026.08",
      start: "2026-07-11",
      end: "2026-08-31",
      objective: "完成 JavaSE、数据结构基础和第一个 JavaSE + JDBC + MySQL 项目，建立 Git 与工程习惯。",
      tags: ["JavaSE", "Git / GitHub", "数据结构", "每日算法", "暑期项目"],
    },
    {
      key: "stage-2",
      title: "第二阶段 · 大二上 + 寒假",
      period: "2026.09 — 2027.01",
      start: "2026-09-01",
      end: "2027-01-31",
      objective: "学校课程与企业学习同步推进，打通 ECMAScript、数据库、JavaWeb 和 Spring Boot 全链路。",
      tags: ["ECMAScript", "MySQL", "Linux", "JavaWeb", "Spring Boot", "软件测试"],
    },
    {
      key: "stage-3",
      title: "第三阶段 · 大二下 + 暑假",
      period: "2027.02 — 2027.08",
      start: "2027-02-01",
      end: "2027-08-31",
      objective: "做深一个企业级项目，加入 AI 创意亮点，形成可投递的简历、GitHub 与个人品牌。",
      tags: ["企业级项目", "Redis", "JWT", "AI 应用", "计算机网络", "简历"],
    },
    {
      key: "stage-4",
      title: "第四阶段 · 大三上及以后",
      period: "2027.09 — 长期",
      start: "2027-09-01",
      end: null,
      objective: "实习与升本双线推进，从真实项目和面试反馈中补齐技术深度。",
      tags: ["实习投递", "升本", "企业技术栈", "JVM", "持续复盘"],
    },
  ];

  function defineTask(taskKey, stageKey, category, title, detail, targetStart, targetEnd, cadence, priority) {
    return {
      task_key: taskKey,
      stage_key: stageKey,
      category,
      title,
      detail,
      target_start: targetStart,
      target_end: targetEnd,
      cadence,
      priority,
    };
  }

  const ROADMAP_TASKS = [
    defineTask("s1-git-setup", "stage-1", "暑假前准备", "建立 Git 与 GitHub 工作流", "创建学习仓库，完成首个 commit 和 push；以后每个项目都用 Git 管理。", "2026-07-11", "2026-07-17", "一次", 5),
    defineTask("s1-javase-oop", "stage-1", "JavaSE 收尾", "真正理解面向对象", "通过手敲代码理解封装、继承、多态与接口，不只背概念。", "2026-07-11", "2026-07-20", "一次", 5),
    defineTask("s1-javase-api-exception", "stage-1", "JavaSE 收尾", "常用 API 与异常处理", "学会查 Java API 文档，完成常用 API 和异常处理练习。", "2026-07-18", "2026-07-23", "一次", 4),
    defineTask("s1-javase-io-collections", "stage-1", "JavaSE 收尾", "IO 与集合实现思想", "重点理解 ArrayList、HashMap 的使用场景与实现思想，并完成 IO 练习。", "2026-07-18", "2026-07-27", "一次", 5),
    defineTask("s1-javase-thread", "stage-1", "JavaSE 收尾", "多线程创建方式", "掌握 Thread、Runnable、Callable 的基本创建方式，不深入 JUC 源码。", "2026-07-28", "2026-07-31", "一次", 3),
    defineTask("s1-weekly-notes", "stage-1", "稳定节奏", "每周整理学习笔记", "每周至少整理一份可回顾的学习笔记，记录理解、报错与解决过程。", "2026-07-11", "2026-08-31", "每周", 4),
    defineTask("s1-git-chapter", "stage-1", "稳定节奏", "每完成一章提交 Git", "章节代码手敲完成后立即提交，形成连续、真实的成长证据。", "2026-07-11", "2026-08-31", "每章", 5),
    defineTask("s1-leetcode-daily", "stage-1", "稳定节奏", "算法每天 1 题", "优先数组、字符串和链表，不提前刷 DP 与图论。", "2026-07-18", "2026-08-31", "每日", 4),
    defineTask("s1-ds-linear", "stage-1", "数据结构", "手写线性结构", "自己实现顺序表、单链表、栈和队列，并能解释核心操作。", "2026-08-01", "2026-08-10", "一次", 5),
    defineTask("s1-ds-tree-sort", "stage-1", "数据结构", "二叉树、查找、排序与递归", "实现二叉树，理解二分查找、冒泡、快速排序和递归思想。", "2026-08-08", "2026-08-14", "一次", 4),
    defineTask("s1-jdbc-mysql", "stage-1", "项目准备", "掌握 JDBC 与 MySQL 基础", "完成数据库连接、基础 SQL 和 Java 数据访问练习。", "2026-08-01", "2026-08-14", "一次", 5),
    defineTask("s1-project-scope", "stage-1", "项目准备", "确定选题与需求范围", "从失物招领、预约、停车或成绩分析中选题，明确用户、核心流程与不做事项。", "2026-08-01", "2026-08-04", "一次", 5),
    defineTask("s1-project-schema", "stage-1", "项目准备", "完成数据库设计", "画出核心数据关系，建立 MySQL 表结构并准备可重复执行的初始化 SQL。", "2026-08-05", "2026-08-08", "一次", 5),
    defineTask("s1-project-login-crud", "stage-1", "暑期项目", "完成登录流程", "用 JavaSE + JDBC + MySQL 完成账号登录、输入校验与基础异常提示。", "2026-08-15", "2026-08-18", "一次", 5),
    defineTask("s1-project-crud", "stage-1", "暑期项目", "完成核心 CRUD", "围绕项目主实体打通新增、查询、修改和删除，确保主流程可演示。", "2026-08-18", "2026-08-23", "一次", 5),
    defineTask("s1-project-page-error", "stage-1", "暑期项目", "完成分页与异常处理", "增加分页、输入校验和简单异常处理，让项目能够稳定演示。", "2026-08-23", "2026-08-28", "一次", 5),
    defineTask("s1-project-test", "stage-1", "验收复盘", "测试和演示检查", "覆盖登录、CRUD、分页和异常场景，修复阻塞演示的问题并准备演示数据。", "2026-08-27", "2026-08-29", "一次", 5),
    defineTask("s1-project-release", "stage-1", "验收复盘", "README、复盘与 GitHub 发布", "整理启动说明、功能截图、技术收获与下一步计划，在 8 月 31 日前发布验收。", "2026-08-29", "2026-08-31", "一次", 5),

    defineTask("s2-es", "stage-2", "学校主线", "ECMAScript 与前后端联调基础", "掌握 ES6、DOM、Ajax、Promise，为 Spring Boot 联调做准备。", "2026-09-01", "2026-09-30", "一次", 4),
    defineTask("s2-mysql", "stage-2", "数据库", "MySQL 企业基础", "掌握 SQL、多表查询、索引、Explain、事务和数据库设计。", "2026-10-01", "2026-10-21", "一次", 5),
    defineTask("s2-linux", "stage-2", "工程能力", "Linux 基础命令", "熟练使用 cd、ls、grep、vim、ssh。", "2026-09-01", "2027-01-31", "每周", 3),
    defineTask("s2-git", "stage-2", "工程能力", "Git 分支协作", "熟练 branch、merge 与 pull request，所有项目必须使用 Git。", "2026-09-01", "2027-01-31", "每个项目", 4),
    defineTask("s2-javaweb", "stage-2", "Java Web", "理解 HTTP 到 Servlet 全链路", "真正理解 HTTP、Cookie、Session、Servlet 和 Tomcat，不大量投入 JSP。", "2026-10-15", "2026-11-30", "一次", 5),
    defineTask("s2-springboot", "stage-2", "JavaEE 主线", "独立开发完整后台", "掌握 Spring Boot、Spring MVC、MyBatis-Plus、REST、文件上传、异常与日志。", "2026-11-01", "2027-01-31", "一次", 5),
    defineTask("s2-testing", "stage-2", "软件测试", "JUnit 与接口测试", "使用 JUnit、Postman 完成接口测试并能定位常见 Bug。", "2026-12-01", "2027-01-31", "一次", 3),
    defineTask("s2-algorithm", "stage-2", "持续积累", "蓝桥杯与算法 100—150 题", "每天 1—2 题，持续报名并以省二等奖以上为目标。", "2026-09-01", "2027-01-31", "每日", 4),
    defineTask("s2-cs", "stage-2", "持续积累", "计算机基础每周 4 小时", "固定学习操作系统与计算机网络，不等面试再突击。", "2026-09-01", "2027-01-31", "每周 4 小时", 3),

    defineTask("s3-project-core", "stage-3", "企业级项目", "做深一个企业级项目", "使用 Spring Boot、MyBatis-Plus、MySQL，先把业务主链路做扎实。", "2027-02-01", "2027-04-30", "一次", 5),
    defineTask("s3-auth", "stage-3", "企业级项目", "JWT 与权限控制", "先完成 JWT 登录与权限，再学习 Spring Security。", "2027-03-01", "2027-04-30", "一次", 5),
    defineTask("s3-redis", "stage-3", "企业级项目", "用 Redis 解决真实问题", "围绕缓存、热点数据或验证码等真实需求使用 Redis。", "2027-04-01", "2027-05-31", "一次", 5),
    defineTask("s3-quality", "stage-3", "企业级项目", "上传、优化、日志与部署", "完成文件上传、分页、数据库优化、日志和部署上线。", "2027-05-01", "2027-06-30", "一次", 5),
    defineTask("s3-ai", "stage-3", "AI 创意", "完善 AI 创意项目", "为人生叙事游戏或个人网站加入 Spring AI、对话或剧情生成。", "2027-05-01", "2027-08-15", "一次", 4),
    defineTask("s3-network", "stage-3", "计算机基础", "TCP、UDP、HTTP 与 HTTPS", "结合 Wireshark 抓包理解协议。", "2027-02-01", "2027-08-31", "每周", 3),
    defineTask("s3-bluebridge", "stage-3", "竞赛", "蓝桥杯省二等奖以上", "保持训练、复盘错题并参加比赛。", "2027-02-01", "2027-06-30", "每周", 4),
    defineTask("s3-resume", "stage-3", "个人品牌", "完成第一版简历与作品集", "整理企业项目、AI 项目、GitHub、个人网站和竞赛成果。", "2027-07-01", "2027-08-31", "一次", 5),

    defineTask("s4-internship", "stage-4", "职业发展", "有项目就开始投实习", "通过真实投递和面试发现短板，不等待准备完美。", "2027-09-01", null, "每周", 5),
    defineTask("s4-degree", "stage-4", "战略主线", "升本优先并动态平衡实习", "根据真实备考压力调整实习投入，学历主线优先。", "2027-09-01", null, "每月复盘", 5),
    defineTask("s4-company-stack", "stage-4", "企业学习", "学习公司真实使用的技术", "按工作需要学习 Redis、RabbitMQ、Docker、RPC、CI/CD，不追新框架。", "2027-09-01", null, "按项目", 4),
    defineTask("s4-jvm", "stage-4", "校招基础", "学习够用的 JVM", "掌握类加载、内存结构和 GC，不深入 JVM 源码。", "2027-09-01", null, "一次", 3),
  ];

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

  function applyFontScale(enabled) {
    document.body.dataset.fontScale = enabled ? "xl" : "comfortable";
    const button = $("fontScale");
    button.setAttribute("aria-pressed", String(enabled));
    button.textContent = enabled ? "字号 标准" : "字号 A+";
  }

  function toggleFontScale() {
    const enabled = document.body.dataset.fontScale !== "xl";
    applyFontScale(enabled);
    localStorage.setItem(FONT_SCALE_KEY, enabled ? "xl" : "comfortable");
    showToast(enabled ? "已切换为超大字号" : "已恢复舒适字号");
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
      .format(new Date(`${value}T00:00:00+08:00`));
  }

  function getShanghaiDateString(date = new Date()) {
    const parts = new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  function dateValue(value) {
    return new Date(`${value}T00:00:00+08:00`).getTime();
  }

  function shiftDate(value, days) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
  }

  function daysBetween(from, to) {
    return Math.ceil((dateValue(to) - dateValue(from)) / 86400000);
  }

  function getCurrentStage(today = getShanghaiDateString()) {
    return ROADMAP_STAGES.find((stage) => {
      if (today < stage.start) return false;
      return !stage.end || today <= stage.end;
    }) || (today < ROADMAP_STAGES[0].start ? ROADMAP_STAGES[0] : ROADMAP_STAGES.at(-1));
  }

  function getCurrentPhase(today = getShanghaiDateString()) {
    if (today <= "2026-07-17") return "暑假前准备期";
    if (today <= "2026-07-31") return "JavaSE 收尾冲刺";
    if (today <= "2026-08-14") return "数据结构 + 项目准备";
    if (today <= "2026-08-28") return "暑期项目开发";
    if (today <= "2026-08-31") return "验收与复盘";
    const stage = getCurrentStage(today);
    return stage.key === "stage-4" ? "实习与升本双线推进" : stage.title.split("·").at(-1).trim();
  }

  function getNextCheckpoint(today = getShanghaiDateString()) {
    return CHECKPOINTS.find((checkpoint) => checkpoint.date >= today)
      || { date: getCurrentStage(today).end || today, title: "进入下一阶段前完成一次总复盘" };
  }

  function getStageTasks(stageKey) {
    return state.tasks.filter((task) => task.stage_key === stageKey);
  }

  function sortTasks(tasks) {
    return [...tasks].sort((a, b) => {
      if (a.status === "已完成" && b.status !== "已完成") return 1;
      if (b.status === "已完成" && a.status !== "已完成") return -1;
      if (Number(b.priority) !== Number(a.priority)) return Number(b.priority) - Number(a.priority);
      return String(a.target_end || "9999-12-31").localeCompare(String(b.target_end || "9999-12-31"));
    });
  }

  function renderFocus(stage, today) {
    const focusList = $("focusList");
    focusList.replaceChildren();
    const candidates = sortTasks(getStageTasks(stage.key).filter((task) => {
      if (task.status === "已完成") return false;
      if (!task.target_start) return true;
      return task.target_start <= today || daysBetween(today, task.target_start) <= 14;
    })).slice(0, 3);

    if (!candidates.length) {
      const empty = make("div", "empty");
      empty.append(make("strong", "", "当前重点已清空"), make("p", "", "可以进入下一阶段，或先完成一次阶段复盘。"));
      focusList.append(empty);
      return;
    }

    candidates.forEach((task, index) => {
      const item = make("div", "focus-item");
      const copy = make("div", "");
      copy.append(make("h4", "", task.title), make("p", "", task.detail));
      const status = make("span", "focus-status", task.status);
      status.dataset.status = task.status;
      item.append(make("span", "focus-number", String(index + 1).padStart(2, "0")), copy, status);
      focusList.append(item);
    });
  }

  function renderRhythm(stage, today) {
    const rhythmList = $("rhythmList");
    rhythmList.replaceChildren();
    const rhythms = sortTasks(getStageTasks(stage.key).filter((task) => {
      if (task.cadence === "一次" || task.status === "已完成") return false;
      return !task.target_start || task.target_start <= today;
    })).slice(0, 4);

    if (!rhythms.length) {
      rhythmList.append(make("p", "mission-objective", "当前阶段先完成一次性里程碑，不额外增加打卡压力。"));
      return;
    }

    rhythms.forEach((task) => {
      const item = make("div", "rhythm-item");
      const copy = make("div", "", task.title);
      copy.append(make("small", "", task.detail));
      item.append(make("strong", "", task.cadence), copy);
      rhythmList.append(item);
    });
  }

  function renderRoadmap(currentStage, today) {
    const roadmap = $("roadmapList");
    roadmap.replaceChildren();
    ROADMAP_STAGES.forEach((stage) => {
      const tasks = getStageTasks(stage.key);
      const completed = tasks.filter((task) => task.status === "已完成").length;
      const percent = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
      const details = make("details", "stage-item");
      if (stage.key === currentStage.key) details.open = true;
      const stageState = stage.end && stage.end < today ? "past" : stage.key === currentStage.key ? "current" : "future";
      details.dataset.state = stageState;

      const summary = document.createElement("summary");
      const time = make("div", "stage-time", stage.period);
      time.append(make("span", "", stageState === "current" ? "当前阶段" : stageState === "future" ? "未来阶段" : "已结束阶段"));
      const copy = make("div", "stage-summary");
      copy.append(make("h3", "", stage.title), make("p", "", stage.objective));
      const progress = make("div", "stage-progress");
      const progressText = make("div", "");
      progressText.append(make("span", "", "任务进度"), make("strong", "", `${completed} / ${tasks.length}`));
      const mini = make("div", "mini-progress");
      const bar = make("i", "");
      bar.style.width = `${percent}%`;
      mini.append(bar);
      progress.append(progressText, mini);
      summary.append(time, copy, progress);

      const body = make("div", "stage-body");
      const tags = make("div", "stage-task-tags");
      stage.tags.forEach((tag) => tags.append(make("span", "", tag)));
      body.append(tags);
      if (stage.key === "stage-1") {
        const track = make("div", "checkpoint-track");
        const next = getNextCheckpoint(today);
        CHECKPOINTS.forEach((checkpoint) => {
          const card = make("div", "checkpoint");
          card.dataset.state = checkpoint.date < today ? "past" : checkpoint.date === next.date ? "next" : "future";
          const mark = make("span", "checkpoint-mark");
          const date = document.createElement("time");
          date.dateTime = checkpoint.date;
          date.textContent = formatDate(checkpoint.date);
          card.append(mark, date, make("b", "", checkpoint.title));
          track.append(card);
        });
        body.append(track);
      }
      details.append(summary, body);
      roadmap.append(details);
    });
  }

  function createTaskActions(task, compact = false) {
    const actions = make("div", compact ? "milestone-controls" : "task-actions");
    if (task.evidence_link) {
      const link = make("a", "evidence-link", "查看证据 ↗");
      link.href = task.evidence_link;
      link.target = "_blank";
      link.rel = "noreferrer";
      actions.append(link);
    }
    const evidence = make("button", "evidence-action", task.evidence_link || task.evidence_note ? "编辑证据" : "添加证据");
    evidence.type = "button";
    evidence.dataset.evidenceTaskKey = task.task_key;
    evidence.setAttribute("aria-label", `${evidence.textContent}：“${task.title}”`);
    const status = make("button", "status-cycle", task.status);
    status.type = "button";
    status.dataset.taskKey = task.task_key;
    status.dataset.status = task.status;
    status.disabled = state.taskLoadingKey === task.task_key;
    status.setAttribute("aria-label", `更新“${task.title}”状态，当前为${task.status}`);
    actions.append(evidence, status);
    return actions;
  }

  function renderTaskBoard(stage) {
    const taskBoard = $("taskBoard");
    taskBoard.replaceChildren();
    const tasks = getStageTasks(stage.key);
    $("taskSectionTitle").textContent = `${stage.title}任务`;
    $("taskCount").textContent = `${tasks.length} 项`;
    const groups = new Map();
    tasks.forEach((task) => {
      if (!groups.has(task.category)) groups.set(task.category, []);
      groups.get(task.category).push(task);
    });

    groups.forEach((groupTasks, category) => {
      const group = make("section", "task-group");
      const groupTitle = make("h3", "task-group-title", category);
      groupTitle.append(make("span", "", `${groupTasks.filter((task) => task.status === "已完成").length} / ${groupTasks.length} 完成`));
      group.append(groupTitle);
      sortTasks(groupTasks).forEach((task) => {
        const row = make("div", "task-row");
        const copy = make("div", "task-copy");
        copy.append(make("h4", "", task.title), make("p", "", task.detail));
        const meta = make("div", "task-meta");
        if (task.target_end) meta.append(make("span", "", `目标 ${formatDate(task.target_end)}`));
        meta.append(make("span", "", task.cadence));
        copy.append(meta);
        row.append(copy, createTaskActions(task));
        group.append(row);
      });
      taskBoard.append(group);
    });
  }

  function getProjectTasks() {
    const categories = new Set(["项目准备", "暑期项目", "验收复盘"]);
    return sortTasks(state.tasks.filter((task) => task.stage_key === "stage-1" && categories.has(task.category)));
  }

  function renderMilestones() {
    const list = $("milestoneList");
    const tasks = getProjectTasks();
    const completed = tasks.filter((task) => task.status === "已完成").length;
    const percent = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
    $("milestoneProgressText").textContent = `${completed} / ${tasks.length} 完成`;
    $("milestoneProgressBar").style.width = `${percent}%`;
    list.replaceChildren();
    tasks.forEach((task, index) => {
      const card = make("article", "milestone-card");
      card.dataset.status = task.status;
      const copy = make("div", "milestone-copy");
      copy.append(make("h3", "", task.title), make("p", "", task.detail));
      if (task.evidence_note) {
        const note = make("p", "github-state", `证据：${task.evidence_note}`);
        copy.append(note);
      }
      copy.append(make("time", "milestone-date", task.target_end ? `目标 ${formatDate(task.target_end)}` : "长期任务"));
      copy.append(createTaskActions(task, true));
      card.append(make("span", "milestone-number", String(index + 1).padStart(2, "0")), copy);
      list.append(card);
    });
  }

  function openEvidenceDialog(taskKey) {
    const task = state.tasks.find((candidate) => candidate.task_key === taskKey);
    if (!task) return;
    state.evidenceTaskKey = taskKey;
    $("evidenceTaskName").textContent = task.title;
    $("evidenceLink").value = task.evidence_link || "";
    $("evidenceNote").value = task.evidence_note || "";
    $("evidenceClear").hidden = !(task.evidence_link || task.evidence_note);
    $("evidenceDialog").showModal();
    window.setTimeout(() => $("evidenceLink").focus(), 0);
  }

  function closeEvidenceDialog() {
    state.evidenceTaskKey = null;
    $("evidenceDialog").close();
  }

  async function saveTaskEvidence(form) {
    const task = state.tasks.find((candidate) => candidate.task_key === state.evidenceTaskKey);
    if (!task) return;
    const data = new FormData(form);
    const evidenceLink = String(data.get("evidence_link") || "").trim() || null;
    const evidenceNote = String(data.get("evidence_note") || "").trim() || null;
    if (!evidenceLink && !evidenceNote) {
      showToast("请填写成果链接或证据说明", "error");
      return;
    }
    $("evidenceSave").disabled = true;
    const { error } = await state.client
      .from("learning_tasks")
      .update({ evidence_link: evidenceLink, evidence_note: evidenceNote })
      .eq("task_key", task.task_key)
      .eq("user_id", state.session.user.id);
    $("evidenceSave").disabled = false;
    if (error) {
      showToast("证据保存失败，请稍后重试", "error");
      return;
    }
    task.evidence_link = evidenceLink;
    task.evidence_note = evidenceNote;
    closeEvidenceDialog();
    renderLearningPlan();
    showToast("任务成果证据已保存");
  }

  async function clearTaskEvidence() {
    const task = state.tasks.find((candidate) => candidate.task_key === state.evidenceTaskKey);
    if (!task) return;
    $("evidenceClear").disabled = true;
    const { error } = await state.client
      .from("learning_tasks")
      .update({ evidence_link: null, evidence_note: null })
      .eq("task_key", task.task_key)
      .eq("user_id", state.session.user.id);
    $("evidenceClear").disabled = false;
    if (error) {
      showToast("证据清空失败，请稍后重试", "error");
      return;
    }
    task.evidence_link = null;
    task.evidence_note = null;
    closeEvidenceDialog();
    renderLearningPlan();
    showToast("任务成果证据已清空");
  }

  function renderGitHubActivity(activity) {
    $("githubCommits").textContent = String(activity.commits);
    $("githubRepos").textContent = String(activity.activeRepos);
    const list = $("githubRepoList");
    list.replaceChildren();
    activity.repos.slice(0, 4).forEach((repo) => {
      const item = make("div", "repo-item");
      const link = make("a", "", repo.name);
      link.href = repo.html_url;
      link.target = "_blank";
      link.rel = "noreferrer";
      const updated = new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(new Date(repo.pushed_at));
      item.append(link, make("span", "", `${updated} 更新`));
      list.append(item);
    });
    if (!activity.repos.length) list.append(make("p", "github-state", "还没有可展示的公开仓库。"));
    const syncedAt = new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date(activity.fetchedAt));
    $("githubState").textContent = `公开数据 · ${syncedAt} 同步 · 不需要访问令牌`;
  }

  async function loadGitHubActivity(force = false) {
    if (state.githubLoading) return;
    const username = config.githubUsername;
    if (!username) {
      $("githubState").textContent = "尚未配置 GitHub 用户名。";
      return;
    }
    if (!force) {
      try {
        const cached = JSON.parse(localStorage.getItem(GITHUB_CACHE_KEY) || "null");
        if (cached && Date.now() - cached.fetchedAt < GITHUB_CACHE_TTL) {
          state.githubActivity = cached;
          renderGitHubActivity(cached);
          return;
        }
      } catch { /* ignore invalid cache */ }
    }
    state.githubLoading = true;
    $("githubRefresh").disabled = true;
    $("githubState").textContent = "正在同步 GitHub 公开活动…";
    try {
      const headers = { Accept: "application/vnd.github+json" };
      const [eventsResponse, reposResponse] = await Promise.all([
        fetch(`https://api.github.com/users/${encodeURIComponent(username)}/events/public?per_page=100`, { headers }),
        fetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=pushed&per_page=10`, { headers }),
      ]);
      if (!eventsResponse.ok || !reposResponse.ok) throw new Error("GitHub API unavailable");
      const [events, repos] = await Promise.all([eventsResponse.json(), reposResponse.json()]);
      const since = Date.now() - 14 * 86400000;
      const recentPushes = events.filter((event) => event.type === "PushEvent" && new Date(event.created_at).getTime() >= since);
      const commits = recentPushes.length;
      const activeRepoNames = new Set(recentPushes.map((event) => event.repo?.name).filter(Boolean));
      const activity = {
        commits,
        activeRepos: activeRepoNames.size,
        repos: repos.filter((repo) => !repo.fork).slice(0, 6).map(({ name, html_url, pushed_at }) => ({ name, html_url, pushed_at })),
        fetchedAt: Date.now(),
      };
      state.githubActivity = activity;
      localStorage.setItem(GITHUB_CACHE_KEY, JSON.stringify(activity));
      renderGitHubActivity(activity);
    } catch (error) {
      console.error(error);
      $("githubState").textContent = "暂时无法连接 GitHub，点击“刷新”可重试；任务数据不受影响。";
    } finally {
      state.githubLoading = false;
      $("githubRefresh").disabled = false;
    }
  }

  function renderTaskChoices(stage, today) {
    const list = $("taskChoiceList");
    const checked = new Set([...list.querySelectorAll("input:checked")].map((input) => input.value));
    list.replaceChildren();
    const checkpoint = getNextCheckpoint(today);
    const choices = sortTasks(getStageTasks(stage.key).filter((task) => {
      if (task.target_start && task.target_start > checkpoint.date) return false;
      if (task.target_end && daysBetween(task.target_end, today) > 14) return false;
      return true;
    })).slice(0, 10);
    choices.forEach((task) => {
      const label = make("label", "task-choice");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = "roadmap_task_keys";
      input.value = task.task_key;
      input.checked = checked.has(task.task_key);
      label.append(input, document.createTextNode(task.title));
      list.append(label);
    });
    if (!choices.length) list.append(make("p", "mission-objective", "本期也可以提交计划外成果，不强制关联任务。"));
  }

  function renderLearningPlan() {
    const today = getShanghaiDateString();
    const stage = getCurrentStage(today);
    const phase = getCurrentPhase(today);
    const tasks = getStageTasks(stage.key);
    const completed = tasks.filter((task) => task.status === "已完成").length;
    const percent = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
    const checkpoint = getNextCheckpoint(today);
    const nextTask = sortTasks(tasks.filter((task) => task.status !== "已完成"))[0];

    $("phaseName").textContent = phase;
    $("stageTitle").textContent = stage.title;
    $("stageObjective").textContent = stage.objective;
    $("stageDates").textContent = stage.period;
    $("stageProgressText").textContent = tasks.length ? `${completed} / ${tasks.length}` : "路线尚未初始化";
    $("stageProgressBar").style.transform = `scaleX(${percent / 100})`;
    $("stageProgressTrack").setAttribute("aria-valuenow", String(percent));
    $("nextCheckpointDate").firstChild.textContent = checkpoint.date.slice(5).replace("-", "/");
    $("nextCheckpointTitle").textContent = checkpoint.title;
    $("completedTasks").textContent = String(completed);
    $("completedTasksDetail").textContent = `/ ${tasks.length} 项任务`;
    $("nextAction").textContent = nextTask ? nextTask.title : "完成阶段复盘，确认下一阶段重点";
    $("actionSummary").textContent = `${phase} · 下一交付：${formatDate(checkpoint.date)} ${checkpoint.title}`;
    $("daysRemaining").textContent = stage.end
      ? `${Math.max(0, daysBetween(today, stage.end))} 天后阶段验收`
      : "长期阶段 · 每月复盘";
    $("stageKey").value = stage.key;

    renderFocus(stage, today);
    renderRhythm(stage, today);
    renderRoadmap(stage, today);
    renderTaskBoard(stage);
    renderMilestones();
    renderTaskChoices(stage, today);
  }

  function render() {
    $("total").textContent = String(state.records.length);
    $("count").textContent = `${state.records.length} 条`;
    if (state.tasks.length) renderLearningPlan();

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

      content.append(top, make("h3", "", item.period));
      const meta = make("div", "record-meta");
      const stage = ROADMAP_STAGES.find((candidate) => candidate.key === item.stage_key);
      meta.append(make("span", "record-tag", stage ? stage.title.split("·")[0].trim() : "未标记阶段"));
      const related = Array.isArray(item.roadmap_task_keys) ? item.roadmap_task_keys : [];
      if (related.length) {
        related.forEach((taskKey) => {
          const task = state.tasks.find((candidate) => candidate.task_key === taskKey);
          meta.append(make("span", "record-tag record-task", task ? task.title : "历史学习任务"));
        });
      } else {
        meta.append(make("span", "record-tag", "未关联学习任务"));
      }
      content.append(meta, make("p", "", item.work));
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

  async function loadTasks() {
    const { data, error } = await state.client
      .from("learning_tasks")
      .select("id,user_id,task_key,stage_key,category,title,detail,target_start,target_end,cadence,priority,status,evidence_link,evidence_note,completed_at,created_at,updated_at")
      .order("target_start", { ascending: true, nullsFirst: false })
      .order("priority", { ascending: false });
    if (error) throw error;
    state.tasks = data || [];
    renderLearningPlan();
  }

  async function ensureRoadmapTasks() {
    setLoading(true, "正在初始化学习路线");
    const { data: existing, error: readError } = await state.client
      .from("learning_tasks")
      .select("task_key,status,evidence_link,evidence_note,completed_at");
    if (readError) {
      setLoading(false);
      throw readError;
    }
    const existingByKey = new Map((existing || []).map((task) => [task.task_key, task]));
    const roadmap = ROADMAP_TASKS.map((task) => {
      const saved = existingByKey.get(task.task_key);
      return {
        ...task,
        user_id: state.session.user.id,
        status: saved?.status || "未开始",
        evidence_link: saved?.evidence_link || null,
        evidence_note: saved?.evidence_note || null,
        completed_at: saved?.completed_at || null,
      };
    });
    if (roadmap.length) {
      const { error: upsertError } = await state.client
        .from("learning_tasks")
        .upsert(roadmap, { onConflict: "user_id,task_key" });
      if (upsertError) {
        setLoading(false);
        throw upsertError;
      }
    }
    await loadTasks();
    setLoading(false);
  }

  async function updateTaskStatus(taskKey) {
    const task = state.tasks.find((candidate) => candidate.task_key === taskKey);
    if (!task || state.taskLoadingKey) return;
    const previousStatus = task.status;
    const previousCompletedAt = task.completed_at;
    const nextStatus = TASK_STATUSES[(TASK_STATUSES.indexOf(previousStatus) + 1) % TASK_STATUSES.length];
    const completedAt = nextStatus === "已完成" ? new Date().toISOString() : null;
    task.status = nextStatus;
    task.completed_at = completedAt;
    state.taskLoadingKey = taskKey;
    renderLearningPlan();
    const { error } = await state.client
      .from("learning_tasks")
      .update({ status: nextStatus, completed_at: completedAt })
      .eq("task_key", taskKey)
      .eq("user_id", state.session.user.id);
    state.taskLoadingKey = null;
    if (error) {
      task.status = previousStatus;
      task.completed_at = previousCompletedAt;
      renderLearningPlan();
      showToast("任务状态更新失败，已恢复原状态", "error");
      return;
    }
    renderLearningPlan();
    showToast(`任务已更新为“${nextStatus}”`);
  }

  async function loadRecords() {
    setLoading(true, "正在读取云端记录");
    const { data, error } = await state.client
      .from("progress_entries")
      .select("id,user_id,period,period_start,period_end,work,link,review,status,feedback,stage_key,roadmap_task_keys,created_at,updated_at")
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

    const end = getShanghaiDateString();
    const start = shiftDate(end, -13);
    const stageKey = getCurrentStage(end).key;
    const payload = localRecords.map((item) => ({
      user_id: state.session.user.id,
      period: String(item.period || "历史双周记录"),
      period_start: item.period_start || start,
      period_end: item.period_end || end,
      work: String(item.work || "历史记录"),
      link: item.link || null,
      review: String(item.review || "由本地记录迁移"),
      status: item.status === "已完成" ? "已完成" : "进行中",
      stage_key: stageKey,
      roadmap_task_keys: [],
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
      state.tasks = [];
      state.activeUserId = null;
      return;
    }
    $("userEmail").textContent = session.user.email || "已登录";
    if (state.activeUserId === session.user.id) return;
    state.activeUserId = session.user.id;
    try {
      await ensureRoadmapTasks();
      await loadRecords();
      await migrateLocalRecords();
      loadGitHubActivity().catch(console.error);
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
      stage_key: String(data.get("stage_key") || getCurrentStage().key),
      roadmap_task_keys: data.getAll("roadmap_task_keys").map(String),
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
    renderTaskChoices(getCurrentStage(), getShanghaiDateString());
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
    const backup = {
      exported_at: new Date().toISOString(),
      roadmap_stages: ROADMAP_STAGES,
      learning_tasks: state.tasks,
      progress_entries: state.records,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "小淇的学习路线与双周成长记录.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function setDefaultDates() {
    const end = getShanghaiDateString();
    const start = shiftDate(end, -13);
    $("periodStart").value = start;
    $("periodEnd").value = end;
    $("stageKey").value = getCurrentStage(end).key;
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
    $("fontScale").addEventListener("click", toggleFontScale);
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
    const handleTaskAction = async (event) => {
      const evidence = event.target.closest("button[data-evidence-task-key]");
      if (evidence) {
        openEvidenceDialog(evidence.dataset.evidenceTaskKey);
        return;
      }
      const status = event.target.closest("button[data-task-key]");
      if (!status || state.loading || state.taskLoadingKey) return;
      await updateTaskStatus(status.dataset.taskKey);
    };
    $("taskBoard").addEventListener("click", handleTaskAction);
    $("milestoneList").addEventListener("click", handleTaskAction);
    $("evidenceForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      await saveTaskEvidence(event.currentTarget);
    });
    $("evidenceClose").addEventListener("click", closeEvidenceDialog);
    $("evidenceCancel").addEventListener("click", closeEvidenceDialog);
    $("evidenceClear").addEventListener("click", clearTaskEvidence);
    $("evidenceDialog").addEventListener("click", (event) => {
      if (event.target === event.currentTarget) closeEvidenceDialog();
    });
    $("githubRefresh").addEventListener("click", () => loadGitHubActivity(true));
  }

  async function init() {
    bindEvents();
    applyFontScale(localStorage.getItem(FONT_SCALE_KEY) === "xl");
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

  window.QQQIBackend = {
    init,
    signIn,
    signUp,
    signOut,
    loadRecords,
    loadTasks,
    updateTaskStatus,
    loadGitHubActivity,
    migrateLocalRecords,
  };
  init().catch((error) => {
    console.error(error);
    setAuthMessage("云端服务初始化失败，请稍后重试。", "error");
  });
})();
