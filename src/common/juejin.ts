import { Utils } from "@semo/core";
import got from "got";
import iterm2Version from "iterm2-version";
import terminalImage from "terminal-image";
import marked from "marked";
import TerminalRenderer from "marked-terminal";
import clipboardy from "clipboardy";
import inquirer from "inquirer";
import readline from "readline";
import read from "@vipzhichengfork/node-readability";
import util from "util";
import * as globalProcessHandler from "../process/global";
import * as juejinProcessHandler from "../process/juejin.im";

import TurndownService from "turndown";
import { tables } from "turndown-plugin-gfm";

import fuzzy from "fuzzy";
import InquirerAutucompletePrompt from "inquirer-autocomplete-prompt";
inquirer.registerPrompt("autocomplete", InquirerAutucompletePrompt);

import * as juejin from "./api";

const JUEJIN_PIN_RECOMMENDED_TOPIC_ID = 1;
const JUEJIN_PIN_HOT_TOPIC_ID = 2;
const JUEJIN_POST_RECOMMENDED_ALL_CATEGORY_ID = 1;
const JUEJIN_POST_RECOMMENDED_ALL_TAG_ID = 1;

const promiseRead = util.promisify(read);
const turndownService = new TurndownService({
  codeBlockStyle: "indented",
});
turndownService.use(tables);

