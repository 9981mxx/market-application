"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { apiBlob, backendApi } from "@/app/lib/api";

export type OperationsView = "报表统计" | "文件管理" | "权限审计" | "系统配置" | "数据备份";
export type AccountRole = "super_admin" | "market" | "franchise" | "agent";

type Props = { view: OperationsView; role: AccountRole; notify: (message: string) => void };
type Row = Record<string, unknown>;

const text = (value: unknown, fallback = "-") => value === null || value === undefined || value === "" ? fallback : String(value);
const money = (value: unknown) => `¥${(Number(value || 0) / 100).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`;
const dateTime = (value: unknown) => text(value).replace("T", " ").slice(0, 19);
const errorText = (error: unknown) => error instanceof Error ? error.message : "请求失败，请稍后重试";

function Heading({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return <div className="opsHeading"><div><small>{eyebrow}</small><h2>{title}</h2></div>{action}</div>;
}

function Loading({ error }: { error: string }) {
  return <div className={error ? "opsState error" : "opsState"}>{error || "正在读取数据..."}</div>;
}

export function BackendOperations({ view, role, notify }: Props) {
  if (view === "报表统计") return <ReportsPanel notify={notify}/>;
  if (view === "文件管理") return <FilesPanel notify={notify}/>;
  if (view === "系统配置") return <ConfigPanel writable={role === "super_admin"} notify={notify}/>;
  if (view === "数据备份") return <BackupsPanel writable={role === "super_admin"} notify={notify}/>;
  return <AuditPanel notify={notify}/>;
}

function ReportsPanel({ notify }: Pick<Props, "notify">) {
  const [overview, setOverview] = useState<Record<string, number> | null>(null);
  const [channels, setChannels] = useState<Row[]>([]);
  const [recharges, setRecharges] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setError("");
    try {
      const [summary, channelData, rechargeData] = await Promise.all([
        backendApi.reports.overview(), backendApi.reports.channels(), backendApi.reports.recharges(),
      ]);
      setOverview(summary);
      setChannels(channelData.channels);
      setRecharges(rechargeData.recharges);
    } catch (err) { setError(errorText(err)); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  if (!overview) return <Loading error={error}/>;
  const stats: [string, number | string, string][] = [
    ["可见渠道", overview.channelCount, "个"],
    ["所属用户", overview.userCount, "人"],
    ["已充值用户", overview.chargedUserCount, "人"],
    ["累计充值", money(overview.rechargeAmount), ""],
    ["待审批提现", money(overview.pendingWithdrawalAmount), `${overview.pendingWithdrawalCount} 笔`],
    ["已通过提现", money(overview.approvedWithdrawalAmount), `${overview.approvedWithdrawalCount} 笔`],
  ];
  return <div className="viewStack opsPage">
    <section className="opsBand"><div><small>REAL-TIME REPORT</small><h2>经营数据报表</h2><p>数据按当前账号的渠道权限范围实时汇总。</p></div><button onClick={() => void load()}>刷新数据</button></section>
    <section className="opsStats">{stats.map(([label, value, unit]) => <article key={label}><small>{label}</small><strong>{value}</strong><span>{unit}</span></article>)}</section>
    <section className="oaPanel"><Heading eyebrow="CHANNEL PERFORMANCE" title="渠道经营表现" action={<span>{channels.length} 个渠道</span>}/><div className="opsTable"><div className="opsRow opsHead"><b>名称</b><b>角色</b><b>用户数</b><b>已充值</b><b>充值金额</b><b>状态</b></div>{channels.map(row => <div className="opsRow" key={text(row.id)}><span>{text(row.name)}</span><span>{text(row.role)}</span><span>{text(row.user_count, "0")}</span><span>{text(row.charged_user_count, "0")}</span><span>{money(row.recharge_amount)}</span><span>{text(row.status)}</span></div>)}</div></section>
    <section className="oaPanel"><Heading eyebrow="RECHARGE DETAILS" title="用户充值明细" action={<span>{recharges.length} 条</span>}/><div className="opsTable"><div className="opsRow opsHead"><b>用户</b><b>所属渠道</b><b>邀请人</b><b>产品</b><b>充值金额</b><b>状态</b></div>{recharges.slice(0, 100).map(row => <div className="opsRow" key={text(row.id)}><span>{text(row.name)}</span><span>{text(row.channel_name)}</span><span>{text(row.inviter_name)}</span><span>{text(row.product)}</span><span>{money(row.recharge_amount)}</span><span>{Number(row.recharge_amount) > 0 ? "已充值" : "未充值"}</span></div>)}</div></section>
    {error && <Loading error={error}/>}<button className="opsQuiet" onClick={() => notify("报表数据来自本地数据库，并受当前账号权限范围限制")}>数据范围说明</button>
  </div>;
}

function FilesPanel({ notify }: Pick<Props, "notify">) {
  const [files, setFiles] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { setError(""); setFiles((await backendApi.files.list()).files); } catch (err) { setError(errorText(err)); } }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try { await backendApi.files.upload(file); await load(); notify("文件上传成功"); } catch (err) { notify(errorText(err)); } finally { setBusy(false); }
  };
  const remove = async (id: string) => { try { await backendApi.files.remove(id); await load(); notify("文件已删除"); } catch (err) { notify(errorText(err)); } };
  const download = async (row: Row) => {
    try {
      const blob = await apiBlob(`/api/files/${text(row.id)}`);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = text(row.original_name, "download");
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) { notify(errorText(err)); }
  };
  return <div className="viewStack opsPage"><section className="opsBand"><div><small>FILE ASSETS</small><h2>文件管理</h2><p>上传并管理当前权限范围内的业务附件，单个文件不超过 5 MB。</p></div><label className="opsUpload">{busy ? "正在上传" : "上传文件"}<input type="file" disabled={busy} onChange={event => void upload(event.target.files?.[0])}/></label></section>
    <section className="oaPanel"><Heading eyebrow="FILE LIBRARY" title="文件资料库" action={<span>{files.length} 个文件</span>}/>{error ? <Loading error={error}/> : files.length === 0 ? <div className="opsState">暂无文件</div> : <div className="opsFileList">{files.map(row => <article key={text(row.id)}><div><strong>{text(row.original_name)}</strong><span>{text(row.mime_type)} · {(Number(row.size || 0) / 1024).toFixed(1)} KB</span><small>{dateTime(row.created_at)}</small></div><div><button onClick={() => void download(row)}>下载</button><button className="danger" onClick={() => void remove(text(row.id))}>删除</button></div></article>)}</div>}</section>
  </div>;
}

