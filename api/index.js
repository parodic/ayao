// Vercel API - 带并发限制（最多3个IP同时使用密码线路）
let activeIPs = new Map();

export default async function handler(req, res) {
  const realSubscribeUrl = "https://git.yylx.win/raw.githubusercontent.com/parodic/tv/refs/heads/main/314.so";
  
  const pwd = req.query.pwd || req.query.password || req.query.pass || "";
  const clientIP = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();

  const now = Math.floor(Date.now() / 1000);

  // ==================== 90天体验线路（默认线路，无限制） ====================
  const experienceExpire = 1788307199;   // 2026年9月1日 23:59:59

  if (!pwd || pwd === "ty90days") {
    if (now > experienceExpire) {
      return res.status(200).send("❌ 90天体验专线已结束");
    }

    try {
      const response = await fetch(realSubscribeUrl);
      const content = await response.text();
      res.setHeader("Content-Type", response.headers.get("content-type") || "application/json");
      return res.status(200).send(content);
    } catch (e) {
      return res.status(503).send("体验专线加载失败，请稍后重试");
    }
  }

  // ==================== 密码保护专线 + 并发限制 ====================
  const passwordList = {
    "wah36186": { name: "👑王安华节点专线👑", expire: null },
    "gym03416": { name: "👑甘元明节点专线👑", expire: null },
    "lfy65490": { name: "👑鲁辅远节点专线👑", expire: null },
    "cny56856": { name: "👑陈年英节点专线👑", expire: null },
    "zsy15506": { name: "👑张素英节点专线👑", expire: null },
    "wxb81874": { name: "👑吴小兵节点专线", expire: null },
    "gyl25391": { name: "👑甘玉兰节点专线👑", expire: null },
    "zbr08625": { name: "👑张碧容节点专线👑", expire: null },
    "clq19053": { name: "👑陈烈琼节点专线👑", expire: null },
    "zwp14555": { name: "👑张卫平节点专线👑", expire: null },
    "ggb82555": { name: "👑甘国兵节点专线👑", expire: null },
    "pxl99161": { name: "👑彭晓莉节点专线👑", expire: null },
    "zztv666":  { name: "👑 栀子TV至尊VIP👑", expire: null }
  };

  if (pwd) {
    const user = passwordList[pwd];
    if (user) {
      // 检查是否过期
      if (user.expire !== null && user.expire < now) {
        return res.status(200).send(`❌ ${user.name} 已到期，请联系云逸续期`);
      }

      // ==================== 并发限制逻辑 ====================
      // 清理超时IP（超过60秒未活动视为断开）
      for (const [ip, timestamp] of activeIPs.entries()) {
        if (now - timestamp > 60) {
          activeIPs.delete(ip);
        }
      }

      // 如果已满3个IP，且当前IP不在列表中，则拒绝
      if (activeIPs.size >= 3 && !activeIPs.has(clientIP)) {
        return res.status(429).send("❌ 当前同时使用人数已达上限（3人），请稍后再试");
      }

      // 记录当前IP访问时间
      activeIPs.set(clientIP, now);

      // 执行订阅请求
      try {
        const response = await fetch(realSubscribeUrl);
        const content = await response.text();
        res.setHeader("Content-Type", response.headers.get("content-type") || "application/json");
        return res.status(200).send(content);
      } catch (e) {
        return res.status(503).send("订阅加载失败，请稍后重试");
      }
    }
  }

  // 默认返回
  return res.status(200).send("♈先锋影视专线🔐♈");
}