import * as juejin from '../../common/juejin'

export const disabled = false // Set to true to disable this command temporarily
// export const plugin = '' // Set this for importing plugin config
export const command = 'pin [topicKeyword]'
export const desc = 'View Juejin pins.'
// export const aliases = ''
// export const middleware = (argv) => {}

export const builder = function (yargs: any) {
  yargs.option('size', { default: 1, describe: 'The number of pins a time, should be 1, 2, 4, 5, 10, 20', alias: 'S', choices: [1, 2, 4, 5, 10, 20] })
  yargs.option('less', { describe: 'Force use less mode.' })
  yargs.option('mdcat', { describe: 'Force use mdcat mode, you need to install mdcat.' })
}

export const handler = async function (argv: any) {
  await juejin.pins(argv.topicKeyword, argv)
}