const isGoon = async function () {
  const goon = await new Promise((resolve) => {
    // 用于跟踪连续按两次'g'的状态
    // let gPressedTwice = false;

    // 确保 stdin 处于流动状态
    if (process.stdin.isPaused()) {
      process.stdin.resume();
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    // 设置 raw 模式
    // 将标准输入设置为原始模式。在原始模式下，输入不会被行缓冲（即每次按键都会立即被程序读取，而不是等到按下回车键）
    process.stdin.setRawMode(true);

    // 移除之前的所有 keypress 监听器
    process.stdin.removeAllListeners("keypress");

    const listener = (str, key) => {
      if (key.ctrl && key.name === "c") {
        process.stdin.off("keypress", listener);
        rl.close();
        process.stdin.setRawMode(false);
        resolve("exit");
      } else if (!key.shift && !key.ctrl && !key.alt && key.name === "g") {
        // if (gPressedTwice) {
        //   // 移动光标到第一行
        //   readline.cursorTo(process.stdout, 0, 0);
        //   gPressedTwice = false;
        // } else {
        //   gPressedTwice = true;
        //   // 设置一个短暂的超时来重置 gPressedTwice 状态
        //   setTimeout(() => {
        //     gPressedTwice = false;
        //   }, 500); // 500ms 内按两次 g
        // }
      } else if (key.shift && key.name === "g") {
        // readline.cursorTo(process.stdout, 0, process.stdout.rows - 1);
      } else if (key.name === "j") {
        // readline.moveCursor(process.stdout, 0, 1);
      } else if (key.name === "k") {
        // readline.moveCursor(process.stdout, 0, -1);
      } else {
        if (["1", "2", "3", "4", "5", "6", "7", "8", "9"].includes(key.name)) {
          process.stdin.off("keypress", listener);
          rl.close();
          process.stdin.setRawMode(false);
          resolve(key.name);
        }
        if (key.name === "return" || key.name === "space" || key.name === "n") {
          process.stdin.off("keypress", listener);
          rl.close();
          process.stdin.setRawMode(false);
          resolve("next");
        }
        if (key.name === "r") {
          process.stdin.off("keypress", listener);
          rl.close();
          process.stdin.setRawMode(false);
          resolve("first");
        }

        if (key.name === "h") {
          process.stdin.off("keypress", listener);
          rl.close();
          process.stdin.setRawMode(false);
          resolve("help");
        }

        if (key.name === "p") {
          process.stdin.off("keypress", listener);
          rl.close();
          process.stdin.setRawMode(false);
          resolve("prev");
        }

        if (key.name === "q") {
          process.stdin.off("keypress", listener);
          rl.close();
          process.stdin.setRawMode(false);
          resolve("exit");
        }
      }
    };
    process.stdin.on("keypress", listener);
  });
  return goon;
};

export async function pins(topicKeyword, opts) {
  marked.setOptions({
    renderer: new TerminalRenderer(),
    unescapeEntities: false,
    color: true,
  });
  let topics = await juejin.getTopics();

  topics.unshift({
    topic_id: JUEJIN_PIN_HOT_TOPIC_ID,
    topic: {
      title: "热门沸点",
      short: "hot",
    },
  });

  topics.unshift({
    topic_id: JUEJIN_PIN_RECOMMENDED_TOPIC_ID,
    topic: {
      title: "推荐沸点",
      short: "recommend",
    },
  });

  let topicsFiltered: any[] = [];
  if (topicKeyword) {
    topicsFiltered = topics.filter((item) => {
      item.topic.short = item.topic.short || "";
      return (
        fuzzy.test(topicKeyword, item.topic.title) ||
        fuzzy.test(topicKeyword, item.topic.short)
      );
    });
  }

  let topic_id;
  if (topicsFiltered.length === 1) {
    topic_id = topicsFiltered[0].topic_id;
  } else if (topicsFiltered.length > 1) {
    topic_id = await chooseTopic(topicsFiltered);
  } else {
    if (topicKeyword) {
      Utils.warn("主题未找到!");
    }
    topic_id = await chooseTopic(topics);
  }

  let cursor = "0";
  let page = 1;
  let firstPinId;
  let lastCursor = "0";
  let isPrev = false;

  while (true) {
    let pins;
    if (topic_id === JUEJIN_PIN_RECOMMENDED_TOPIC_ID) {
      pins = await juejin.getRecommendedPins({ cursor });
    } else if (topic_id === JUEJIN_PIN_HOT_TOPIC_ID) {
      pins = await juejin.getHotPins({ cursor });
    } else {
      pins = await juejin.getPinsByTopic({ topic_id, cursor });
    }

    if (!firstPinId) {
      firstPinId = pins[0].msg_id;
    }
    const goon = await renderPins(topic_id, pins, opts, page, isPrev);
    if (goon === "first") {
      isPrev = false;
      cursor = "0";
      page = 1;
      continue;
    } else if (goon === "next") {
      isPrev = false;
      lastCursor = cursor;
      cursor = Buffer.from(
        JSON.stringify({ v: firstPinId, i: page++ * 20 })
      ).toString("base64");
    } else if (goon === "prev") {
      isPrev = cursor !== "0";
      page--;
      cursor = lastCursor;
    } else if (["1", "2", "3", "4", "5", "6", "7", "8", "9"].includes(goon)) {
      page = Number(goon);

      if (page === 1) {
        isPrev = false;
        cursor = "0";
        continue;
      } else {
        isPrev = false;
        lastCursor = cursor;
        cursor = Buffer.from(
          JSON.stringify({ v: firstPinId, i: (page - 1) * 20 })
        ).toString("base64");
      }
    } else if (goon === "exit") {
      process.exit(0);
    }
  }
}

async function renderPins(
  topic_id: string,
  pins: any[],
  opts,
  page,
  isPrev = false
) {
  Utils._.templateSettings.interpolate = /{{([\s\S]+?)}}/g;
  const template = `
## {{ user }}

在 \`{{ date }}\` 发布沸点于 \`{{ topic }}\`

{{ content }}{{ outLink }}

{{ images }}

@[第 {{ page }} 页 - 第 {{ pinCursor + 1 }} 条] {{ pinLink }}
`;

  let goon;
  let pinCursor = isPrev ? pins.length - 1 : 0;
  while (pinCursor < pins.length) {
    const chunkedPins = pins.slice(pinCursor, pinCursor + 1);
    const pinsRendered: any[] = [];
    for (let pin of chunkedPins) {
      pin.msg_Info.pic_list = pin.msg_Info.pic_list.map((image) =>
        image.replace(".image", ".png")
      );

      let title = "";
      if (pin.author_user_info.job_title || pin.author_user_info.company) {
        if (pin.author_user_info.job_title) {
          title += pin.author_user_info.job_title;
        }

        if (pin.author_user_info.company) {
          title += "@" + pin.author_user_info.company;
        }

        if (title) {
          title = " [" + title + "]";
        }
      }

      let images: any = "";
      if (opts.less || opts.mdcat || !itSupportTerminalImage()) {
        images = pin.msg_Info.pic_list
          .map((image) => `![](${image})`)
          .join("\n");
      } else {
        const imagesData = await Promise.all(
          pin.msg_Info.pic_list.map((image) =>
            (async function (image) {
              const body = await got(image).buffer();
              return await terminalImage.buffer(body, {
                width: "auto",
                height: "400px",
              });
            })(image)
          )
        );

        images = imagesData.join("\n\n");
      }

      pinsRendered.push(
        Utils._.template(template)({
          user: `[${pin.author_user_info.user_name}](https://juejin.cn/user/${pin.author_user_info.user_id}) [L${pin.author_user_info.level}]${title}`,
          date: Utils.day(pin.msg_Info.ctime * 1000).format("YYYY-MM-DD HH:mm"),
          content: pin.msg_Info.content.replace(/\[\d+(#.*#)\]/, "[$1]"),
          images,
          topic: `[${pin.topic.title}]`,
          pinLink: `[查看原文](https://juejin.cn/pin/${pin.msg_id})`,
          page,
          pinCursor,
          outLink: pin.msg_Info.url
            ? "\n\n===> " +
              `[${
                pin.msg_Info.url_title ? pin.msg_Info.url_title : "相关链接"
              }](${pin.msg_Info.url})` +
              " <==="
            : "",
        })
      );
    }

    if (opts.less) {
      pinsRendered.push("按 q 下一条, CTRL+c 退出");
      Utils.consoleReader(marked(pinsRendered.join("\n\n---\n\n")), {
        plugin: "semo-plugin-juejin",
        identifier: topic_id + "",
      });
      pinCursor++;
      goon = "next";
    } else if (opts.mdcat && Utils.shell.which("mdcat")) {
      Utils.clearConsole();
      pinsRendered.push(
        "按空格或回车下一条，按 q 或 CTRL+c 退出，按 h 查看帮助"
      );

      const tmpPath = Utils.consoleReader(pinsRendered.join("\n\n---\n\n"), {
        plugin: "semo-plugin-juejin",
        identifier: topic_id + "",
        tmpPathOnly: true,
      });

      try {
        Utils.exec(`mdcat ${tmpPath}`);
      } catch (e) {}
      Utils.fs.unlinkSync(tmpPath);

      console.log();

      goon = await isGoon();
      if (
        ["exit", "first", "1", "2", "3", "4", "5", "6", "7", "8", "9"].includes(
          goon
        )
      )
        return goon;
      if (goon === "prev") {
        if (pinCursor === 0) {
          return goon;
        }
        pinCursor--;
      } else if (goon === "next") {
        pinCursor++;
      } else if (goon === "help") {
        Utils.clearConsole();
        const helpLines: any[] = [];

        helpLines.push(`
| 操作 | 说明 |
| --- | --- |
| 空格/回车 | 下一条 |
| p | 上一条 |
| n | 下一条 |
| r | 重置为第1页第1条 |
| 1-9 | 快速跳转到1-9页 |
| h | 查看帮助, 退出帮助 |
| CTRL+c/q | 退出 |

        `);
        console.log(marked(helpLines.join("\n\n---\n\n")));

        goon = await isGoon();
        if (
          [
            "exit",
            "first",
            "1",
            "2",
            "3",
            "4",
            "5",
            "6",
            "7",
            "8",
            "9",
          ].includes(goon)
        )
          return goon;
        if (goon === "prev") {
          if (pinCursor === 0) {
            return goon;
          }
          pinCursor--;
        } else if (goon === "next") {
          pinCursor++;
        } else if (goon === "help") {
        }
      }
    } else {
      Utils.clearConsole();
      pinsRendered.push(
        "按空格或回车下一条，按 q 或 CTRL+c 退出，按 h 查看帮助"
      );
      console.log(marked(pinsRendered.join("\n\n---\n\n")));

      goon = await isGoon();
      if (
        ["exit", "first", "1", "2", "3", "4", "5", "6", "7", "8", "9"].includes(
          goon
        )
      )
        return goon;
      if (goon === "prev") {
        if (pinCursor === 0) {
          return goon;
        }
        pinCursor--;
      } else if (goon === "next") {
        pinCursor++;
      } else if (goon === "help") {
        Utils.clearConsole();
        const helpLines: any[] = [];

        helpLines.push(`
| 操作 | 说明 |
| --- | --- |
| 空格/回车 | 下一条 |
| p | 上一条 |
| n | 下一条 |
| r | 重置为第1页第1条 |
| 1-9 | 快速跳转到1-9页 |
| h | 查看帮助, 退出帮助 |
| CTRL+c/q | 退出 |

        `);
        console.log(marked(helpLines.join("\n\n---\n\n")));

        goon = await isGoon();
        if (
          [
            "exit",
            "first",
            "1",
            "2",
            "3",
            "4",
            "5",
            "6",
            "7",
            "8",
            "9",
          ].includes(goon)
        )
          return goon;
        if (goon === "prev") {
          if (pinCursor === 0) {
            return goon;
          }
          pinCursor--;
        } else if (goon === "next") {
          pinCursor++;
        } else if (goon === "help") {
        }
      }
    }
  }

  return goon;
}

async function chooseTopic(topics) {
  const selectTopic = await inquirer.prompt([
    {
      type: "autocomplete",
      name: "selected",
      message: `请选择一个主题: [支持模糊搜索]`,
      pageSize: 20,
      source: (answers, input) => {
        input = input || "";
        let i = 0;
        var fuzzyResult = fuzzy.filter(input, topics, {
          extract: (el: any) => {
            return String(++i).padStart(2, "0") + " " + el.topic.title;
          },
        });
        return fuzzyResult.map(function (el) {
          // console.log(el)
          return {
            name: el.string,
            value: el.original.topic_id,
          };
        });
      },
    },
  ]);

  return selectTopic.selected;
}

function itSupportTerminalImage() {
  if (process.env.TERM_PROGRAM === "iTerm.app") {
    const version: any = iterm2Version();
    return Number(version[0]) >= 3;
  }
  return false;
}

export async function posts(
  categoryKeyword = "",
  tagKeyword = "",
  sortKeyword = "",
  opts: any = {}
) {
  marked.setOptions({
    renderer: new TerminalRenderer(),
  });
  const categories = await juejin.getCategoryBriefs();
  categories.unshift({
    category_id: JUEJIN_POST_RECOMMENDED_ALL_CATEGORY_ID,
    category_name: "全站推荐",
    category_url: "all",
  });

  let categoriesFiltered: any[] = [];
  if (categoryKeyword) {
    categoriesFiltered = categories.filter((item) => {
      return (
        fuzzy.test(categoryKeyword, item.category_name) ||
        fuzzy.test(categoryKeyword, item.category_url)
      );
    });
  }

  let cate_id;
  if (categoriesFiltered.length === 1) {
    cate_id = categoriesFiltered[0].category_id;
  } else if (categoriesFiltered.length > 1) {
    cate_id = await chooseCategory(categoriesFiltered);
  } else {
    if (categoryKeyword) {
      Utils.warn("Category not found!");
    }
    cate_id = await chooseCategory(categories);
  }

  let tag_id;
  if (cate_id !== JUEJIN_POST_RECOMMENDED_ALL_CATEGORY_ID) {
    const tags = await juejin.getRecommendedTagList({
      cate_id,
    });

    tags.unshift({
      tag_id: JUEJIN_POST_RECOMMENDED_ALL_TAG_ID,
      tag_name: "全部",
      tag_key: "all",
    });

    let tagsFiltered: any[] = [];
    if (tagKeyword) {
      tagsFiltered = tags.filter((item) => {
        item.tag_key = item.tag_key || "";
        return (
          fuzzy.test(tagKeyword, item.tag_name) ||
          fuzzy.test(tagKeyword, item.tag_key)
        );
      });
    }

    if (tagsFiltered.length === 1) {
      tag_id = tagsFiltered[0].tag_id;
    } else if (tagsFiltered.length > 1) {
      tag_id = await chooseTag(tagsFiltered);
    } else {
      if (tagKeyword) {
        Utils.warn("Tag not found!");
      }
      tag_id = await chooseTag(tags);
    }
  }

  let sort_type = 200;
  const sorts = [
    {
      key: "hot",
      value: 200,
      name: "热门",
    },
    {
      key: "new",
      value: 300,
      name: "最新",
    },
    {
      key: "top3",
      value: 3,
      name: "3天热榜",
    },
    {
      key: "top7",
      value: 7,
      name: "7天热榜",
    },
    {
      key: "top-month",
      value: 30,
      name: "30天热榜",
    },
    {
      key: "top-all",
      value: 0,
      name: "全站热榜",
    },
  ];
  let sortsFiltered: any[] = [];
  if (sortKeyword) {
    sortsFiltered = sorts.filter((item) => {
      return (
        fuzzy.test(sortKeyword, item.name) || fuzzy.test(sortKeyword, item.key)
      );
    });
  }

  if (sortsFiltered.length === 1) {
    sort_type = sortsFiltered[0].value;
  } else if (sortsFiltered.length > 1) {
    sort_type = await chooseSortType(sortsFiltered);
  } else {
    if (sortKeyword) {
      Utils.warn("Sort type not found!");
    }
    sort_type = await chooseSortType(sorts);
  }

  let posts,
    cursor = "0";
  let data = await getPosts(cate_id, tag_id, sort_type, cursor, opts.uuid);
  posts = data.posts;
  cursor = data.cursor;

  posts.unshift({
    category: {
      category_name: "操作",
    },
    article_info: {
      article_id: 0,
      title: "下一页",
    },
  });
  while (true) {
    Utils.clearConsole();

    const post_id = await choosePost(posts);
    if (post_id === 0) {
      let data = await getPosts(cate_id, tag_id, sort_type, cursor, opts.uuid);
      cursor = data.cursor;
      posts = data.posts;

      posts.unshift({
        category: {
          category_name: "操作",
        },
        article_info: {
          article_id: 0,
          title: "下一页",
        },
      });
      continue;
    }

    // const { article_info } = await juejin.getPostDetail({
    //   article_id: post_id,
    // });

    const postUrl = `https://juejin.cn/post/${post_id}`;
    const article = await promiseRead(postUrl, {
      preserveUnlikelyCandidates: true,
      preprocess: function (source, response, contentType, callback) {
        // HTML 预处理
        const opts = {
          url: postUrl,
        };
        source = globalProcessHandler.preprocess(source, opts);
        try {
          source = juejinProcessHandler.preprocess(source, opts);
        } catch (e) {
          console.log(e);
          process.exit(1);
        }

        callback(null, source);
      },
    });
    if (!article.cache.body) {
      throw new Error("Parse failed, not a supported url!");
    }

    const template = turndownService.turndown(`${article.cache.body}

[查看原文](${postUrl})
`);
    if (opts.copyOnly || opts.copy) {
      clipboardy.writeSync(template);
    }

    if (!opts.copyOnly) {
      if (opts.mdcat && Utils.shell.which("mdcat")) {
        Utils.clearConsole();

        const tmpPath = Utils.consoleReader(
          template.replace(".image)", ".png)"),
          {
            plugin: "semo-plugin-juejin",
            identifier: post_id,
            tmpPathOnly: true,
          }
        );
        try {
          Utils.exec(`mdcat ${tmpPath}`);
        } catch (e) {}

        Utils.fs.unlinkSync(tmpPath);

        console.log();
        console.log("按回车返回, 按 q 或 CTRL+C 退出");

        process.stdin.resume();
        process.stdin.setEncoding("utf8");
        readline.emitKeypressEvents(process.stdin);
        const wasRaw = process.stdin.isRaw;
        if (process.stdin.isTTY && !wasRaw) process.stdin.setRawMode(true);
        const goon = await isGoon();
        process.stdin.setRawMode(wasRaw);
        if (goon === "exit") {
          process.exit(0);
        } else if (goon === "next") {
          continue;
        }
      } else if (opts.less) {
        try {
          Utils.consoleReader(marked(template), {
            plugin: "semo-plugin-juejin",
            identifier: post_id,
          });
        } catch (e) {}
      } else {
        Utils.clearConsole();
        const postList: any[] = [template];
        postList.push("按回车返回, 按 q 或 CTRL+C 退出");
        console.log(marked(postList.join("\n\n---\n\n")));

        const goon = await isGoon();
        if (goon === "exit") {
          process.exit(0);
        } else if (goon === "next") {
          continue;
        }
      }
    } else {
      Utils.success(`Copied to system clipboard successfully.`);
      return false;
    }
  }
}

async function choosePost(posts) {
  const selectPost = await inquirer.prompt([
    {
      type: "list",
      name: "selected",
      message: `请选择一篇文章: [j/k: 上/下移动 ^C: 退出]`,
      pageSize: 21,
      choices: posts
        .filter((el) => el.article_info || el.item_info.article_info)
        .map((el, i) => {
          el = el.item_info ? el.item_info : el;
          return {
            name:
              String(++i).padStart(2, "0") +
              " " +
              `[${el.category ? el.category.category_name : ""}${
                el.tags && el.tags[0] ? " / " + el.tags[0].tag_name : ""
              }] ` +
              el.article_info.title,
            value: el.article_info.article_id,
          };
        }),
    },
  ]);

  return selectPost.selected;
}

async function chooseSortType(sorts) {
  const selectSort = await inquirer.prompt([
    {
      type: "autocomplete",
      name: "selected",
      message: `请选择排序类型: [支持模糊搜索]`,
      pageSize: 20,
      source: (answers, input) => {
        input = input || "";
        let i = 0;
        var fuzzyResult = fuzzy.filter(input, sorts, {
          extract: (el: any) => {
            return String(++i).padStart(2, "0") + " " + el.name;
          },
        });
        return fuzzyResult.map(function (el) {
          return {
            name: el.string + ` (${el.original.key})`,
            value: el.original.value,
          };
        });
      },
    },
  ]);

  return selectSort.selected;
}

export async function getPosts(
  cate_id,
  tag_id = null,
  sort_type = 200,
  cursor = "0",
  uuid = "0"
) {
  let data = { posts: [], cursor: "0" };
  if (cate_id === JUEJIN_POST_RECOMMENDED_ALL_CATEGORY_ID) {
    data = await juejin.getRecommendedAllFeed({ sort_type, cursor, uuid });
  } else {
    if (tag_id === JUEJIN_POST_RECOMMENDED_ALL_TAG_ID) {
      data = await juejin.getRecommendedCateFeed({
        cate_id,
        sort_type,
        cursor,
      });
    } else {
      data = await juejin.getRecommendedCateTagFeed({
        cate_id,
        tag_id,
        sort_type,
        cursor,
      });
    }
  }

  return data;
}

async function chooseTag(tags) {
  const selectCategory = await inquirer.prompt([
    {
      type: "autocomplete",
      name: "selected",
      message: `请选择一个标签: [支持模糊搜索]]`,
      pageSize: 20,
      source: (answers, input) => {
        input = input || "";
        let i = 0;
        var fuzzyResult = fuzzy.filter(input, tags, {
          extract: (el: any) => {
            return String(++i).padStart(2, "0") + " " + el.tag_name;
          },
        });
        return fuzzyResult.map(function (el) {
          // console.log(el)
          return {
            name:
              el.string +
              `${el.original.tag_key ? " (" + el.original.tag_key + ")" : ""}`,
            value: el.original.tag_id,
          };
        });
      },
    },
  ]);

  return selectCategory.selected;
}

async function chooseCategory(categories) {
  const selectCategory = await inquirer.prompt([
    {
      type: "autocomplete",
      name: "selected",
      message: `请选择一个分类: [支持模糊搜索]`,
      pageSize: 20,
      source: (answers, input) => {
        input = input || "";
        let i = 0;
        var fuzzyResult = fuzzy.filter(input, categories, {
          extract: (el: any) => {
            return String(++i).padStart(2, "0") + " " + el.category_name;
          },
        });
        return fuzzyResult.map(function (el) {
          // console.log(el)
          return {
            name: el.string + ` (${el.original.category_url})`,
            value: el.original.category_id,
          };
        });
      },
    },
  ]);

  return selectCategory.selected;
}
