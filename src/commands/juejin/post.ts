import * as juejin from '../../common/juejin'

export const disabled = false // Set to true to disable this command temporarily
// export const plugin = '' // Set this for importing plugin config
export const command = 'post [category] [tag] [sort]'
export const desc = '看掘金文章'
// export const aliases = ''
// export const middleware = (argv) => {}

export const builder = function (yargs: any) {
  yargs.option('default', { describe: '参数使用默认值', alias: 'D', default: true })
  yargs.option('mdcat', { describe: '使用 mdcat 模式，需要先安装', alias: 'M' })
}

export const handler = async function (argv: any) {
  if (argv.default) {
    argv.category = argv.category || 'all'
    argv.tag = argv.tag || 'all'
    argv.sort = argv.sort || 'hot'
  }
  await juejin.posts(argv.category, argv.tag, argv.sort, argv)
}
