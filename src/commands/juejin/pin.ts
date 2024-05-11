import * as juejin from "../../common/juejin";
import readline from "readline";

export const disabled = false; // Set to true to disable this command temporarily
// export const plugin = '' // Set this for importing plugin config
export const command = ["$0 [topic]", "pin [topic]"];
export const desc = "看掘金沸点";
// export const aliases = ''
// export const middleware = (argv) => {}

export const builder = function (yargs: any) {
  yargs.option("size", {
    default: 1,
    describe: "每次看几条沸点，默认一条",
    alias: "S",
    choices: [1, 2, 4, 5, 10, 20],
  });
  yargs.option("less", { describe: "使用 less 模式", alias: "L" });
  yargs.option("mdcat", {
    describe: "使用 mdcat 模式，需要先安装",
    alias: "M",
  });
  yargs.option("default", {
    describe: "参数使用默认值",
    alias: "D",
    default: true,
    boolean: true,
  });
};

export const handler = async function (argv: any) {
  if (argv.default) {
    argv.topic = argv.topic || "recommend";
  }

  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  readline.emitKeypressEvents(process.stdin);

  await juejin.pins(argv.topic, argv);
};
