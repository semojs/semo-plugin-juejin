import * as juejin from "../../common/juejin";
import readline from "readline";

export const disabled = false; // Set to true to disable this command temporarily
// export const plugin = '' // Set this for importing plugin config
export const command = ["$0 [topic]", "pin [topic]"];
export const desc = "看掘金沸点";
// export const aliases = ''
// export const middleware = (argv) => {}

export const builder = function (yargs: any) {
  yargs.option("less", { describe: "使用 less 模式", alias: "L" });
  yargs.option("mdcat", {
    describe: "使用 mdcat 模式，需要先安装",
    alias: "M",
  });
};

export const handler = async function (argv: any) {
  argv.topic = argv.topic || "recommend";

  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  readline.emitKeypressEvents(process.stdin);

  await juejin.pins(argv.topic, argv);
};
