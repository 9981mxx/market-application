"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BrandSignature } from "@/app/components/BrandSignature";

type InvitationInfo = {
  code: string;
  targetRole: "market" | "franchise" | "agent" | "user";
  targetRoleLabel: string;
  inviterName: string;
  available: boolean;
};

export default function RegisterPage() {
  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [region, setRegion] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ roleLabel: string; code: string } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const code = new URLSearchParams(window.location.search).get("invite")?.trim() ?? "";
      setInviteCode(code);
      if (!code) {
        setError("邀请链接缺少邀请码");
        setLoading(false);
        return;
      }
      fetch(`/api/public/invitations/${encodeURIComponent(code)}`)
        .then(async (response) => {
          const data = await response.json() as { invitation?: InvitationInfo; error?: string };
          if (!response.ok || !data.invitation) throw new Error(data.error || "邀请信息读取失败");
          setInvitation(data.invitation);
          if (!data.invitation.available) setError("该邀请已经失效或达到使用上限");
        })
        .catch((reason) => setError(reason instanceof Error ? reason.message : "邀请信息读取失败"))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!invitation?.available) return;
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch("/api/public/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode, name, phone, email, username, password, region }),
      });
      const data = await response.json() as { error?: string; roleLabel?: string; code?: string };
      if (!response.ok) throw new Error(data.error || "登记失败");
      setSuccess({ roleLabel: data.roleLabel || invitation.targetRoleLabel, code: data.code || "" });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "登记失败");
    } finally {
      setSubmitting(false);
    }
  };

  const managementAccount = invitation?.targetRole !== "user";

  return <main className="registerPage">
    <section className="registerShell">
      <header className="registerBrand">
        <BrandSignature subtitle="AI 短剧教育 OA" />
      </header>
      {loading ? <div className="registerState">正在验证邀请信息...</div> : success ? <div className="registerSuccess">
        <span>登记完成</span>
        <h1>{success.roleLabel}注册成功</h1>
        <p>系统编号：{success.code}</p>
        {managementAccount && <p>现在可以返回管理系统，使用刚刚设置的账号和密码登录。</p>}
        <Link href="/">返回登录页面</Link>
      </div> : <>
        <div className="registerHeading">
          <span>INVITATION REGISTRATION</span>
          <h1>邀请登记</h1>
          {invitation && <p>由「{invitation.inviterName}」邀请注册为 {invitation.targetRoleLabel}</p>}
        </div>
        <form className="registerForm" onSubmit={submit}>
          <label>名称<input value={name} onChange={(event) => setName(event.target.value)} placeholder={managementAccount ? "渠道或负责人名称" : "用户姓名"} required /></label>
          <label>手机号<input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="请输入真实手机号" required /></label>
          <label>邮箱（选填）<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" /></label>
          {managementAccount && <>
            <label>登录用户名<input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="用于登录管理端" required /></label>
            <label>登录密码<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 8 位" minLength={8} required /></label>
            <label>负责区域（选填）<input value={region} onChange={(event) => setRegion(event.target.value)} placeholder="例如：上海 / 浙江" /></label>
          </>}
          {error && <div className="registerError">{error}</div>}
          <button type="submit" disabled={!invitation?.available || submitting}>{submitting ? "正在提交..." : `登记为${invitation?.targetRoleLabel ?? "受邀账号"}`}</button>
        </form>
      </>}
    </section>
  </main>;
}
