// 抖音短链提取正则
const urlExtractRegex = /(https:\/\/v\.douyin\.com\/[a-zA-Z0-9]+\/?)/;

// 自动提取抖音短链接
function extractDouyinUrl(text: string): string | null {
  const match = urlExtractRegex.exec(text);
  return match ? match[1] : null;
}

const pattern = /"video":{"play_addr":{"uri":"([a-z0-9]+)"/;
const cVUrl =
  "https://www.iesdouyin.com/aweme/v1/play/?video_id=%s&ratio=1080p&line=0";
const statsRegex = /"statistics"\s*:\s*{([\s\S]*?)},/;
// 匹配昵称与签名
const regex = /"nickname":\s*"([^"]+)",\s*"signature":\s*"([^"]+)"/;
const ctRegex = /"create_time":\s*(\d+)/;
const descRegex = /"desc":\s*"([^"]+)"/;

interface DouyinVideoInfo {
  // ID
  aweme_id: string | null;
  // 评论数
  comment_count: number | null;
  // 点赞数
  digg_count: number | null;
  // 分享数
  share_count: number | null;
  // 收藏数
  collect_count: number | null;
  // 作者昵称
  nickname: string | null;
  // 作者签名
  signature: string | null;
  // 标题
  desc: string | null;
  // 创建时间
  create_time: string | null;
  // 视频链接
  video_url: string | null;
  // 类型
  type: string | null;
  // 图片链接列表
  image_url_list: string[] | null;
}

// 时间格式化
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// GET请求
async function doGet(url: string): Promise<Response> {
  const headers = new Headers();
  headers.set(
    "User-Agent",
    "Mozilla/5.0 (Linux; Android 11; SAMSUNG SM-G973U) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/14.2 Chrome/87.0.4280.141 Mobile Safari/537.36",
  );
  const resp = await fetch(url, { method: "GET", headers });
  return resp;
}

// 提取图片链接列表
async function parseImgList(body: string): Promise<string[]> {
  const content = body.replace(/\u002F/g, "/").replace(/\\/g, '/')
  const reg = /{"uri":"[^\s"]+","url_list":["(https:\/\/p\d{1,2}-sign\.douyinpic\.com\/.*?)"/g;
  const urlRet = /"uri":"([^\s"]+)","url_list":/g;
  let imgMatch;
  const firstUrls: string[] = [];
  while ((imgMatch = reg.exec(content)) !== null) {
    firstUrls.push(imgMatch[1]);
  }
  let urlMatch;
  const urlList: string[] = [];
  while ((urlMatch = urlRet.exec(content)) !== null) {
    urlList.push(urlMatch[1]);
  }
  const urlSet = new Set(urlList);
  const rList: string[] = [];
  for (let urlSetKey of urlSet) {
    let t = firstUrls.find((item) => {
      return item.includes(urlSetKey);
    });
    if (t) {
      rList.push(t);
    }
  }
  // 过滤掉包含 /obj/ 的链接
  const filteredRList = rList.filter(url => !url.includes("/obj/"));
  return filteredRList;
}

// 获取视频/图文信息的主方法
async function getVideoInfo(textOrUrl: string): Promise<DouyinVideoInfo> {
  // 新增：对杂乱文本先提取抖音短链
  const url = extractDouyinUrl(textOrUrl);
  if (!url) throw new Error("未检测到抖音短链接URL");
  let type = "video";
  let img_list: string[] = [];
  let video_url = "";
  const resp = await doGet(url);
  const body = await resp.text();
  const match = pattern.exec(body);
  if (!match || !match[1]) {
    type = "img";
  }
  if (type == "video") {
    video_url = cVUrl.replace("%s", match![1]);
  } else {
    img_list = await parseImgList(body);
  }
  const auMatch = body.match(regex);
  const ctMatch = body.match(ctRegex);
  const descMatch = body.match(descRegex);
  const statsMatch = body.match(statsRegex);
  if (statsMatch) {
    const innerContent = statsMatch[0];
    // 提取具体字段值
    const awemeIdMatch = innerContent.match(/"aweme_id"\s*:\s*"([^"]+)"/);
    const commentCountMatch = innerContent.match(/"comment_count"\s*:\s*(\d+)/);
    const diggCountMatch = innerContent.match(/"digg_count"\s*:\s*(\d+)/);
    const shareCountMatch = innerContent.match(/"share_count"\s*:\s*(\d+)/);
    const collectCountMatch = innerContent.match(/"collect_count"\s*:\s*(\d+)/);
    const douyinVideoInfo: DouyinVideoInfo = {
      aweme_id: awemeIdMatch ? awemeIdMatch[1] : null,
      comment_count: commentCountMatch ? parseInt(commentCountMatch[1]) : null,
      digg_count: diggCountMatch ? parseInt(diggCountMatch[1]) : null,
      share_count: shareCountMatch ? parseInt(shareCountMatch[1]) : null,
      collect_count: collectCountMatch ? parseInt(collectCountMatch[1]) : null,
      nickname: null,
      signature: null,
      desc: null,
      create_time: null,
      video_url: video_url,
      type: type,
      image_url_list: img_list,
    };
    if (auMatch) {
      douyinVideoInfo.nickname = auMatch[1];
      douyinVideoInfo.signature = auMatch[2];
    }
    if (ctMatch) {
      const date = new Date(parseInt(ctMatch[1]) * 1000);
      douyinVideoInfo.create_time = formatDate(date);
    }
    if (descMatch) {
      douyinVideoInfo.desc = descMatch[1];
    }
    // console.log(douyinVideoInfo);
    return douyinVideoInfo;
  } else {
    throw new Error("No stats found in the response.");
  }
}

// 只获取视频的原始ID
async function getVideoId(textOrUrl: string): Promise<string> {
  const url = extractDouyinUrl(textOrUrl);
  if (!url) throw new Error("未检测到抖音短链接URL");
  const resp = await doGet(url);
  const body = await resp.text();
  const match = pattern.exec(body);
  if (!match || !match[1]) throw new Error("Video ID not found in URL");
  return match[1];
}

// 只获取视频直链
async function getVideoUrl(textOrUrl: string): Promise<string> {
  const id = await getVideoId(textOrUrl);
  const downloadUrl = cVUrl.replace("%s", id);
  return downloadUrl;
}

// 导出
export { getVideoUrl, getVideoInfo, extractDouyinUrl };
