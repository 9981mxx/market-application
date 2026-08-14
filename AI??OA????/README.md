# 数影豹驱 · AI 短剧 OA 管理系统

面向超级管理员、市场端、加盟端和代理端的本地 OA 管理系统。当前后端已实现账号认证、角色权限、渠道管理、用户管理和邀请二维码五个基础模块。

## 本地运行

需要 Node.js 22 或更高版本。

```powershell
npm install
npm run dev -- --port 3001
```

打开 `http://localhost:3001/`。

## 数据库

应用运行时使用 Cloudflare D1。本项目同时提供本地 MySQL 数据镜像工具，用于把当前 D1 的角色、权限、账号、会话、渠道、用户、邀请、绑定和审计记录同步到独立数据库。

```powershell
Copy-Item .env.example .env.local
# 在 .env.local 中填写本机数据库连接信息
npm run db:mysql:import
```

真实密码只能保存在被 Git 忽略的 `.env.local` 中。

## 校验

```powershell
npm run typecheck
npm run lint
npm run build
npm test
```

业务说明见仓库根目录 `项目文档.md`，架构、部署、命令和问题记录见 `技术文档.md`。