"use client";
import { useEffect, useState } from "react";

import { apiBlob, apiRequest, backendApi } from "@/app/lib/api";
import { BackendOperations, type OperationsView } from "@/app/components/backend/BackendOperations";
import { BrandSignature } from "@/app/components/BrandSignature";

type Portal="超级管理员"|"市场端"|"加盟端"|"代理端";
type View="经营总览"|"渠道生态"|"用户中心"|"产品定价"|"订单承制"|"钱包结算"|"佣金比例调整"|"审批中心"|"邀请管理"|"权限审计"|"消息通知"|"报表统计"|"文件管理"|"系统配置";
type Approval={id:string;title:string;applicant:string;time:string;status:"待审批"|"已通过"|"已驳回"};
type Payout=string[];
type CommRate={id:string;name:string;role:"加盟端"|"代理端";mem:string;course:string;boutique:string};
type Product={id:string;name:string;type:string;price:string;commission:string;scope:string;status:string;pushStatus:"draft"|"pending"|"approved"};
type Order={id:string;name:string;bizType:string;channel:string;amount:string;status:string;deadline:string;pushStatus:"draft"|"pending"|"approved"};
type UserRecord={id:string;name:string;phone:string;email:string;invitedBy:string;invitorRole:"加盟端"|"代理端"|"市场端"|"超级管理员";tag:string;level:string;recharged:number;hasCharged:boolean;product:string;joinDate:string;note:string};
type ChannelPartner={id:string;name:string;role:string;region:string;users:string;revenue:string;target:string;status:string;contact:string;joinDate:string;accountId?:string;username?:string;phone?:string;password?:string;apiRole?:string;contactName?:string};
type Msg={id:string;title:string;body:string;from:string;time:string;read:boolean;type:"approval"|"system"|"commission"|"invite";forPortals:Portal[]};
type BackendAccount={id:string;username:string;phone:string|null;displayName:string;role:"super_admin"|"market"|"franchise"|"agent";roleLabel:string;status:string;channelId:string|null};
const portalFromRole=(role:BackendAccount["role"]):Portal=>role==="super_admin"?"超级管理员":role==="market"?"市场端":role==="franchise"?"加盟端":"代理端";
const roleFromChannel=(role:string)=>role==="market"?"A·市场端":role==="franchise"?"B·加盟商":"C·分销方";
const statusFromChannel=(status:string)=>status==="active"?"正常":status==="suspended"?"暂停":"观察";
const statusToChannel=(status:string)=>status==="正常"?"active":status==="暂停"?"suspended":"observing";

const portalNav:Record<Portal,View[]>={
  "超级管理员":["经营总览","渠道生态","用户中心","产品定价","订单承制","钱包结算","佣金比例调整","审批中心","邀请管理","报表统计","文件管理","权限审计","系统配置","消息通知"],
  "市场端":["经营总览","渠道生态","用户中心","产品定价","订单承制","钱包结算","佣金比例调整","审批中心","邀请管理","报表统计","文件管理","权限审计","系统配置","消息通知"],
  "加盟端":["经营总览","渠道生态","用户中心","产品定价","钱包结算","佣金比例调整","邀请管理","报表统计","文件管理","消息通知"],
  "代理端":["经营总览","用户中心","产品定价","钱包结算","邀请管理","报表统计","文件管理","消息通知"],
};
const navIcons:Record<View,string>={"经营总览":"◫","渠道生态":"⌘","用户中心":"◎","产品定价":"◇","订单承制":"▦","钱包结算":"¥","佣金比例调整":"％","审批中心":"✓","邀请管理":"⌗","权限审计":"⌁","消息通知":"◉","报表统计":"▥","文件管理":"▤","系统配置":"⚙"};
const portalTitle:Record<Portal,string>={"超级管理员":"集团经营总览","市场端":"市场运营驾驶舱","加盟端":"华东区域经营中心","代理端":"我的代理工作台"};
const portalAccount:Record<Portal,string>={"超级管理员":"官方总部","市场端":"市场端·李珊","加盟端":"华东加盟中心","代理端":"星河创作社"};
const inviteTargets:Record<Portal,string[]>={"超级管理员":["市场端","加盟端","代理端","用户"],"市场端":["加盟端","代理端","用户"],"加盟端":["代理端","用户"],"代理端":["用户"]};

const initPartners:ChannelPartner[]=[
  {id:"B-001",name:"华东加盟中心",role:"B·加盟商",region:"上海/浙江",users:"2,846",revenue:"¥186,420",target:"91%",status:"正常",contact:"张经理 138****2000",joinDate:"2026-01-08"},
  {id:"B-002",name:"华南加盟中心",role:"B·加盟商",region:"广东/福建",users:"2,125",revenue:"¥142,680",target:"78%",status:"正常",contact:"陈总 139****3300",joinDate:"2026-02-14"},
  {id:"C-001",name:"川渝课程分销",role:"C·分销方",region:"四川/重庆",users:"968",revenue:"¥52,300",target:"65%",status:"观察",contact:"李总 186****4400",joinDate:"2026-03-20"},
  {id:"C-002",name:"北方创作联盟",role:"C·分销方",region:"北京/河北",users:"782",revenue:"¥41,850",target:"58%",status:"正常",contact:"王总 177****5500",joinDate:"2026-04-01"},
];
const initProducts:Product[]=[
  {id:"P-001",name:"成长会员",type:"会员订阅",price:"¥49.90/月",commission:"20%",scope:"全国统一",status:"上架",pushStatus:"approved"},
  {id:"P-002",name:"AI短剧进阶课",type:"收费网课",price:"¥699.00",commission:"50%",scope:"全国统一",status:"上架",pushStatus:"approved"},
  {id:"P-003",name:"名师精品实训营",type:"精品课线下",price:"¥2,980.00",commission:"60%",scope:"全国统一",status:"招生中",pushStatus:"approved"},
  {id:"P-004",name:"平台算力10万积分",type:"算力充值",price:"¥900.00",commission:"9折",scope:"全国统一",status:"上架",pushStatus:"approved"},
];
const initOrders:Order[]=[
  {id:"OD260729018",name:"都市逆袭·第1—10集",bizType:"AI漫剧承制",channel:"华东加盟中心",amount:"¥18,000",status:"制作中",deadline:"08-08",pushStatus:"approved"},
  {id:"OD260728103",name:"古风甜宠角色资产",bizType:"角色资产",channel:"自然客户",amount:"¥3,200",status:"待验收",deadline:"08-02",pushStatus:"approved"},
  {id:"OD260727066",name:"精品实训营·上海站",bizType:"精品课程",channel:"华东加盟中心",amount:"¥89,400",status:"已回款",deadline:"07-27",pushStatus:"approved"},
  {id:"OD260726031",name:"悬疑短剧整剧制作",bizType:"AI短剧承制",channel:"华南加盟中心",amount:"¥86,000",status:"合同中",deadline:"08-18",pushStatus:"approved"},
];
const initUsers:UserRecord[]=[
  {id:"U109",name:"林晚",phone:"138****2056",email:"linwan@example.com",invitedBy:"市场端·李珊",invitorRole:"市场端",tag:"成长会员",level:"C",recharged:349.9,hasCharged:true,product:"会员订阅",joinDate:"2026-07-28",note:""},
  {id:"U108",name:"沈屿",phone:"186****7721",email:"shenyu@example.com",invitedBy:"代理端·星河创作社",invitorRole:"代理端",tag:"普通用户",level:"D",recharged:0,hasCharged:false,product:"—",joinDate:"2026-07-28",note:""},
  {id:"U102",name:"顾青",phone:"159****3386",email:"guqing@example.com",invitedBy:"加盟端·华东加盟中心",invitorRole:"加盟端",tag:"精品课学员",level:"B",recharged:2980,hasCharged:true,product:"精品课线下",joinDate:"2026-07-27",note:"VIP客户"},
  {id:"U087",name:"周野",phone:"133****9142",email:"zhouye@example.com",invitedBy:"超级管理员",invitorRole:"超级管理员",tag:"成长会员",level:"C",recharged:149.7,hasCharged:true,product:"会员订阅",joinDate:"2026-07-26",note:""},
  {id:"U071",name:"苏离",phone:"150****8830",email:"suli@example.com",invitedBy:"代理端·星河创作社",invitorRole:"代理端",tag:"会员用户",level:"C",recharged:499,hasCharged:true,product:"会员订阅",joinDate:"2026-07-25",note:""},
  {id:"U055",name:"陆一鸣",phone:"137****4412",email:"luyiming@example.com",invitedBy:"加盟端·华东加盟中心",invitorRole:"加盟端",tag:"普通用户",level:"D",recharged:0,hasCharged:false,product:"—",joinDate:"2026-07-24",note:""},
  {id:"U048",name:"江晴",phone:"139****6651",email:"jiangqing@example.com",invitedBy:"代理端·星河创作社",invitorRole:"代理端",tag:"收费课学员",level:"C",recharged:699,hasCharged:true,product:"收费网课",joinDate:"2026-07-30",note:""},
  {id:"U033",name:"白鹿鸣",phone:"177****2298",email:"bailuming@example.com",invitedBy:"加盟端·华东加盟中心",invitorRole:"加盟端",tag:"成长会员",level:"C",recharged:49.9,hasCharged:true,product:"会员订阅",joinDate:"2026-07-22",note:""},
];
const initCommRates:CommRate[]=[
  {id:"B-001",name:"华东加盟中心",role:"加盟端",mem:"20%",course:"50%",boutique:"60%"},
  {id:"B-002",name:"华南加盟中心",role:"加盟端",mem:"20%",course:"50%",boutique:"60%"},
  {id:"C-001",name:"星河创作社",role:"代理端",mem:"18%",course:"45%",boutique:"55%"},
  {id:"C-002",name:"杭州星创社",role:"代理端",mem:"18%",course:"45%",boutique:"55%"},
  {id:"C-003",name:"北方创作联盟",role:"代理端",mem:"15%",course:"40%",boutique:"50%"},
];
const myInvites:Record<Portal,string[][]>={
  "超级管理员":[["李珊","市场端","2026-06-28","已激活"],["华东加盟中心","加盟端","2026-07-02","已激活"],["周野","用户","2026-07-26","已绑定"]],
  "市场端":[["华东加盟中心","加盟端","2026-07-02","已激活"],["星河创作社","代理端","2026-07-10","已激活"],["林晚","用户","2026-07-28","已绑定"]],
  "加盟端":[["星河创作社","代理端","2026-07-10","已激活"],["顾青","用户","2026-07-27","已绑定"],["陆一鸣","用户","2026-07-24","已绑定"]],
  "代理端":[["沈屿","用户","2026-07-28","已绑定"],["苏离","用户","2026-07-25","已绑定"],["江晴","用户","2026-07-30","已绑定"]],
};
const initMsgs:Msg[]=[
  {id:"M001",title:"提现申请已通过",body:"您提交的 ¥3,600 提现申请已由超级管理员审批通过，请注意查收到账通知。",from:"超级管理员",time:"08-06 18:32",read:false,type:"approval",forPortals:["代理端","加盟端"]},
  {id:"M002",title:"佣金比例已调整",body:"您的收费课程分佣比例已由市场端·李珊调整为 48%，即时生效。",from:"市场端·李珊",time:"08-05 17:46",read:false,type:"commission",forPortals:["代理端"]},
  {id:"M003",title:"有新的提现申请",body:"华南加盟中心申请提现 ¥28,600，请前往审批中心处理。",from:"系统",time:"08-06 09:40",read:false,type:"approval",forPortals:["超级管理员","市场端"]},
  {id:"M004",title:"有新的提现申请",body:"星河创作社申请提现 ¥3,600，请前往审批中心处理。",from:"系统",time:"08-05 18:26",read:true,type:"approval",forPortals:["超级管理员","市场端"]},
  {id:"M005",title:"产品推送已提交",body:"AI短剧进阶课定价信息已提交至官网，等待官网确认上线。",from:"系统",time:"08-04 14:10",read:true,type:"system",forPortals:["超级管理员","市场端"]},
  {id:"M006",title:"新用户邀请成功",body:"用户 林晚 通过您的邀请二维码完成注册并永久绑定。",from:"系统",time:"08-04 11:22",read:true,type:"invite",forPortals:["市场端"]},
  {id:"M007",title:"新用户邀请成功",body:"用户 顾青 通过您的邀请二维码完成注册并永久绑定。",from:"系统",time:"08-04 10:08",read:true,type:"invite",forPortals:["加盟端"]},
  {id:"M008",title:"佣金已收到",body:"超级管理员向您分发佣金 ¥12,600，已到账钱包余额。",from:"超级管理员",time:"08-06 16:20",read:false,type:"commission",forPortals:["加盟端"]},
];

