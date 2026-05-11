// api/sub.js  ——  部署到 Vercel /api/sub.js
// ✅ 改造点：体验专线从「固定日期截止」→「首次加载后 15 天动态计时」
// ✅ 依赖：Vercel KV（@vercel/kv）用于持久化首次访问时间戳
//    部署前请在 Vercel Storage 面板创建 KV 数据库并绑定本项目

import { kv } from "@vercel/kv";

// ─────────────────────────────────────────────
// 体验期配置
// ─────────────────────────────────────────────
const TRIAL_DURATION_SECONDS = 15 * 24 * 60 * 60; // 15 天
const MAX_CONCURRENT_IPS    = 3;                   // 密码专线最大并发 IP
const ADMIN_SECRET          = process.env.ADMIN_SECRET || ""; // Vercel 环境变量

// 密码专线并发 IP 追踪（Serverless 内存级，仅同实例有效；正式场景也可改用 KV）
let activeIPs = new Map();

export default async function handler(req, res) {
  const realSubscribeUrl =
    "https://gh-proxy.com/raw.githubusercontent.com/parodic/tv/refs/heads/main/314.so";

  const pwd = (
    req.query.pwd ||
    req.query.password ||
    req.query.pass ||
    ""
  ).trim();

  const clientIP = (
    req.headers["x-forwarded-for"] ||
    req.socket?.remoteAddress ||
    "unknown"
  )
    .split(",")[0]
    .trim();

  const now = Math.floor(Date.now() / 1000);

  // ─────────────────────────────────────────────
  //  用户密码表（pwd → 专属显示名称）
  // ─────────────────────────────────────────────
  const passwordList = {
    "wah36186": { name: "👑王安华节点专线👑", expire: null },
    "gym03416": { name: "👑甘元明节点专线👑", expire: null },
    "lfy65490": { name: "👑鲁辅远节点专线👑", expire: null },
    "cny56856": { name: "👑陈年英节点专线👑", expire: null },
    "zsy15506": { name: "👑张素英节点专线👑", expire: null },
    "wxb81874": { name: "👑吴小兵节点专线👑", expire: null },
    "gyl25391": { name: "👑甘玉兰节点专线👑", expire: null },
    "zbr08625": { name: "👑张碧容节点专线👑", expire: null },
    "clq19053": { name: "👑陈烈琼节点专线👑", expire: null },
    "zwp14555": { name: "👑张卫平节点专线👑", expire: null },
    "ggb82555": { name: "👑甘国兵VIP专线👑", expire: null },
    "pxl99161": { name: "👑彭晓莉VIP专线👑", expire: null },
    "zztv666":  { name: "👑栀子TV至尊VIP👑",  expire: null },
  };

  // ─────────────────────────────────────────────
  //  工具：抓取上游内容并注入专属名称
  // ─────────────────────────────────────────────
  async function fetchAndInjectName(userName, noticeOverride) {
    const response = await fetch(realSubscribeUrl, {
      headers: { "User-Agent": "okhttp/3.12.13" },
    });

    const contentType = response.headers.get("content-type") || "application/json";
    const rawText = await response.text();

    let jsonData;
    try {
      jsonData = JSON.parse(rawText);
    } catch {
      // 非 JSON（如 m3u 直播列表），直接透传
      res.setHeader("Content-Type", contentType);
      return res.status(200).send(rawText);
    }

    // 注入 notice（APP 启动弹窗）
    jsonData.notice = noticeOverride
      || `🎉 欢迎使用专属线路：${userName}\n⏰ 如需续期请联系管理员`;

    // 修改第一个 site name 标识身份
    if (Array.isArray(jsonData.sites) && jsonData.sites.length > 0) {
      const firstName = jsonData.sites[0].name || "";
      if (!firstName.startsWith("【")) {
        jsonData.sites[0].name = `【${userName}】` + firstName;
      }
    }

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).send(JSON.stringify(jsonData, null, 2));
  }

  // ═══════════════════════════════════════════════════════
  //  🔧 管理员接口：重置某 IP 的体验计时
  //  调用方式：GET /api/sub?action=reset_trial&ip=目标IP&secret=管理密钥
  //  不传 ip 参数则重置当前请求 IP
  // ═══════════════════════════════════════════════════════
  if (req.query.action === "reset_trial") {
    if (!ADMIN_SECRET || req.query.secret !== ADMIN_SECRET) {
      return res.status(403).json({ error: "Forbidden: invalid secret" });
    }
    const targetIP = (req.query.ip || clientIP).trim();
    const kvKey    = `trial:firstSeen:${targetIP}`;
    await kv.del(kvKey);
    return res.status(200).json({
      ok: true,
      message: `已重置 ${targetIP} 的体验计时，下次访问将重新开始 15 天`,
    });
  }

  // ═══════════════════════════════════════════════════════
  //  路由 1：体验专线（无密码 或 pwd=ty90days）
  //  ✅ 动态 15 天：以 clientIP 为 key，首次成功加载后写入时间戳
  // ═══════════════════════════════════════════════════════
  if (!pwd || pwd === "ty90days") {
    const kvKey = `trial:firstSeen:${clientIP}`;

    // 读取首次访问时间戳
    let firstSeen = await kv.get(kvKey); // 返回 number | null

    if (firstSeen !== null) {
      // ── 已有记录：检查是否超过 15 天 ──
      const elapsed      = now - Number(firstSeen);
      const remaining    = TRIAL_DURATION_SECONDS - elapsed;

      if (remaining <= 0) {
        // 体验期已到期
        return res.status(200).send(
          JSON.stringify({
            notice:
              "❌ 您的15天体验专线已到期，请联系管理员开通专属线路",
          })
        );
      }

      // 还在体验期内，计算剩余天数显示在 notice
      const remainingDays  = Math.ceil(remaining / 86400);
      const trialName      = "♈先锋影视体验专线♈";
      const noticeText     =
        `🎉 欢迎使用：${trialName}\n⏳您的体验期还剩 ${remainingDays} 天，到期后请联系管理员开通专属线路`;

      try {
        return await fetchAndInjectName(trialName, noticeText);
      } catch {
        return res.status(503).send("体验专线加载失败，请稍后重试");
      }

    } else {
      // ── 全新用户：先拉取内容，成功后再写入时间戳 ──
      const trialName  = "♈先锋影视体验专线♈";
      const noticeText =
        `🎉 欢迎首次使用：${trialName}\n⏳ 您的15天体验期现在开始计时，祝您使用愉快！`;

      try {
        // 先执行抓取，成功才计时（避免网络故障时白白消耗体验天数）
        const response = await fetch(realSubscribeUrl, {
          headers: { "User-Agent": "okhttp/3.12.13" },
        });
        const contentType = response.headers.get("content-type") || "application/json";
        const rawText = await response.text();

        // ✅ 成功拉取到内容 → 写入首次时间戳（仅此时才开始计时）
        await kv.set(kvKey, now);

        let jsonData;
        try {
          jsonData = JSON.parse(rawText);
        } catch {
          res.setHeader("Content-Type", contentType);
          return res.status(200).send(rawText);
        }

        jsonData.notice = noticeText;
        if (Array.isArray(jsonData.sites) && jsonData.sites.length > 0) {
          const firstName = jsonData.sites[0].name || "";
          if (!firstName.startsWith("【")) {
            jsonData.sites[0].name = `【${trialName}】` + firstName;
          }
        }

        res.setHeader("Content-Type", "application/json; charset=utf-8");
        return res.status(200).send(JSON.stringify(jsonData, null, 2));

      } catch {
        // 抓取失败 → 不写时间戳，不消耗体验天数
        return res.status(503).send("体验专线加载失败，请稍后重试");
      }
    }
  }

  // ═══════════════════════════════════════════════════════
  //  路由 2：密码专线 + 并发 IP 限制（最多 3 人同时）
  // ═══════════════════════════════════════════════════════
  const user = passwordList[pwd];

  if (!user) {
    return res.status(200).send(
      JSON.stringify({ notice: "♈先锋影视专线🔐♈" })
    );
  }

  // 检查是否过期
  if (user.expire !== null && user.expire < now) {
    return res.status(200).send(
      JSON.stringify({ notice: `❌ ${user.name} 已到期，请联系云逸续期` })
    );
  }

  // 清理超过 60 秒未活动的 IP
  for (const [ip, timestamp] of activeIPs.entries()) {
    if (now - timestamp > 60) activeIPs.delete(ip);
  }

  if (activeIPs.size >= MAX_CONCURRENT_IPS && !activeIPs.has(clientIP)) {
    return res.status(429).send(
      "❌ 当前同时使用人数已达上限（3人），请稍后再试"
    );
  }

  activeIPs.set(clientIP, now);

  try {
    return await fetchAndInjectName(user.name, null);
  } catch {
    return res.status(503).send("订阅加载失败，请稍后重试");
  }
}
