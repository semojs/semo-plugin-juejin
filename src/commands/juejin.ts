export const disabled = false // Set to true to disable this command temporarily
// export const plugin = '' // Set this for importing plugin config
export const command = 'juejin [op]'
export const desc = '掘金命令行客户端[非官方]'
// export const aliases = ''
// export const middleware = (argv) => {}

export const builder = function (yargs: any) {
  // yargs.option('option', { default, describe, alias })
  yargs.commandDir('juejin')
  yargs.default('op', 'pin')
}

export const handler = async function (_argv: any) {}