// ── Login ──────────────────────────────────────────────────────────────────
function LoginPage({onLogin}:{onLogin:(account:BackendAccount)=>void}) {
  const [role,setRole]=useState<Portal>("超级管理员");
  const [username,setUsername]=useState("");
  const [password,setPassword]=useState("");
  const [err,setErr]=useState("");
  const [loading,setLoading]=useState(false);
  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();
    if(!username.trim()){setErr("请输入用户名或手机号");return;}
    if(!password.trim()){setErr("请输入密码");return;}
    setErr("");setLoading(true);
    try{
      const data=await apiRequest<{account:BackendAccount}>("/api/auth/login",{method:"POST",body:{identifier:username,password,role}});
      onLogin(data.account);
    }catch(error){setErr(error instanceof Error?error.message:"登录失败，请稍后重试");}
    finally{setLoading(false);}
  };
  return (
    <main className="loginPage">
      <div className="loginBg"><i/><i/><i/></div>
      <div className="loginCard">
        <div className="loginLogo">
          <BrandSignature />
        </div>
        <div className="loginHead"><h1>登记</h1><p>数影豹驱 · AI 短剧教育 OA 管理系统</p></div>
        <form onSubmit={submit} className="loginForm">
          <div className="loginField"><label>角色选择</label><div className="loginSelect"><select value={role} onChange={e=>setRole(e.target.value as Portal)}><option>超级管理员</option><option>市场端</option><option>加盟端</option><option>代理端</option></select><span className={`roleBadge rb-${role.slice(0,1)}`}>{role==="超级管理员"?"SUPER":role==="市场端"?"A":role==="加盟端"?"B":"C"}</span></div></div>
          <div className="loginField"><label>用户名 / 手机号</label><input className="loginInput" placeholder="请输入用户名或手机号" value={username} onChange={e=>{setUsername(e.target.value);setErr("");}}/></div>
          <div className="loginField"><label>密码</label><input className="loginInput" type="password" placeholder="请输入密码" value={password} onChange={e=>{setPassword(e.target.value);setErr("");}}/></div>
          {err&&<div className="loginErr">{err}</div>}
          <button className={`loginBtn${loading?" loading":""}`} type="submit">{loading?<span className="loginSpinner"/>:"登 录"}</button>
        </form>
        <div className="loginDemo"><span>本地演示账号</span>admin / Admin@123456 · market / Market@123456 · franchise / Franchise@123456 · agent / Agent@123456</div>
      </div>
    </main>
  );
}
// ── Root ──────────────────────────────────────────────────────────────────
export default function Home() {
  const [portal,setPortal]=useState<Portal|null>(null);
  const [account,setAccount]=useState<BackendAccount|null>(null);
  const [view,setView]=useState<View>("经营总览");
  const [toast,setToast]=useState("");
  const [approvals,setApprovals]=useState<Approval[]>([]);
  const [payouts,setPayouts]=useState<Payout[]>([
    ["PY26080602","华东加盟中心（加盟端）","¥12,600","超级管理员","08-06"],
    ["PY26080601","星河创作社（代理端）","¥3,200","市场端·李珊","08-05"],
  ]);
  const [commRates,setCommRates]=useState<CommRate[]>(initCommRates);
  const [rateLog,setRateLog]=useState<string[][]>([["RL26080601","星河创作社","收费课程","45%→48%","超级管理员","08-05"]]);
  const [products,setProducts]=useState<Product[]>(initProducts);
  const [orders,setOrders]=useState<Order[]>(initOrders);
  const [users,setUsers]=useState<UserRecord[]>(initUsers);
  const [partners,setPartners]=useState<ChannelPartner[]>(initPartners);
  const [msgs,setMsgs]=useState<Msg[]>([]);
  const [loggingOut,setLoggingOut]=useState(false);

  const notify=(msg:string)=>{setToast(msg);window.setTimeout(()=>setToast(""),2600);};
  const notificationText=(row:Record<string,unknown>)=>{
    const type=String(row.type??"system");
    const labels:Record<string,[string,string]>={withdrawal_submitted:["新的提现申请","有渠道提交了新的提现申请，请前往审批中心处理。"],withdrawal_approved:["提现申请已通过","您的提现申请已通过审核。"],withdrawal_rejected:["提现申请已驳回","您的提现申请未通过审核，请查看审批意见。"]};
    return labels[type]??[String(row.title??"系统通知"),String(row.content??"")];
  };
  const loadBackendData=async(authAccount:BackendAccount)=>{
    try{
      const isManager=authAccount.role==="super_admin"||authAccount.role==="market";
      const [channelData,userData,notificationData,approvalGroups]=await Promise.all([
        authAccount.role==="agent"?Promise.resolve({channels:[]}):apiRequest<{channels?:Record<string,unknown>[]}>("/api/channels"),
        apiRequest<{users?:Record<string,unknown>[]}>("/api/users"),
        backendApi.notifications.list(),
        isManager?Promise.all(["pending","approved","rejected"].map(status=>backendApi.approvals.list(status))):Promise.resolve([]),
      ]);
      setPartners((channelData.channels??[]).map(row=>({
        id:String(row.id),accountId:String(row.account_id??""),name:String(row.name??""),role:roleFromChannel(String(row.role??"agent")),apiRole:String(row.role??"agent"),region:String(row.region??""),users:Number(row.user_count??0).toLocaleString(),revenue:`¥${(Number(row.recharge_amount??0)/100).toLocaleString()}`,target:`${Number(row.target_rate??0)}%`,status:statusFromChannel(String(row.status??"active")),contact:`${String(row.contact_name??"")} ${String(row.contact_phone??"")}`.trim(),contactName:String(row.contact_name??""),joinDate:String(row.created_at??"").slice(0,10),username:String(row.username??""),phone:String(row.login_phone??"")
      })));
      setUsers((userData.users??[]).map(row=>({
        id:String(row.id),name:String(row.name??""),phone:String(row.phone??""),email:String(row.email??""),invitedBy:String(row.invited_by_name??"系统登记"),invitorRole:portalFromRole(String(row.inviter_role??"agent") as BackendAccount["role"]),tag:String(row.tag??"新用户"),level:String(row.level??"普通用户"),recharged:Number(row.recharge_amount??0)/100,hasCharged:Number(row.recharge_amount??0)>0,product:String(row.product??"未购买"),joinDate:String(row.created_at??"").slice(0,10),note:String(row.note??"")
      })));
      const currentPortal=portalFromRole(authAccount.role);
      setMsgs((notificationData.notifications??[]).map(row=>{
        const [title,body]=notificationText(row);
        const rawType=String(row.type??"system");
        const type:Msg["type"]=rawType.includes("withdrawal")?"approval":rawType.includes("commission")?"commission":rawType.includes("invite")?"invite":"system";
        return {id:String(row.id),title,body,from:"系统",time:String(row.created_at??"").replace("T"," ").slice(0,16),read:Boolean(row.is_read),type,forPortals:[currentPortal]};
      }));
      const rows=approvalGroups.flatMap(group=>group.approvals??[]);
      setApprovals(rows.map(row=>{
        const raw=String(row.status??"pending");
        const status:Approval["status"]=raw==="approved"?"已通过":raw==="rejected"?"已驳回":"待审批";
        const applicant=String(row.channel_name??row.display_name??row.username??"未知账户");
        return {id:String(row.id),title:`${applicant}申请提现 ¥${(Number(row.amount??0)/100).toLocaleString()}`,applicant,time:String(row.created_at??"").replace("T"," ").slice(0,16),status};
      }));
    }catch(error){notify(error instanceof Error?error.message:"数据加载失败");}
  };
  const login=async(nextAccount:BackendAccount)=>{setAccount(nextAccount);setPortal(portalFromRole(nextAccount.role));setView("经营总览");await loadBackendData(nextAccount);};
  const logout=async()=>{
    if(loggingOut)return;
    setLoggingOut(true);
    try{
      await apiRequest<{success:true}>("/api/auth/logout",{method:"POST"});
    }catch{
      // Keep local sign-out available even when the session endpoint is temporarily unreachable.
    }finally{
      setAccount(null);setPortal(null);setApprovals([]);setMsgs([]);setPartners([]);setUsers([]);setView("经营总览");setLoggingOut(false);
    }
  };
  useEffect(()=>{let active=true;apiRequest<{account?:BackendAccount|null}>("/api/auth/me").then(async data=>{if(active&&data.account){setAccount(data.account);setPortal(portalFromRole(data.account.role));await loadBackendData(data.account);}}).catch(()=>{});return()=>{active=false;};},[]);
  const markRead=async(id:string)=>{try{await backendApi.notifications.read(id);setMsgs(list=>list.map(item=>item.id===id?{...item,read:true}:item));}catch(error){notify(error instanceof Error?error.message:"消息更新失败");}};
  const markAllRead=async()=>{try{await backendApi.notifications.readAll();setMsgs(list=>list.map(item=>({...item,read:true})));}catch(error){notify(error instanceof Error?error.message:"消息更新失败");}};

  const decide=async(id:string,status:"已通过"|"已驳回")=>{
    if(!account)return;
    try{
      await backendApi.approvals.decide(id,status==="已通过"?"approved":"rejected");
      await loadBackendData(account);
      notify(status==="已通过"?"已通过提现审批并写入操作日志":"提现申请已驳回");
    }catch(error){notify(error instanceof Error?error.message:"审批处理失败");}
  };
  const requestWithdraw=async(payload:{amount:string;method:string;accountName:string;accountNumber:string;remark:string})=>{
    if(!account)return;
    const amount=Math.round(Number(payload.amount)*100);
    if(!Number.isFinite(amount)||amount<=0){notify("请输入正确的提现金额");return;}
    try{
      await apiRequest<{withdrawal:{id:string}}>("/api/withdrawals",{method:"POST",body:{amount,method:payload.method,accountName:payload.accountName,accountNumber:payload.accountNumber,remark:payload.remark}});
      await loadBackendData(account);
      notify("提现申请已提交，等待审批");
    }catch(error){notify(error instanceof Error?error.message:"提现申请提交失败");}
  };  const distribute=(receiver:string,amount:string)=>{
    const id=`PY2608${String(10+payouts.length).padStart(4,"0")}`;
    setPayouts(l=>[[id,receiver,`¥${amount}`,portalAccount[portal!],"今天"],...l]);
    const target=receiver.includes("加盟端")?"加盟端":"代理端" as Portal;
    const newMsg:Msg={id:`M${Date.now()}`,title:"佣金已收到",body:`${portalAccount[portal!]}向您分发佣金 ¥${amount}，已到账钱包余额。`,from:portalAccount[portal!],time:"刚刚",read:false,type:"commission",forPortals:[target]};
    setMsgs(l=>[newMsg,...l]);
    notify(`已向${receiver}分发佣金 ¥${amount}`);
  };
  const updateRate=(targetId:string,field:keyof CommRate,val:string,label:string)=>{
    const prev=commRates.find(r=>r.id===targetId);
    if(!prev)return;
    const oldVal=prev[field] as string;
    setCommRates(l=>l.map(r=>r.id===targetId?{...r,[field]:val}:r));
    const logId=`RL2608${String(10+rateLog.length).padStart(4,"0")}`;
    setRateLog(l=>[[logId,prev.name,label,`${oldVal}→${val}`,portalAccount[portal!],"今天"],...l]);
    notify(`已将${prev.name}的${label}调整为${val}`);
  };
  const saveProduct=(p:Product)=>{
    setProducts(l=>l.some(x=>x.id===p.id)?l.map(x=>x.id===p.id?p:x):[...l,p]);
    notify("已保存，点击「推送官网」提交至官网审核");
  };
  const pushProduct=(id:string)=>{
    setProducts(l=>l.map(p=>p.id===id?{...p,pushStatus:"pending"}:p));
    const newMsg:Msg={id:`M${Date.now()}`,title:"产品推送已提交",body:"产品定价信息已提交至官网，等待官网确认上线。",from:"系统",time:"刚刚",read:false,type:"system",forPortals:["超级管理员","市场端"]};
    setMsgs(l=>[newMsg,...l]);
    notify("已推送至官网，等待官网确认");
  };
  const saveOrder=(o:Order)=>{
    setOrders(l=>l.some(x=>x.id===o.id)?l.map(x=>x.id===o.id?o:x):[...l,o]);
    notify("已保存，点击「推送官网」提交至官网审核");
  };
  const pushOrder=(id:string)=>{
    setOrders(l=>l.map(o=>o.id===id?{...o,pushStatus:"pending"}:o));
    notify("已推送至官网，等待官网确认");
  };
  const saveUser=async(u:UserRecord)=>{
    const exists=users.some(x=>x.id===u.id);
    try{
      await apiRequest(exists?`/api/users/${u.id}`:"/api/users",{method:exists?"PATCH":"POST",body:{name:u.name,phone:u.phone,email:u.email,tag:u.tag,level:u.level,product:u.product,note:u.note}});
      if(account)await loadBackendData(account);notify("用户信息已保存");
    }catch(error){notify(error instanceof Error?error.message:"用户信息保存失败");}
  };
  const savePartner=async(p:ChannelPartner):Promise<boolean>=>{
    const exists=partners.some(x=>x.id===p.id);
    const role=p.role.startsWith("A")?"market":p.role.startsWith("B")?"franchise":"agent";
    const payload:Record<string,unknown>={name:p.name,role,region:p.region,contactName:p.contactName||p.contact.split(" ")[0],contactPhone:p.phone||"",phone:p.phone||"",username:p.username||"",status:statusToChannel(p.status),targetRate:Number(p.target.replace("%",""))||0};
    if(p.password) payload.password=p.password;
    try{
      await apiRequest(exists?`/api/channels/${p.id}`:"/api/channels",{method:exists?"PATCH":"POST",body:payload});
      if(account)await loadBackendData(account);notify("渠道信息已保存");return true;
    }catch(error){notify(error instanceof Error?error.message:"渠道信息保存失败");return false;}
  };

  if(!portal) return <LoginPage onLogin={login}/>;

  const myMsgs=msgs.filter(m=>m.forPortals.includes(portal));
  const unread=myMsgs.filter(m=>!m.read).length;
  const pending=approvals.filter(a=>a.status==="待审批").length;
  const canApprove=portal==="超级管理员"||portal==="市场端";
  const isManager=portal==="超级管理员"||portal==="市场端";

  return (
    <main className={`oaShell portal-${portal==="超级管理员"?"S":portal==="市场端"?"A":portal==="加盟端"?"B":"C"}`}>
      <aside className="oaSidebar">
        <button className="oaBrand" onClick={()=>setView("经营总览")}>
          <BrandSignature compact />
        </button>
        <div className="workspace"><small>当前端口</small><button><b>{portal}</b><span>{account?.displayName||portalAccount[portal]}</span><i>⌄</i></button></div>
        <nav>
          {portalNav[portal].map(v=>(
            <button key={v} className={view===v?"active":""} onClick={()=>setView(v)}>
              <span>{navIcons[v]}</span>{v}
              {v==="审批中心"&&pending>0&&<i>{pending}</i>}
              {v==="消息通知"&&unread>0&&<i>{unread}</i>}
            </button>
          ))}
        </nav>
        <div className="sidebarFoot">
          <button className="sidebarSettings" onClick={()=>notify("已打开系统设置")}><span aria-hidden="true">⚙</span>系统设置</button>
          <div className="sidebarAccount">
            <span className="accountAvatar">{portal==="超级管理员"?"S":portal==="市场端"?"A":portal==="加盟端"?"B":"C"}</span>
            <p><b>{account?.displayName||portalAccount[portal]}</b><small>{portal}</small></p>
          </div>
          <button className="logoutButton" onClick={logout} disabled={loggingOut} aria-label="退出登录">
            <span className="logoutIcon" aria-hidden="true">↪</span>
            <span>{loggingOut?"正在退出...":"退出登录"}</span>
          </button>
        </div>
      </aside>
      <section className="oaMain">
        <header className="oaTopbar">
          <div><p>LEOPARD SPEED · {portal}</p><h1>{view==="经营总览"?portalTitle[portal]:view}</h1></div>
          <div className="oaActions">
            <button className="oaSearch">⌕ <span>搜索用户、渠道、订单</span><kbd>⌘K</kbd></button>
            <button className="noticeBtn" onClick={()=>setView("消息通知")}><span>◉</span>{unread>0&&<i>{unread}</i>}</button>
            {canApprove&&<button className="noticeBtn" onClick={()=>setView("审批中心")}><span>✓</span>{pending>0&&<i>{pending}</i>}</button>}
          </div>
        </header>
        <div className="demoFlag"><span>后端已接入</span>账号、渠道、用户与邀请数据来自本地 D1 数据库。</div>
        {view==="经营总览"    &&<Dashboard portal={portal} setView={setView} pending={pending} notify={notify}/>}
        {view==="渠道生态"    &&<ChannelEcosystem portal={portal} partners={partners} savePartner={savePartner} notify={notify}/>}
        {view==="用户中心"    &&<UserCenter portal={portal} users={users} saveUser={saveUser} notify={notify}/>}
        {view==="产品定价"    &&<ProductPricing portal={portal} products={products} saveProduct={saveProduct} pushProduct={pushProduct} notify={notify}/>}
        {view==="订单承制"    &&<OrderManagement portal={portal} orders={orders} saveOrder={saveOrder} pushOrder={pushOrder} notify={notify}/>}
        {view==="钱包结算"    &&<Wallet portal={portal} users={users} commRates={commRates} payouts={payouts} distribute={distribute} requestWithdraw={requestWithdraw} notify={notify}/>}
        {view==="佣金比例调整"&&<CommissionRates portal={portal} commRates={commRates} rateLog={rateLog} updateRate={updateRate}/>}
        {view==="审批中心"    &&<ApprovalCenter approvals={approvals} decide={decide} canApprove={canApprove} portal={portal}/>}
        {view==="邀请管理"    &&<InviteCenter portal={portal} notify={notify}/>}
        {(view==="权限审计"||view==="报表统计"||view==="文件管理"||view==="系统配置")&&<BackendOperations view={view as OperationsView} role={account!.role} notify={notify}/>}
        {view==="消息通知"    &&<MsgCenter msgs={myMsgs} markRead={markRead} markAllRead={markAllRead} setView={setView}/>}
      </section>
      {toast&&<div className="oaToast">{toast}</div>}
    </main>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────
function Dashboard({portal,setView,pending,notify}:{portal:Portal;setView:(v:View)=>void;pending:number;notify:(s:string)=>void}) {
  if(portal==="市场端") return <MarketDashboard setView={setView} pending={pending}/>;
  if(portal==="加盟端") return <FranchiseDashboard setView={setView} notify={notify}/>;
  if(portal==="代理端") return <AgentDashboard setView={setView} notify={notify}/>;
  return <SuperDashboard setView={setView} pending={pending}/>;
}
function SuperDashboard({setView,pending}:{setView:(v:View)=>void;pending:number}) {
  const partners=[["华东加盟中心","上海/浙江","2,846","¥186,420","91%"],["华南加盟中心","广东/福建","2,125","¥142,680","78%"],["川渝课程分销","四川/重庆","968","¥52,300","65%"],["北方创作联盟","北京/河北","782","¥41,850","58%"]];
  return <div className="overviewGrid">
    <section className="commandHero">
      <div><span className="live"><i/>经营实时监控</span><h2>现金优先，<br/>把增长变成<em>可回收利润</em></h2><p>订单、渠道、回款与分佣统一可追溯经营闭环。</p><button onClick={()=>setView("审批中心")}>处理 {pending} 项提现审批 →</button></div>
      <div className="cashRing"><div><small>本月现金回款</small><strong>¥472,680</strong><span>目标完成 78.8%</span></div><i/><i/></div>
    </section>
    <div className="kpiGrid">{[["本月确认收入","¥586,420","环比 +18.6%","income"],["可用经营现金","¥380,860","覆盖 2.7 月","cash"],["应付渠道分佣","¥91,820","待结算 12 笔","commission"],["贡献毛利率","42.8%","目标 ≥ 40%","margin"]].map(x=><article className={`kpi ${x[3]}`} key={x[0]}><small>{x[0]}</small><strong>{x[1]}</strong><span>{x[2]}</span><i/></article>)}</div>
    <section className="oaPanel revenuePanel"><PanelHead tag="CASHFLOW" title="收入与回款趋势" action="最近 30 天"/>
      <div className="chart">{[42,58,48,72,65,81,76,94,84,108,99,122].map((h,i)=><div key={i}><i style={{height:`${h}px`}}/><b style={{height:`${Math.max(h-22,18)}px`}}/><span>{i+1}周</span></div>)}</div>
      <div className="legend"><span><i/>确认收入</span><span><i/>现金回款</span></div>
    </section>
    <section className="oaPanel funnelPanel"><PanelHead tag="CONVERSION" title="用户商业转化漏斗" action="本月"/>
      <div className="funnel">{[["新增注册","6,721","100%"],["完成免费课","3,860","57.4%"],["会员订阅","1,146","17.1%"],["精品课转化","284","4.2%"],["承制人才","96","1.4%"]].map((x,i)=><div key={x[0]} style={{width:`${100-i*14}%`}}><span>{x[0]}</span><b>{x[1]}</b><small>{x[2]}</small></div>)}</div>
    </section>
    <section className="oaPanel channelRank"><PanelHead tag="CHANNEL" title="渠道经营排行" action="查看全部 →"/>
      <div className="miniTable">{partners.map((p,i)=><div key={p[0]}><b>0{i+1}</b><span><strong>{p[0]}</strong><small>{p[1]}</small></span><em>{p[2]} 人</em><i>{p[3]}</i></div>)}</div>
    </section>
    <section className="oaPanel alerts"><PanelHead tag="ACTION" title="经营预警与待办" action={`${pending+2} 项`}/>
      <button onClick={()=>setView("审批中心")}><b>审批</b><span>{pending} 笔渠道提现申请等待确认</span><i>高</i></button>
      <button><b>回款</b><span>2 笔承制订单超过约定账期 7 天</span><i>高</i></button>
      <button><b>渠道</b><span>川渝课程分销连续两周低于目标线</span><i>中</i></button>
    </section>
  </div>;
}
function MarketDashboard({setView,pending}:{setView:(v:View)=>void;pending:number}) {
  return <div className="roleDashboard marketDashboard">
    <section className="roleHero marketHero">
      <div><span className="roleCode">MARKET CONTROL · A</span><h2>让每一条渠道增长，<br/>都能找到来源与利润。</h2><p>加盟商、代理商与用户经二维码邀请绑定，来源、分佣、提现统一进入市场经营视图。</p>
        <div className="heroActions"><button onClick={()=>setView("渠道生态")}>查看全国渠道</button><button onClick={()=>setView("审批中心")}>处理 {pending} 项提现审批</button></div></div>
      <div className="networkRadar"><i/><i/><i/><b>A</b><span>24 个区域节点在线</span></div>
    </section>
    <div className="roleMetrics">{[["全国新增用户","6,721","+18.6%"],["渠道充值总额","¥381,250","+12.4%"],["付费转化率","17.1%","+2.8pct"],["待批提现申请",String(pending),"需审批"]].map((x,i)=><article key={x[0]}><i>0{i+1}</i><small>{x[0]}</small><strong>{x[1]}</strong><span>{x[2]}</span></article>)}</div>
    <section className="oaPanel marketMap"><PanelHead tag="REGIONAL NETWORK" title="区域渠道作战地图" action="全国 · 24 个节点"/>
      <div className="mapBoard"><div className="mapMesh">{["华东 91%","华南 78%","川渝 65%","华北 72%","西北 46%"].map((x,i)=><button key={x} style={{left:`${[66,60,41,57,28][i]}%`,top:`${[48,73,67,28,42][i]}%`}}><i/>{x}</button>)}</div>
        <div className="mapLegend"><b>本月目标 ¥600,000</b><span>已完成 78.8%</span><progress max="100" value="78.8"/></div></div>
    </section>
    <section className="oaPanel marketQueue"><PanelHead tag="QUEUE" title="待处理队列" action={`${pending+1} 项`}/>
      {[["提现审批","华南加盟中心","申请提现 ¥28,600","待审批"],["提现审批","星河创作社","申请提现 ¥3,600","待审批"],["渠道预警","川渝课程分销","连续两周未达标","立即跟进"]].map((x,i)=><button key={i} onClick={()=>setView("审批中心")}><i>{x[0].slice(0,1)}</i><span><b>{x[0]}·{x[1]}</b><small>{x[2]}</small></span><em>{x[3]} →</em></button>)}
    </section>
  </div>;
}
function FranchiseDashboard({setView,notify}:{setView:(v:View)=>void;notify:(s:string)=>void}) {
  return <div className="roleDashboard franchiseDashboard">
    <section className="roleHero franchiseHero">
      <div><span className="roleCode">REGIONAL PARTNER · B</span><h2>华东区域，本月距离目标<br/>还差 <em>¥27,580</em></h2><p>用二维码邀请代理端与用户，经营区域增长、分佣与可结算权益。</p>
        <div className="heroActions"><button onClick={()=>setView("钱包结算")}>查看可提现收益</button><button onClick={()=>setView("邀请管理")}>邀请代理 / 用户</button></div></div>
      <div className="goalOrb"><small>区域目标完成</small><strong>91%</strong><span>排名全国第 1</span><i/></div>
    </section>
    <div className="roleMetrics">{[["我邀请的用户","2,846","+21.3%"],["本月充值","¥186,420","+16.8%"],["预计分佣","¥72,680","待结算"],["我邀请的代理","38","6 个活跃"]].map((x,i)=><article key={x[0]}><i>0{i+1}</i><small>{x[0]}</small><strong>{x[1]}</strong><span>{x[2]}</span></article>)}</div>
    <section className="oaPanel agentTree"><PanelHead tag="MY AGENTS" title="我邀请的代理贡献矩阵" action="查看用户中心 →"/>
      <div className="agentMatrix">{[["星河创作社","668","¥38,260","84%"],["杭州星创社","782","¥41,850","92%"],["宁波创作营","426","¥21,680","71%"],["温州AI学社","315","¥15,420","58%"]].map((x,i)=><button key={x[0]} onClick={()=>setView("用户中心")}><span><i>{i+1}</i><b>{x[0]}</b></span><strong>{x[1]} 人</strong><em>{x[2]}</em><progress max="100" value={x[3].replace("%","")}/><small>{x[3]}</small></button>)}</div>
    </section>
    <section className="oaPanel conversionPulse"><PanelHead tag="REGIONAL FUNNEL" title="区域课程转化" action="本月"/>
      <div className="pulseRing"><b>23.6%</b><span>付费转化</span></div>
      <div className="pulseSteps">{[["免费课完课","1,864"],["会员订阅","682"],["精品课报名","126"],["高价值学员","42"]].map(x=><div key={x[0]}><span>{x[0]}</span><b>{x[1]}</b></div>)}</div>
    </section>
  </div>;
}
function AgentDashboard({setView,notify}:{setView:(v:View)=>void;notify:(s:string)=>void}) {
  return <div className="roleDashboard agentDashboard">
    <section className="agentWelcome">
      <div><span className="roleCode">DISTRIBUTOR · C</span><h2>下午好，星河创作社</h2><p>今天已有 18 位新用户扫你的邀请二维码完成注册并绑定。</p></div>
      <div className="agentBalance"><small>可提现余额</small><strong>¥8,420.60</strong><button onClick={()=>setView("钱包结算")}>立即提现 →</button></div>
    </section>
    <section className="promotionCommand">
      <div><span>MY INVITE QR</span><h2>一张专属二维码，<br/>绑定每一位注册用户</h2><p>用户扫码首次注册后自动绑定我为邀请人，归属清晰可查。</p><button onClick={()=>setView("邀请管理")}>打开邀请管理</button></div>
      <div className="qrTerminal"><div>⌗</div><b>C-2861</b><span>我的用户邀请码</span></div>
    </section>
    <div className="roleMetrics agentMetrics">{[["今日访问","286","+34"],["扫码注册","18","+8"],["付费用户","6","33.3%"],["预计收益","¥1,286","+18.2%"]].map((x,idx)=><article key={x[0]}><i>0{idx+1}</i><small>{x[0]}</small><strong>{x[1]}</strong><span>{x[2]}</span></article>)}</div>
    <section className="oaPanel leadStream"><PanelHead tag="MY USERS" title="待跟进用户信号" action="查看全部 →"/>
      {[["沈屿","浏览会员页面 3 次","建议发送会员权益","22分钟前"],["苏离","完成免费通识课","会员续费意向高","1小时前"],["江晴","购买收费课程","已转化付费用户","3小时前"]].map(x=><button key={x[0]} onClick={()=>setView("用户中心")}><i>{x[0].slice(0,1)}</i><span><b>{x[0]}</b><small>{x[1]}</small></span><em>{x[2]}</em><time>{x[3]}</time></button>)}
    </section>
    <section className="oaPanel earningComposition"><PanelHead tag="EARNINGS" title="本月收益构成" action="结算规则"/>
      {[["会员订阅","¥2,860","34%"],["收费课程","¥4,210","50%"],["精品课程","¥1,350","16%"]].map(x=><div key={x[0]}><span>{x[0]}</span><b>{x[1]}</b><i style={{width:x[2]}}/><small>{x[2]}</small></div>)}
    </section>
  </div>;
}

// ── Channel Ecosystem ────────────────────────────────────────────────────
function ChannelEcosystem({portal,partners,savePartner,notify}:{portal:Portal;partners:ChannelPartner[];savePartner:(p:ChannelPartner)=>Promise<boolean>;notify:(s:string)=>void}) {
  const isManager=portal==="超级管理员"||portal==="市场端";
  const [editing,setEditing]=useState<ChannelPartner|null>(null);
  const [detail,setDetail]=useState<ChannelPartner|null>(null);
  const [showForm,setShowForm]=useState(false);
  const open=(p?:ChannelPartner)=>{setEditing(p?{...p,password:""}:{id:crypto.randomUUID(),name:"",role:portal==="超级管理员"?"A·市场端":"B·加盟商",region:"",users:"0",revenue:"¥0",target:"0%",status:"正常",contact:"",contactName:"",joinDate:"",username:"",phone:"",password:""});setShowForm(true);setDetail(null);};
  const save=async()=>{
    if(!editing?.name.trim()){notify("请填写渠道名称");return;}
    const exists=partners.some(p=>p.id===editing.id);
    if(!editing.username?.trim()){notify("请填写登录用户名");return;}
    if(!editing.phone?.trim()){notify("请填写登录手机号");return;}
    if(!exists&&(!editing.password||editing.password.length<8)){notify("初始密码至少需要 8 位");return;}
    if(await savePartner(editing)){setShowForm(false);setEditing(null);}
  };
  return <div className="viewStack">
    {detail&&<div className="detailOverlay" onClick={()=>setDetail(null)}>
      <div className="detailCard" onClick={e=>e.stopPropagation()}>
        <div className="detailHead"><span className="roleTag">{detail.role}</span><h2>{detail.name}</h2>{isManager&&<button onClick={()=>open(detail)}>编辑</button>}<button className="closeBtn" onClick={()=>setDetail(null)}>✕</button></div>
        <div className="detailGrid">
          <div><small>区域</small><b>{detail.region}</b></div>
          <div><small>联系人</small><b>{detail.contact}</b></div>
          <div><small>登录用户名</small><b>{detail.username||"-"}</b></div>
          <div><small>登录手机号</small><b>{detail.phone||"-"}</b></div>
          <div><small>加入时间</small><b>{detail.joinDate}</b></div>
          <div><small>累计用户</small><b>{detail.users} 人</b></div>
          <div><small>充值总额</small><b className="txt-blue">{detail.revenue}</b></div>
          <div><small>目标完成</small><b>{detail.target}</b></div>
          <div><small>状态</small><b className={detail.status==="正常"?"txt-green":"txt-red"}>{detail.status}</b></div>
        </div>
      </div>
    </div>}
    <section className="oaPanel">
      <div className="panelHead"><div><small>PARTNERS</small><h2>渠道账户</h2></div>{isManager&&<button onClick={()=>open()}>+ 新增渠道</button>}</div>
      {showForm&&editing&&isManager&&<div className="inlineForm">
        <h3>{partners.some(p=>p.id===editing.id)?"编辑渠道":"新增渠道"}</h3>
        <div className="formGrid">
          <label>渠道名称<input value={editing.name} onChange={e=>setEditing({...editing,name:e.target.value})} placeholder="如：华东加盟中心"/></label>
          <label>角色类型<select value={editing.role} onChange={e=>setEditing({...editing,role:e.target.value})}>{portal==="超级管理员"&&<option>A·市场端</option>}<option>B·加盟商</option><option>C·分销方</option></select></label>
          <label>登录用户名<input value={editing.username||""} onChange={e=>setEditing({...editing,username:e.target.value})} placeholder="用于登记页面登录"/></label>
          <label>登录手机号<input value={editing.phone||""} onChange={e=>setEditing({...editing,phone:e.target.value})} placeholder="11 位手机号"/></label>
          <label>{partners.some(p=>p.id===editing.id)?"重置密码（选填）":"初始密码"}<input type="password" value={editing.password||""} onChange={e=>setEditing({...editing,password:e.target.value})} placeholder={partners.some(p=>p.id===editing.id)?"留空则保持原密码":"至少 8 位"}/></label>
          <label>区域<input value={editing.region} onChange={e=>setEditing({...editing,region:e.target.value})} placeholder="如：上海/浙江"/></label>
          <label>联系人<input value={editing.contactName||""} onChange={e=>setEditing({...editing,contactName:e.target.value})} placeholder="如：张经理"/></label>
          <label>目标完成比例<input value={editing.target} onChange={e=>setEditing({...editing,target:e.target.value})} placeholder="如：80%"/></label>
          <label>状态<select value={editing.status} onChange={e=>setEditing({...editing,status:e.target.value})}><option>正常</option><option>观察</option><option>暂停</option></select></label>
        </div>
        <div className="formActions"><button onClick={save} className="solid">保存</button><button onClick={()=>setShowForm(false)}>取消</button></div>
      </div>}
      <div className="managedTable partnerTable">
        <div className="mTableHead" style={{gridTemplateColumns:"1fr .8fr .8fr .7fr 1fr .6fr .6fr .7fr"}}><b>渠道名称</b><b>角色</b><b>区域</b><b>用户数</b><b>充值总额</b><b>目标完成</b><b>状态</b><b>操作</b></div>
        {partners.map(p=><div key={p.id} className="mTableRow" style={{gridTemplateColumns:"1fr .8fr .8fr .7fr 1fr .6fr .6fr .7fr"}}>
          <span><strong>{p.name}</strong></span><span className="roleTag">{p.role}</span><span>{p.region}</span>
          <span>{p.users}</span><span className="txt-blue">{p.revenue}</span><span>{p.target}</span>
          <span className={p.status==="正常"?"txt-green":"txt-red"}>{p.status}</span>
          <span className="mRowActions"><button onClick={()=>setDetail(p)}>详情</button>{isManager&&<button onClick={()=>open(p)}>编辑</button>}</span>
        </div>)}
      </div>
    </section>
    <div className="channelThreeCols">
      <section className="oaPanel commissionMatrix"><PanelHead tag="RIGHTS" title="默认分佣权益" action="佣金比例调整页可修改"/>
        {[["会员订阅","20%"],["收费课程","50%"],["承制订单","10%"],["精品课程","60%"],["精品剧集","单独商务"]].map(x=><div key={x[0]}><span>{x[0]}</span><b>{x[1]}</b><i/></div>)}
      </section>
      <section className="oaPanel channelStats"><PanelHead tag="OVERVIEW" title="渠道运营概览" action="本月实时"/>
        <div className="channelKpiRow">
          {[["活跃渠道","4 个","B×2 / C×2"],["覆盖区域","6 个","华东/华南/川渝/华北"],["本月拉新","6,721 人","+18.6%"],["充值总额","¥423,250","+14.2%"]].map(x=><div key={x[0]}><small>{x[0]}</small><b>{x[1]}</b><span>{x[2]}</span></div>)}
        </div>
        <div className="channelAlert">
          <i/>
          <span><b>川渝课程分销</b>连续两周目标完成率低于 70%，建议跟进</span>
          <button onClick={()=>notify("已标记跟进")}>标记跟进</button>
        </div>
      </section>
      <section className="oaPanel channelActivity"><PanelHead tag="ACTIVITY" title="渠道最近动态" action="全部记录"/>
        {[["华东加盟中心","本月新增用户 312 人，充值 ¥24,680","08-07","B"],["星河创作社","通过邀请链接注册新用户 18 人","08-07","C"],["华南加盟中心","申请提现 ¥28,600，审批中","08-06","B"],["川渝课程分销","本月目标完成率 65%，预警触发","08-05","C"],["北方创作联盟","佣金到账 ¥3,200，已确认","08-04","C"]].map(x=><div key={x[0]} className="activityRow"><span className={`actTag ${x[3]==="B"?"tagB":"tagC"}`}>{x[3]}</span><div><b>{x[0]}</b><p>{x[1]}</p></div><time>{x[2]}</time></div>)}
      </section>
    </div>
  </div>;
}

// ── User Center ────────────────────────────────────────────────────────────
function UserCenter({portal,users,saveUser,notify}:{portal:Portal;users:UserRecord[];saveUser:(u:UserRecord)=>void;notify:(s:string)=>void}) {
  const isManager=portal==="超级管理员"||portal==="市场端";
  const [editing,setEditing]=useState<UserRecord|null>(null);
  const [detail,setDetail]=useState<UserRecord|null>(null);
  const [showForm,setShowForm]=useState(false);
  const myUsers=portal==="加盟端"?users.filter(u=>u.invitorRole==="加盟端"):portal==="代理端"?users.filter(u=>u.invitorRole==="代理端"):users;
  const open=(u?:UserRecord)=>{setEditing(u?{...u}:{id:crypto.randomUUID(),name:"",phone:"",email:"",invitedBy:"",invitorRole:"市场端",tag:"普通用户",level:"D",recharged:0,hasCharged:false,product:"—",joinDate:"2026-08-14",note:""});setShowForm(true);setDetail(null);};
  const save=()=>{if(!editing||!editing.name){notify("请填写用户姓名");return;}saveUser(editing);setShowForm(false);setEditing(null);};
  return <div className="viewStack">
    {detail&&<div className="detailOverlay" onClick={()=>setDetail(null)}>
      <div className="detailCard" onClick={e=>e.stopPropagation()}>
        <div className="detailHead"><div className="avatarCircle">{detail.name.slice(0,1)}</div><h2>{detail.name}</h2>{isManager&&<button onClick={()=>open(detail)}>编辑</button>}<button className="closeBtn" onClick={()=>setDetail(null)}>✕</button></div>
        <div className="detailGrid">
          <div><small>用户ID</small><b>{detail.id}</b></div>
          <div><small>手机号</small><b>{detail.phone}</b></div>
          <div><small>邮箱</small><b>{detail.email}</b></div>
          <div><small>邀请来源</small><b>{detail.invitedBy}</b></div>
          <div><small>标签</small><b>{detail.tag}</b></div>
          <div><small>创作者等级</small><b>{detail.level}</b></div>
          <div><small>已购产品</small><b>{detail.product}</b></div>
          <div><small>累计充值</small><b className={detail.hasCharged?"txt-blue":"txt-red"}>{detail.hasCharged?`¥${detail.recharged.toLocaleString()}`:"未充值"}</b></div>
          <div><small>注册时间</small><b>{detail.joinDate}</b></div>
          <div><small>备注</small><b>{detail.note||"—"}</b></div>
        </div>
      </div>
    </div>}
    {(portal==="加盟端"||portal==="代理端")&&<section className="scopeNote"><b>数据范围</b><p>仅展示通过本{portal}邀请二维码注册并绑定的用户数据。</p></section>}
    {portal==="加盟端"&&<section className="oaPanel"><PanelHead tag="MY AGENTS" title="我邀请的代理端" action="2 个账户"/>
      <DataTable heads={["代理名称","类型","绑定用户","累计充值","加入时间"]} rows={[["星河创作社","代理端","668 人","¥38,260","2026-07-10"],["杭州星创社","代理端","782 人","¥41,850","2026-06-18"]]} onRow={()=>notify("已打开代理经营详情")}/>
    </section>}
    <section className="oaPanel">
      <div className="panelHead"><div><small>CRM</small><h2>{portal==="加盟端"||portal==="代理端"?"我邀请的用户":"用户与邀请归属"}</h2></div>{isManager&&<button onClick={()=>open()}>+ 新增用户</button>}</div>
      {showForm&&editing&&isManager&&<div className="inlineForm">
        <h3>{users.some(u=>u.id===editing.id)?"编辑用户":"新增用户"}</h3>
        <div className="formGrid">
          <label>姓名<input value={editing.name} onChange={e=>setEditing({...editing,name:e.target.value})} placeholder="真实姓名"/></label>
          <label>手机号<input value={editing.phone} onChange={e=>setEditing({...editing,phone:e.target.value})} placeholder="138****0000"/></label>
          <label>邮箱<input value={editing.email} onChange={e=>setEditing({...editing,email:e.target.value})} placeholder="user@example.com"/></label>
          <label>标签<input value={editing.tag} onChange={e=>setEditing({...editing,tag:e.target.value})} placeholder="如：成长会员"/></label>
          <label>邀请来源<input value={editing.invitedBy} onChange={e=>setEditing({...editing,invitedBy:e.target.value})}/></label>
          <label>备注<input value={editing.note} onChange={e=>setEditing({...editing,note:e.target.value})}/></label>
        </div>
        <div className="formActions"><button onClick={save} className="solid">保存</button><button onClick={()=>setShowForm(false)}>取消</button></div>
      </div>}
      <div className="userTable">
        <div className="userTableHead"><b>用户ID</b><b>姓名</b><b>手机</b><b>邀请来源</b><b>产品</b><b>已充值</b><b>状态</b><b>操作</b></div>
        {myUsers.map(u=><div key={u.id} className="userTableRow">
          <span>{u.id}</span><span><strong>{u.name}</strong></span><span>{u.phone}</span>
          <span className="txt-muted">{u.invitedBy}</span><span>{u.product}</span>
          <span className={u.hasCharged?"txt-green":"txt-red"}>{u.hasCharged?`¥${u.recharged.toLocaleString()}`:"未充值"}</span>
          <span className={`statusPill ${u.hasCharged?"paid":"unpaid"}`}>{u.hasCharged?"已付费":"待转化"}</span>
          <span className="mRowActions"><button onClick={()=>setDetail(u)}>详情</button>{isManager&&<button onClick={()=>open(u)}>编辑</button>}</span>
        </div>)}
      </div>
    </section>
    {isManager&&<div className="twoCols">
      <section className="oaPanel userProfile"><PanelHead tag="USER 360" title="用户价值标签" action="自动更新"/>
        <div className="tagCloud"><b>高学习意愿 864</b><b>待会员转化 1,206</b><b>精品课潜客 428</b><b>承制人才 96</b><b>需跟进 183</b></div>
      </section>
      <section className="oaPanel sourceChange"><PanelHead tag="INVITE TRACE" title="邀请归属查询" action="超管/市场端可见"/>
        <p>每位用户永久绑定其邀请方。点击详情可查看完整邀请绑定记录。</p>
      </section>
    </div>}
  </div>;
}

// ── Product Pricing ────────────────────────────────────────────────────────
function ProductPricing({portal,products,saveProduct,pushProduct,notify}:{portal:string;products:Product[];saveProduct:(p:Product)=>void;pushProduct:(id:string)=>void;notify:(s:string)=>void}) {
  const isManager=portal==="超级管理员"||portal==="市场端";
  const [editing,setEditing]=useState<Product|null>(null);
  const [showForm,setShowForm]=useState(false);
  const open=(p?:Product)=>{setEditing(p?{...p}:{id:`P-${crypto.randomUUID().slice(0,8)}`,name:"",type:"",price:"",commission:"",scope:"全国统一",status:"上架",pushStatus:"draft"});setShowForm(true);};
  const save=()=>{if(!editing||!editing.name){notify("请填写产品名称");return;}saveProduct(editing);setShowForm(false);setEditing(null);};
  const pushLabel=(s:Product["pushStatus"])=>s==="approved"?"官网已上线":s==="pending"?"推送审核中":"推送官网";
  if(!isManager){
    return <div className="viewStack">
      <section className="pricingRule"><div><span>统一定价·只读</span><h2>产品目录与我的分佣比例</h2><p>全国统一售价，不可折价销售；分佣比例由上级渠道设定。</p></div><b>READ<br/>ONLY</b></section>
      <section className="oaPanel"><PanelHead tag="PRODUCTS" title="产品与我的分佣（只读）" action="全国统一价"/>
        <DataTable heads={["产品ID","产品名称","类型","统一售价","我的分佣比例","状态"]} rows={products.map(p=>[p.id,p.name,p.type,p.price,p.commission,p.status])} onRow={()=>notify("产品信息为只读")}/>
      </section>
    </div>;
  }
  return <div className="viewStack">
    <section className="pricingRule"><div><span>统一定价原则</span><h2>所有收费内容对外统一报价</h2><p>填写产品信息后点击「推送官网」，提交至官网审核，由官网决定上线节奏。</p></div><b>PRICE<br/>CONTROL</b></section>
    <section className="oaPanel">
      <div className="panelHead"><div><small>PRODUCTS</small><h2>产品与定价中心</h2></div><button onClick={()=>open()}>+ 新建产品</button></div>
      {showForm&&editing&&<div className="inlineForm">
        <h3>{products.some(p=>p.id===editing.id)?"编辑产品":"新建产品"}</h3>
        <div className="formGrid">
          <label>产品名称<input value={editing.name} onChange={e=>setEditing({...editing,name:e.target.value})} placeholder="如：AI短剧进阶课"/></label>
          <label>产品类型<input value={editing.type} onChange={e=>setEditing({...editing,type:e.target.value})} placeholder="如：收费网课"/></label>
          <label>统一售价<input value={editing.price} onChange={e=>setEditing({...editing,price:e.target.value})} placeholder="如：¥699.00"/></label>
          <label>分佣比例<input value={editing.commission} onChange={e=>setEditing({...editing,commission:e.target.value})} placeholder="如：50%"/></label>
          <label>状态<select value={editing.status} onChange={e=>setEditing({...editing,status:e.target.value})}><option>上架</option><option>下架</option><option>招生中</option></select></label>
          <label>价格范围<input value={editing.scope} onChange={e=>setEditing({...editing,scope:e.target.value})}/></label>
        </div>
        <div className="formActions"><button onClick={save} className="solid">保存草稿</button><button onClick={()=>setShowForm(false)}>取消</button></div>
      </div>}
      <div className="managedTable">
        <div className="mTableHead"><b>产品ID</b><b>名称</b><b>类型</b><b>售价</b><b>分佣</b><b>状态</b><b>官网状态</b><b>操作</b></div>
        {products.map(p=><div key={p.id} className="mTableRow">
          <span>{p.id}</span><span><strong>{p.name}</strong></span><span>{p.type}</span>
          <span className="txt-blue">{p.price}</span><span>{p.commission}</span>
          <span className={`statusPill ${p.status==="上架"||p.status==="招生中"?"paid":"unpaid"}`}>{p.status}</span>
          <span className={`statusPill ${p.pushStatus==="approved"?"paid":p.pushStatus==="pending"?"":"unpaid"}`}>{pushLabel(p.pushStatus)}</span>
          <span className="mRowActions">
            <button onClick={()=>open(p)}>编辑</button>
            <button className={`publishBtn${p.pushStatus!=="draft"?" done":""}`} disabled={p.pushStatus==="pending"} onClick={()=>pushProduct(p.id)}>{pushLabel(p.pushStatus)}</button>
          </span>
        </div>)}
      </div>
    </section>
    <div className="twoCols">
      <section className="oaPanel"><PanelHead tag="COMPUTE" title="算力分销规则" action="编辑规则"/><div className="ruleCard"><small>最低起消点</small><strong>10 万积分</strong><span>超出起消点部分按 0.9 折结算。</span></div></section>
      <section className="oaPanel"><PanelHead tag="CHANGE LOG" title="价格变更记录" action="全部记录"/><div className="timeline"><p><i/>07-26 精品实训营调整为 ¥2,980 <small>超级管理员</small></p><p><i/>07-18 算力包新增 10 万积分档 <small>超级管理员</small></p></div></section>
    </div>
  </div>;
}

// ── Order Management ────────────────────────────────────────────────────────
function OrderManagement({portal,orders,saveOrder,pushOrder,notify}:{portal:string;orders:Order[];saveOrder:(o:Order)=>void;pushOrder:(id:string)=>void;notify:(s:string)=>void}) {
  const isManager=portal==="超级管理员"||portal==="市场端";
  const [editing,setEditing]=useState<Order|null>(null);
  const [showForm,setShowForm]=useState(false);
  const open=(o?:Order)=>{setEditing(o?{...o}:{id:`OD26${crypto.randomUUID().slice(0,8)}`,name:"",bizType:"",channel:"",amount:"",status:"待签合同",deadline:"",pushStatus:"draft"});setShowForm(true);};
  const save=()=>{if(!editing||!editing.name){notify("请填写项目名称");return;}saveOrder(editing);setShowForm(false);setEditing(null);};
  const pushLabel=(s:Order["pushStatus"])=>s==="approved"?"官网已发布":s==="pending"?"推送审核中":"推送官网";
  return <div className="viewStack">
    <div className="orderSummary">{[["进行中订单","18"],["合同总金额","¥418,600"],["本月已回款","¥286,420"],["逾期应收","¥32,000"]].map(x=><article key={x[0]}><small>{x[0]}</small><strong>{x[1]}</strong></article>)}</div>
    <section className="oaPanel">
      <div className="panelHead"><div><small>DELIVERY</small><h2>订单与承制项目</h2></div>{isManager&&<button onClick={()=>open()}>+ 新建订单</button>}</div>
      {showForm&&editing&&isManager&&<div className="inlineForm">
        <h3>{orders.some(o=>o.id===editing.id)?"编辑订单":"新建订单"}</h3>
        <div className="formGrid">
          <label>项目名称<input value={editing.name} onChange={e=>setEditing({...editing,name:e.target.value})} placeholder="如：都市逆袭·第1集"/></label>
          <label>业务类型<input value={editing.bizType} onChange={e=>setEditing({...editing,bizType:e.target.value})} placeholder="如：AI漫剧承制"/></label>
          <label>来源渠道<input value={editing.channel} onChange={e=>setEditing({...editing,channel:e.target.value})} placeholder="如：华东加盟中心"/></label>
          <label>合同金额<input value={editing.amount} onChange={e=>setEditing({...editing,amount:e.target.value})} placeholder="如：¥18,000"/></label>
          <label>状态<select value={editing.status} onChange={e=>setEditing({...editing,status:e.target.value})}><option>待签合同</option><option>制作中</option><option>待验收</option><option>待回款</option><option>已回款</option><option>合同中</option></select></label>
          <label>交付日期<input value={editing.deadline} onChange={e=>setEditing({...editing,deadline:e.target.value})} placeholder="如：08-08"/></label>
        </div>
        <div className="formActions"><button onClick={save} className="solid">保存草稿</button><button onClick={()=>setShowForm(false)}>取消</button></div>
      </div>}
      <div className="managedTable">
        <div className="mTableHead" style={{gridTemplateColumns:"100px 1.4fr .8fr .9fr .7fr 80px 70px 80px 110px"}}><b>订单号</b><b>项目名称</b><b>业务类型</b><b>来源渠道</b><b>金额</b><b>状态</b><b>交付</b><b>官网</b>{isManager&&<b>操作</b>}</div>
        {orders.map(o=><div key={o.id} className="mTableRow" style={{gridTemplateColumns:"100px 1.4fr .8fr .9fr .7fr 80px 70px 80px 110px"}}>
          <span>{o.id}</span><span><strong>{o.name}</strong></span><span>{o.bizType}</span>
          <span>{o.channel}</span><span className="txt-blue">{o.amount}</span>
          <span className={`statusPill ${o.status==="已回款"?"paid":o.status==="合同中"||o.status==="待签合同"?"unpaid":""}`}>{o.status}</span>
          <span>{o.deadline}</span>
          <span className={`statusPill ${o.pushStatus==="approved"?"paid":o.pushStatus==="pending"?"":"unpaid"}`}>{pushLabel(o.pushStatus)}</span>
          {isManager&&<span className="mRowActions">
            <button onClick={()=>open(o)}>编辑</button>
            <button className={`publishBtn${o.pushStatus!=="draft"?" done":""}`} disabled={o.pushStatus==="pending"} onClick={()=>pushOrder(o.id)}>{o.pushStatus==="draft"?"推送官网":o.pushStatus==="pending"?"审核中":"已发布"}</button>
          </span>}
        </div>)}
      </div>
    </section>
    <section className="oaPanel deliveryLane"><PanelHead tag="PIPELINE" title="项目交付看板" action="拖动更新状态"/>
      {["待签合同","制作中","待验收","待回款"].map((s,i)=><div key={s}><h3>{s}<span>{[3,7,4,2][i]}</span></h3><article><b>{["古风角色资产","都市逆袭1-10集","悬疑短剧整剧","精品课上海站"][i]}</b><small>{["¥3,200","¥18,000","¥86,000","¥89,400"][i]}</small><i>{["今天","08-08","08-18","逾期3天"][i]}</i></article></div>)}
    </section>
  </div>;
}

// ── Wallet ────────────────────────────────────────────────────────────────
function Wallet({portal,users,commRates,payouts,distribute,requestWithdraw,notify}:{portal:Portal;users:UserRecord[];commRates:CommRate[];payouts:Payout[];distribute:(r:string,a:string)=>void;requestWithdraw:(payload:{amount:string;method:string;accountName:string;accountNumber:string;remark:string})=>void;notify:(s:string)=>void}) {
  const [receiver,setReceiver]=useState("华东加盟中心（加盟端）");
  const [amount,setAmount]=useState("5000");
  const [withdrawAmt,setWithdrawAmt]=useState(portal==="加盟端"?"72680":"8420");
  const [withdrawMethod,setWithdrawMethod]=useState("银行卡");
  const [withdrawName,setWithdrawName]=useState(portalAccount[portal]);
  const [withdrawNumber,setWithdrawNumber]=useState("");
  const [withdrawRemark,setWithdrawRemark]=useState("");
  const isManager=portal==="超级管理员"||portal==="市场端";
  const account=portalAccount[portal];
  const channelStats=()=>{
    const map:Record<string,{name:string;role:string;paid:number;paidAmt:number;unpaid:number;total:number;commission:number}>={};
    users.forEach(u=>{const key=u.invitedBy;if(!map[key])map[key]={name:u.invitedBy,role:u.invitorRole,paid:0,paidAmt:0,unpaid:0,total:0,commission:0};map[key].total++;if(u.hasCharged){map[key].paid++;map[key].paidAmt+=u.recharged;}else map[key].unpaid++;});
    Object.values(map).forEach(row=>{const rate=commRates.find(r=>row.name.includes(r.name));const rv=rate?parseFloat(rate.course.replace("%",""))/100:0.2;row.commission=Math.round(row.paidAmt*rv);});
    return Object.values(map);
  };
  const stats=channelStats();
  if(isManager) return <div className="viewStack">
    <section className="walletHero"><div><small>平台资金可用余额</small><strong>¥380,860.20</strong><p>待渠道结算 ¥91,820 · 待供应商结算 ¥64,300</p></div><button onClick={()=>notify("已生成本月结算单")}>生成结算单</button></section>
    <div className="walletCards">{[["渠道钱包余额","¥126,840","23 个账户"],["本月提现申请","¥48,600","进入审批中心"],["本月佣金分发","2 笔","超管/市场端发放"],["算力充值","¥72,000","本月 31 笔"]].map(x=><article key={x[0]}><small>{x[0]}</small><strong>{x[1]}</strong><span>{x[2]}</span></article>)}</div>
    <section className="oaPanel"><PanelHead tag="CHANNEL RECHARGE" title="分销商邀请用户充值情况" action="按佣金比例自动计算"/>
      <div className="rechargeTable">
        <div className="rTableHead"><b>邀请渠道</b><b>角色</b><b>总用户</b><b>已充值人数</b><b>充值总额</b><b>未充值人数</b><b>应付佣金</b></div>
        {stats.map(row=><div key={row.name} className="rTableRow"><span><strong>{row.name}</strong></span><span className="roleTag">{row.role}</span><span>{row.total}</span><span className="txt-green">{row.paid} 人</span><span className="txt-blue">¥{row.paidAmt.toLocaleString()}</span><span className="txt-red">{row.unpaid} 人</span><span className="txt-gold">¥{row.commission.toLocaleString()}</span></div>)}
      </div>
    </section>
    <section className="oaPanel payoutPanel"><PanelHead tag="COMMISSION PAYOUT" title="佣金分发" action="发放即入对方钱包并留痕"/>
      <div className="payoutForm">
        <label>接收账户<select value={receiver} onChange={e=>setReceiver(e.target.value)}><option>华东加盟中心（加盟端）</option><option>华南加盟中心（加盟端）</option><option>星河创作社（代理端）</option><option>杭州星创社（代理端）</option></select></label>
        <label>分发金额（¥）<input value={amount} onChange={e=>setAmount(e.target.value)} inputMode="numeric"/></label>
        <button onClick={()=>distribute(receiver,amount)}>确认分发</button>
      </div>
      <DataTable heads={["分发单号","接收方","金额","发放人","时间"]} rows={payouts} onRow={()=>notify("已打开佣金分发凭证")}/>
    </section>
  </div>;
  const myUsers=users.filter(u=>u.invitorRole===portal&&account.includes(u.invitedBy.replace(/代理端·|加盟端·/,"")));
  const myRate=commRates.find(r=>account.includes(r.name));
  const rv=myRate?parseFloat(myRate.course.replace("%",""))/100:0.2;
  const totalCharged=myUsers.filter(u=>u.hasCharged).reduce((s,u)=>s+u.recharged,0);
  const myCommission=Math.round(totalCharged*rv);
  const myPayouts=payouts.filter(p=>p[1].includes(account.replace(/.*·/,"")));
  return <div className="viewStack">
    <section className="walletHero"><div><small>我的可提现余额</small><strong>{portal==="加盟端"?"¥72,680.00":"¥8,420.60"}</strong><p>提现申请提交后由超管/市场端审批，通过后打款。</p></div></section>
    <section className="oaPanel"><PanelHead tag="MY USERS RECHARGE" title="我邀请用户的充值情况" action="按佣金比例自动计算"/>
      <div className="rechargeTable">
        <div className="rTableHead" style={{gridTemplateColumns:"1fr 1fr 1fr 1fr .8fr .8fr"}}><b>用户姓名</b><b>手机</b><b>产品</b><b>充值金额</b><b>状态</b><b>我的佣金</b></div>
        {users.filter(u=>u.invitorRole===portal).map(u=><div key={u.id} className="rTableRow" style={{gridTemplateColumns:"1fr 1fr 1fr 1fr .8fr .8fr"}}>
          <span><strong>{u.name}</strong></span><span>{u.phone}</span><span>{u.product}</span>
          <span className={u.hasCharged?"txt-green":"txt-red"}>{u.hasCharged?`¥${u.recharged.toLocaleString()}`:"—"}</span>
          <span className={`statusPill ${u.hasCharged?"paid":"unpaid"}`}>{u.hasCharged?"已充值":"未充值"}</span>
          <span className="txt-gold">{u.hasCharged?`¥${Math.round(u.recharged*rv).toLocaleString()}`:"—"}</span>
        </div>)}
      </div>
      <div className="commSummary"><span>充值总额 <b>¥{totalCharged.toLocaleString()}</b></span><span>分佣比例 <b>{myRate?.course||"—"}</b></span><span>应付佣金 <b className="txt-gold">¥{myCommission.toLocaleString()}</b></span></div>
    </section>
    <section className="oaPanel payoutPanel"><PanelHead tag="WITHDRAW" title="发起提现" action="需超管/市场端审批"/>
      <div className="payoutForm withdrawForm">
        <label>提现金额（¥）<input value={withdrawAmt} onChange={e=>setWithdrawAmt(e.target.value)} inputMode="decimal"/></label>
        <label>收款方式<select value={withdrawMethod} onChange={e=>setWithdrawMethod(e.target.value)}><option>银行卡</option><option>支付宝</option><option>微信</option></select></label>
        <label>收款户名<input value={withdrawName} onChange={e=>setWithdrawName(e.target.value)}/></label>
        <label>收款账号<input value={withdrawNumber} onChange={e=>setWithdrawNumber(e.target.value)} placeholder="请输入银行卡号或收款账号"/></label>
        <label>申请备注<input value={withdrawRemark} onChange={e=>setWithdrawRemark(e.target.value)} placeholder="选填"/></label>
        <button onClick={()=>requestWithdraw({amount:withdrawAmt,method:withdrawMethod,accountName:withdrawName,accountNumber:withdrawNumber,remark:withdrawRemark})}>提交提现申请</button>
      </div>
    </section>
    <section className="oaPanel"><PanelHead tag="RECEIVED" title="收到的佣金分发" action={`${myPayouts.length} 笔`}/>
      <DataTable heads={["分发单号","接收方","金额","发放人","时间"]} rows={myPayouts.length?myPayouts:[["—","暂无记录","—","—","—"]]} onRow={()=>notify("已打开佣金分发凭证")}/>
    </section>
  </div>;
}

// ── Commission Rates ──────────────────────────────────────────────────────
function CommissionRates({portal,commRates,rateLog,updateRate}:{portal:Portal;commRates:CommRate[];rateLog:string[][];updateRate:(id:string,field:keyof CommRate,val:string,label:string)=>void}) {
  const [editing,setEditing]=useState<string|null>(null);
  const [field,setField]=useState<"mem"|"course"|"boutique">("mem");
  const [val,setVal]=useState("");
  const fieldLabel:Record<string,string>={mem:"会员订阅",course:"收费课程",boutique:"精品课"};
  const visible=portal==="加盟端"?commRates.filter(r=>r.role==="代理端"):commRates;
  const startEdit=(r:CommRate,f:"mem"|"course"|"boutique")=>{setEditing(r.id);setField(f);setVal(r[f]);};
  const confirm=()=>{if(editing){updateRate(editing,field,val,fieldLabel[field]);setEditing(null);}};
  return <div className="viewStack">
    <section className="pricingRule"><div><span>佣金比例调整</span><h2>调整下级渠道分佣比例</h2><p>{portal==="加盟端"?"加盟端只能调整自己邀请的代理端比例。":"超管与市场端可调整所有加盟端和代理端比例。"}调整后即时生效并写入审计日志。</p></div><b>RATE<br/>CTRL</b></section>
    <section className="oaPanel">
      <PanelHead tag="ACCOUNTS" title={portal==="加盟端"?"可调整的代理端账户":"可调整的加盟端与代理端账户"} action={`${visible.length} 个账户`}/>
      <div className="rateTable">
        <div className="rateHead"><b>账户名称</b><b>角色</b><b>会员订阅</b><b>收费课程</b><b>精品课</b><b>操作</b></div>
        {visible.map(r=><div className="rateRow" key={r.id}>
          <span>{r.name}</span><span className="roleTag">{r.role}</span>
          {(["mem","course","boutique"] as const).map(f=><span key={f} className="rateCell">{editing===r.id&&field===f?<input className="rateInput" value={val} onChange={e=>setVal(e.target.value)} autoFocus/>:r[f]}</span>)}
          <span className="rateActions">{editing===r.id?<><button className="solid" onClick={confirm}>确认</button><button onClick={()=>setEditing(null)}>取消</button></>:<><button onClick={()=>startEdit(r,"mem")}>会员</button><button onClick={()=>startEdit(r,"course")}>课程</button><button onClick={()=>startEdit(r,"boutique")}>精品</button></>}</span>
        </div>)}
      </div>
    </section>
    <section className="oaPanel"><PanelHead tag="CHANGE LOG" title="佣金比例调整记录" action="永久存档"/>
      <DataTable heads={["记录号","账户","产品","变更","调整人","时间"]} rows={rateLog} onRow={()=>{}}/>
    </section>
  </div>;
}

// ── Approval Center ───────────────────────────────────────────────────────
function ApprovalCenter({approvals,decide,canApprove,portal}:{approvals:Approval[];decide:(id:string,s:"已通过"|"已驳回")=>void;canApprove:boolean;portal:Portal}) {
  return <div className="viewStack">
    <section className="approvalHero"><div><small>待审批提现</small><strong>{approvals.filter(a=>a.status==="待审批").length}</strong></div><p>加盟端/代理端发起提现申请，由超级管理员或市场端审批，通过后打款并写入审计日志。当前审批人：{portal}。</p></section>
    <section className="oaPanel"><PanelHead tag="WITHDRAW APPROVALS" title="提现审批任务" action="按时间排序"/>
      <div className="approvalList">{approvals.map(a=><article key={a.id}>
        <span className="approvalType">提</span>
        <div><small>{a.id}·钱包提现</small><h3>{a.title}</h3><p>{a.applicant}·{a.time}</p></div>
        {a.status==="待审批"&&canApprove?<div className="decision"><button onClick={()=>decide(a.id,"已驳回")}>驳回</button><button onClick={()=>decide(a.id,"已通过")}>通过</button></div>:<b className={a.status==="已通过"?"passed":a.status==="已驳回"?"rejected":""}>{a.status}</b>}
      </article>)}</div>
    </section>
  </div>;
}

// ── Invite Center ─────────────────────────────────────────────────────────
function InviteCenter({portal,notify}:{portal:Portal;notify:(s:string)=>void}) {
  type InviteItem={id:string;code:string;target_role:string;target_role_label:string;status:string;use_count:number;binding_count:number;url:string;qr_url:string};
  type BindingItem={id:string;invitee_type:string;invitee_id:string;invitee_name:string;target_role:string;created_at:string};
  const [items,setItems]=useState<InviteItem[]>([]);
  const [bindings,setBindings]=useState<BindingItem[]>([]);
  const [loading,setLoading]=useState(true);
  const targets=inviteTargets[portal];
  const targetRole=(target:string)=>target==="市场端"?"market":target==="加盟端"?"franchise":target==="代理端"?"agent":"user";
  const load=async()=>{
    setLoading(true);
    try{
            const data=await apiRequest<{invitations?:InviteItem[];bindings?:BindingItem[]}>("/api/invitations");
      setItems(data.invitations??[]);setBindings(data.bindings??[]);
    }catch(error){notify(error instanceof Error?error.message:"邀请数据加载失败");}
    finally{setLoading(false);}
  };
  useEffect(()=>{const timer=window.setTimeout(()=>{void load();},0);return()=>window.clearTimeout(timer);},[portal]);
  const create=async(target:string)=>{
    try{await apiRequest("/api/invitations",{method:"POST",body:{targetRole:targetRole(target)}});await load();notify(`${target}邀请二维码已生成`);}
    catch(error){notify(error instanceof Error?error.message:"邀请码生成失败");}
  };
  const copyLink=async(item:InviteItem)=>{try{await navigator.clipboard.writeText(item.url);notify("邀请链接已复制");}catch{notify(`邀请链接：${item.url}`);}};
  const download=async(item:InviteItem)=>{
    try{
      const blob=await apiBlob(item.qr_url);const url=URL.createObjectURL(blob);const anchor=document.createElement("a");anchor.href=url;anchor.download=`邀请码_${item.target_role_label}.svg`;anchor.click();URL.revokeObjectURL(url);notify(`${item.target_role_label}二维码已下载`);
    }catch(error){notify(error instanceof Error?error.message:"二维码下载失败");}
  };
  const revoke=async(item:InviteItem)=>{try{await apiRequest(`/api/invitations/${item.id}`,{method:"PATCH",body:{status:"revoked"}});await load();notify("邀请码已撤销");}catch(error){notify(error instanceof Error?error.message:"邀请码撤销失败");}};
  return <div className="viewStack">
    <section className="oaPanel"><PanelHead tag="MY QR CODES" title="我的邀请二维码" action={`${targets.length} 种注册码`}/>
      {loading?<div className="emptyState">正在读取真实邀请码...</div>:<div className="inviteGrid">{targets.map(target=>{
        const item=items.find(x=>x.target_role===targetRole(target)&&x.status==="active");
        return <article className="inviteCard" key={target}>
          {item?<img className="qrImage" src={item.qr_url} alt={`${target}邀请二维码`}/>:<div className="qrMock">⌗</div>}
          <h3>{target}注册邀请码</h3><p>扫码注册{target}账号，自动绑定我为邀请人</p>
          <div className="inviteActions">{item?<><button onClick={()=>download(item)}>⬇ 下载二维码</button><button onClick={()=>copyLink(item)}>⎘ 复制链接</button><button onClick={()=>revoke(item)}>撤销</button></>:<button onClick={()=>create(target)}>生成二维码</button>}</div>
          {item&&<small className="inviteMeta">已绑定 {item.binding_count||item.use_count} 人 · 可长期转发</small>}
        </article>;
      })}</div>}
    </section>
    <section className="oaPanel"><PanelHead tag="MY INVITES" title="我的邀请记录" action={`${bindings.length} 条`}/>
      {bindings.length?<DataTable heads={["被邀请方","注册类型","注册时间","绑定状态"]} rows={bindings.map(item=>[item.invitee_name||item.invitee_id,item.target_role,item.created_at?.slice(0,16)||"—","已永久绑定"])} onRow={()=>notify("已打开邀请绑定详情")}/>:<div className="emptyState">暂时没有注册绑定记录</div>}
    </section>
  </div>;
}
// ── Permissions ───────────────────────────────────────────────────────────
function Permissions() {
  const rows=[["产品定价管理","允许","只读","只读"],["订单承制","允许","—","—"],["生成邀请码（类型）","加盟/代理/用户","代理/用户","用户"],["查看用户邀请来源","全量可见","仅自己邀请","仅自己邀请"],["用户数据管理","允许","仅自己邀请","仅自己邀请"],["渠道新增编辑","允许","—","—"],["佣金比例调整","加盟+代理端","仅下级代理端","—"],["佣金分发","允许","—","—"],["提现审批","允许（可批）","—","—"],["钱包提现","—","允许","允许"]];
  return <div className="viewStack">
    <section className="permissionHero"><div><p className="eyebrow">RBAC + AUDIT</p><h2>权限不是菜单可见，<br/>而是每一次操作都可追溯</h2></div><div className="auditPulse"><i/><b>100%</b><span>敏感操作留痕</span></div></section>
    <section className="oaPanel permissionTable"><PanelHead tag="ROLE MATRIX" title="角色权限矩阵" action="最后更新 08-07"/>
      <div className="matrix"><div><b>权限事项</b><b>市场端 A</b><b>加盟端 B</b><b>代理端 C</b></div>{rows.map(r=><div key={r[0]}>{r.map((x,i)=><span className={x.includes("允许")||x.includes("全量")?"yes":x.includes("只读")||x.includes("仅自己")?"review":""} key={i}>{x}</span>)}</div>)}</div>
    </section>
    <section className="oaPanel auditLog"><PanelHead tag="AUDIT LOG" title="最近敏感操作" action="导出日志"/>
      {[["18:32","超级管理员","通过提现申请 ST26072903","IP 192.168.1.18"],["17:46","市场端·李珊","将星河创作社课程比例调整为 48%","IP 192.168.1.31"],["16:20","超级管理员","向华东加盟中心分发佣金 ¥12,600","IP 10.31.8.22"],["15:08","华东加盟中心","生成代理端邀请二维码","IP 10.31.8.30"]].map(x=><div key={x[0]}><time>{x[0]}</time><b>{x[1]}</b><span>{x[2]}</span><small>{x[3]}</small></div>)}
    </section>
  </div>;
}

// ── Message Center ────────────────────────────────────────────────────────
function MsgCenter({msgs,markRead,markAllRead,setView}:{msgs:Msg[];markRead:(id:string)=>void;markAllRead:()=>void;setView:(v:View)=>void}) {
  const typeLabel:Record<Msg["type"],string>={approval:"审批",system:"系统",commission:"佣金",invite:"邀请"};
  const typeColor:Record<Msg["type"],string>={approval:"msg-approval",system:"msg-system",commission:"msg-commission",invite:"msg-invite"};
  return <div className="viewStack">
    <section className="msgHero"><div><small>未读消息</small><strong>{msgs.filter(m=>!m.read).length}</strong></div><button onClick={markAllRead}>全部标为已读</button></section>
    <section className="oaPanel">
      <PanelHead tag="NOTIFICATIONS" title="消息通知中心" action={`共 ${msgs.length} 条`}/>
      <div className="msgList">
        {msgs.length===0&&<p className="emptyMsg">暂无消息通知</p>}
        {msgs.map(m=><article key={m.id} className={`msgItem${m.read?" read":""}`} onClick={()=>{markRead(m.id);if(m.type==="approval")setView("审批中心");}}>
          <span className={`msgIcon ${typeColor[m.type]}`}>{typeLabel[m.type]}</span>
          <div className="msgBody">
            <div className="msgTitle">{!m.read&&<i className="unreadDot"/>}{m.title}</div>
            <p>{m.body}</p>
            <small>{m.from} · {m.time}</small>
          </div>
          {!m.read&&<span className="unreadBadge">未读</span>}
        </article>)}
      </div>
    </section>
  </div>;
}

// ── Shared ────────────────────────────────────────────────────────────────
function PanelHead({tag,title,action}:{tag:string;title:string;action:string}) {
  return <div className="panelHead"><div><small>{tag}</small><h2>{title}</h2></div><button>{action}</button></div>;
}
function DataTable({heads,rows,onRow}:{heads:string[];rows:string[][];onRow:()=>void}) {
  return <div className="dataTable">
    <div className="tableHead">{heads.map(h=><b key={h}>{h}</b>)}</div>
    {rows.map((r,i)=><button className="tableRow" key={i} onClick={onRow}>{r.map((c,j)=><span key={j} className={j===r.length-1?"statusCell":""}>{c}</span>)}</button>)}
  </div>;
}
