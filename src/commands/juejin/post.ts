import * as juejin from '../../common/juejin'

export const disabled = false // Set to true to disable this command temporarily
// export const plugin = '' // Set this for importing plugin config
export const command = 'post [categoryKeyword] [tagKeyword] [sortKeyword]'
export const desc = 'View Juejin posts'
// export const aliases = ''
// export const middleware = (argv) => {}

export const builder = function (yargs: any) {
  // yargs.option('option', { default, describe, alias })
  // yargs.commandDir('post')
}

export const handler = async function (argv: any) {
  argv.categoryKeyword = argv.categoryKeyword || 'all'
  argv.tagKeyword = argv.tagKeyword || 'all'
  argv.sortKeyword = argv.sortKeyword || 'hot'
  await juejin.posts(argv.categoryKeyword, argv.tagKeyword, argv.sortKeyword, argv)
}
