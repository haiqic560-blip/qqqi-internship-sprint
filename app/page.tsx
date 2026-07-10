"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Status = "已完成" | "进行中";
type RecordItem = {
  id: string;
  period: string;
  work: string;
  link: string;
  review: string;
  status: Status;
  createdAt: string;
};

const STORAGE_KEY = "qqqi-growth-records-v1";
const starterRecords: RecordItem[] = [
  {
    id: "welcome",
    period: "起点 · 暑假准备期",
    work: "确定实习方向，整理目标岗位需要的能力清单",
    link: "",
    review: "先行动，再在每一次双周复盘里修正方向。",
    status: "已完成",
    createdAt: "成长起点",
  },
];

export default function Home() {
  const [records, setRecords] = useState<RecordItem[]>(starterRecords);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setRecords(JSON.parse(saved));
      } catch {
        setRecords(starterRecords);
      }
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, [records, ready]);

  const completed = records.filter((item) => item.status === "已完成").length;
  const progress = records.length ? Math.round((completed / records.length) * 100) : 0;
  const latest = useMemo(() => records.slice().reverse(), [records]);

  function submitRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const next: RecordItem = {
      id: crypto.randomUUID(),
      period: String(data.get("period") || "本期双周总结"),
      work: String(data.get("work") || ""),
      link: String(data.get("link") || ""),
      review: String(data.get("review") || ""),
      status: String(data.get("status")) as Status,
      createdAt: new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(new Date()),
    };
    setRecords((items) => [...items, next]);
    form.reset();
    setNotice("本期成果已归档，继续冲刺！");
    window.setTimeout(() => setNotice(""), 3200);
  }

  function toggleStatus(id: string) {
    setRecords((items) => items.map((item) => item.id === id ? { ...item, status: item.status === "已完成" ? "进行中" : "已完成" } : item));
  }

  function deleteRecord(id: string) {
    setRecords((items) => items.filter((item) => item.id !== id));
  }

  function exportRecords() {
    const blob = new Blob([JSON.stringify(records, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "小淇的双周成长记录.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main>
      <div className="energy energy-one" />
      <div className="energy energy-two" />

      <nav className="nav" aria-label="主导航">
        <a className="brand" href="#top"><span>Q</span> QQ淇成长站</a>
        <div className="nav-links">
          <a href="#dashboard">成长总览</a>
          <a href="#submit">提交成果</a>
          <a href="#records">双周记录</a>
        </div>
        <button className="ghost-button" onClick={exportRecords}>导出记录</button>
      </nav>

      <section className="hero" id="top">
        <div>
          <p className="eyebrow"><span /> LONG-TERM INTERNSHIP SPRINT</p>
          <h1>QQ淇的大二<br /><em>实习逆袭之路</em></h1>
          <p className="hero-copy">从大一暑假到大二寒假，每两周认真交付一次。把工作变成成果，把经历变成能力。</p>
          <a className="primary-button" href="#submit">提交本期总结 <b>→</b></a>
        </div>
        <div className="hero-orbit" aria-label={`当前完成率 ${progress}%`}>
          <div className="orbit-ring" style={{ "--progress": `${progress * 3.6}deg` } as React.CSSProperties}>
            <div><strong>{progress}%</strong><span>当前完成率</span></div>
          </div>
          <span className="orbit-label label-top">两周一交付</span>
          <span className="orbit-label label-bottom">持续复盘中</span>
        </div>
      </section>

      <section className="stats" id="dashboard">
        <article><span>累计提交</span><strong>{records.length}</strong><small>份双周总结</small></article>
        <article><span>已完成</span><strong>{completed}</strong><small>个阶段成果</small></article>
        <article><span>当前节奏</span><strong>14</strong><small>天 / 次交付</small></article>
        <article className="next-card"><span className="pulse" /> <div><span>下一步</span><b>记录真实进展，不等待完美</b></div></article>
      </section>

      <section className="workspace">
        <article className="panel form-panel" id="submit">
          <div className="section-heading">
            <div><p>BIWEEKLY DELIVERY</p><h2>提交本期成果</h2></div>
            <span className="step-badge">每 14 天</span>
          </div>
          <form onSubmit={submitRecord}>
            <label>本期标题<input name="period" required placeholder="例：第 03 期 · 完成项目首版" /></label>
            <label>工作记录<textarea name="work" required rows={4} placeholder="这两周做了什么？遇到了哪些具体问题？" /></label>
            <label>成果链接<input name="link" type="url" placeholder="https://…（可选）" /></label>
            <label>复盘总结<textarea name="review" required rows={4} placeholder="哪些做得好？下两周要改变什么？" /></label>
            <fieldset>
              <legend>完成状态</legend>
              <label className="radio"><input type="radio" name="status" value="进行中" defaultChecked /> 进行中</label>
              <label className="radio"><input type="radio" name="status" value="已完成" /> 已完成</label>
            </fieldset>
            <button className="submit-button" type="submit">保存本期成果 <span>↗</span></button>
            <p className="storage-note">记录仅保存在当前浏览器，请定期导出备份。</p>
          </form>
        </article>

        <article className="panel records-panel" id="records">
          <div className="section-heading">
            <div><p>GROWTH TIMELINE</p><h2>双周成长足迹</h2></div>
            <span className="count-badge">{records.length} 条</span>
          </div>
          <div className="timeline">
            {latest.map((item) => (
              <div className="record" key={item.id}>
                <span className={`node ${item.status === "已完成" ? "done" : "active"}`} />
                <div className="record-content">
                  <div className="record-top"><small>{item.createdAt}</small><button className={`status ${item.status === "已完成" ? "done" : "active"}`} onClick={() => toggleStatus(item.id)}>{item.status}</button></div>
                  <h3>{item.period}</h3>
                  <p>{item.work}</p>
                  <details><summary>查看复盘</summary><p>{item.review}</p></details>
                  <div className="record-actions">
                    {item.link && <a href={item.link} target="_blank" rel="noreferrer">查看成果 ↗</a>}
                    <button onClick={() => deleteRecord(item.id)}>删除</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <footer><span>QQ淇成长站</span><p>每两周，向更好的自己交付一次成果。</p><a href="#top">回到顶部 ↑</a></footer>
      {notice && <div className="toast" role="status">✓ {notice}</div>}
    </main>
  );
}
