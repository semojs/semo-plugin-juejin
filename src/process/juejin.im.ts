import * as cheerio from "cheerio";

export const preprocess = (html, argv) => {
  // 预解析，取文章的主要部分
  const $ = cheerio.load(html);
  const title = $(".article-title").html();
  let content = $(".article-viewer").html() || "";
  // 去掉一大段 css
  content = content.replace(/<style[\w\W]*?<\/style>/g, "");

  // 去掉网页复制代码功能带来的干扰
  content = content.replace(/<span class="copy-code-btn">(.*)<\/span>/g, "");
  content = `<h1>${title}</h1>

  ${content}`;
  content = content.replace(/<!--[\w\W]*?-->/g, "");
  return content;
};

export const postprocess = (markdown, argv) => {
  // 过滤掉锚点里的外链
  markdown = markdown.replace(
    /\[(.*?)\]\((.*?)#(.*?)\)/g,
    (match, p1, p2, p3) => {
      if (p2 === argv.url) {
        return `[${p1}](#${p3})`;
      }
      return match;
    }
  );

  return markdown;
};