function AuditPanel({ notify }: Pick<Props, "notify">) {
  const [logs, setLogs] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const load = useCallback(async () => { try { setError(""); setLogs((await backendApi.auditLogs()).logs); } catch (err) { setError(errorText(err)); } }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  return <div className="viewStack opsPage"><section className="opsBand"><div><small>RBAC + AUDIT</small><h2>权限与操作日志</h2><p>查看当前管理范围内的重要操作，保留可追溯记录。</p></div><button onClick={() => void load()}>刷新日志</button></section><section className="oaPanel"><Heading eyebrow="AUDIT LOG" title="最近操作记录" action={<span>{logs.length} 条</span>}/>{error ? <Loading error={error}/> : <div className="opsTable"><div className="opsRow opsHead audit"><b>时间</b><b>操作人</b><b>动作</b><b>对象</b><b>对象编号</b></div>{logs.map(row => <button className="opsRow audit" key={text(row.id)} onClick={() => notify(text(row.detail, "该记录没有附加详情"))}><span>{dateTime(row.created_at)}</span><span>{text(row.actor_name, text(row.actor_username))}</span><span>{text(row.action)}</span><span>{text(row.target_type)}</span><span>{text(row.target_id)}</span></button>)}</div>}</section></div>;
}

function ConfigPanel({ writable, notify }: Pick<Props, "notify"> & { writable: boolean }) {
  const [configs, setConfigs] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [description, setDescription] = useState("");
  const load = useCallback(async () => { try { setError(""); setConfigs((await backendApi.config.list()).configs); } catch (err) { setError(errorText(err)); } }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  const save = async () => { if (!key.trim()) return notify("请输入配置键"); try { await backendApi.config.save([{ key: key.trim(), value, description }]); setKey(""); setValue(""); setDescription(""); await load(); notify("系统配置已保存"); } catch (err) { notify(errorText(err)); } };
  return <div className="viewStack opsPage"><section className="opsBand"><div><small>SYSTEM CONFIG</small><h2>系统配置</h2><p>{writable ? "管理平台运行参数，修改操作会写入审计日志。" : "当前角色仅可查看系统配置。"}</p></div></section>{writable && <section className="oaPanel opsForm"><Heading eyebrow="NEW OR UPDATE" title="新增或更新配置"/><div><label>配置键<input value={key} onChange={e => setKey(e.target.value)} placeholder="例如 settlement.review_required"/></label><label>配置值<input value={value} onChange={e => setValue(e.target.value)} placeholder="请输入配置值"/></label><label>说明<input value={description} onChange={e => setDescription(e.target.value)} placeholder="配置用途说明"/></label><button onClick={() => void save()}>保存配置</button></div></section>}<section className="oaPanel"><Heading eyebrow="CONFIG LIST" title="配置清单" action={<span>{configs.length} 项</span>}/>{error ? <Loading error={error}/> : <div className="opsTable"><div className="opsRow opsHead config"><b>配置键</b><b>值</b><b>类型</b><b>说明</b><b>更新时间</b></div>{configs.map(row => <div className="opsRow config" key={text(row.config_key)}><span>{text(row.config_key)}</span><span>{typeof row.value === "object" ? JSON.stringify(row.value) : text(row.value)}</span><span>{text(row.value_type)}</span><span>{text(row.description)}</span><span>{dateTime(row.updated_at)}</span></div>)}</div>}</section></div>;
}

function BackupsPanel({ writable, notify }: Pick<Props, "notify"> & { writable: boolean }) {
  const [backups, setBackups] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { setError(""); setBackups((await backendApi.backups.list()).backups); } catch (err) { setError(errorText(err)); } }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  const create = async () => { setBusy(true); try { await backendApi.backups.create(); await load(); notify("本地数据快照已创建"); } catch (err) { notify(errorText(err)); } finally { setBusy(false); } };
  return <div className="viewStack opsPage"><section className="opsBand"><div><small>DATA SNAPSHOT</small><h2>数据备份</h2><p>创建本地业务数据快照，仅保存在当前开发数据库，不连接服务器或云数据库。</p></div>{writable && <button disabled={busy} onClick={() => void create()}>{busy ? "正在创建" : "创建快照"}</button>}</section><section className="oaPanel"><Heading eyebrow="BACKUP HISTORY" title="备份历史" action={<span>{backups.length} 条</span>}/>{error ? <Loading error={error}/> : <div className="opsTable"><div className="opsRow opsHead backup"><b>备份编号</b><b>状态</b><b>数据表</b><b>记录数</b><b>完成时间</b></div>{backups.map(row => <div className="opsRow backup" key={text(row.id)}><span>{text(row.id)}</span><span>{text(row.status)}</span><span>{text(row.table_count, "0")}</span><span>{text(row.record_count, "0")}</span><span>{dateTime(row.completed_at)}</span></div>)}</div>}</section></div>;
}
