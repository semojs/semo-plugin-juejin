import * as juejin from "../../common/juejin";

export const disabled = false; // Set to true to disable this command temporarily
// export const plugin = '' // Set this for importing plugin config
export const command = "post [category] [tag] [sort]";
export const desc = "看掘金文章";
// export const aliases = ''
// export const middleware = (argv) => {}

export const builder = function (yargs: any) {
  yargs.option("uuid", {
    describe: "uuid 使用固定的标识符，不传会自动随机一个",
    default: "",
  });
  yargs.option("mdcat", {
    describe: "使用 mdcat 模式，需要先安装",
    alias: "M",
  });
  yargs.option("less", { describe: "使用 less 模式", alias: "L" });
  yargs.option("copy", { describe: "看文章的同时保存到剪贴板", alias: "C" });
  yargs.option("copy-only", {
    describe: "不看文章，只把文章保存到剪贴板就返回",
    alias: "O",
  });
};

export const handler = async function (argv: any) {
  argv.category = argv.category || "all";
  argv.tag = argv.tag || "all";
  argv.sort = argv.sort || "hot";
  argv.uuid = Math.random().toString().substring(2);
  await juejin.posts(argv.category, argv.tag, argv.sort, argv);
};
