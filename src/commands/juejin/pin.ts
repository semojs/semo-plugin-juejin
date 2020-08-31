import { Utils } from '@semo/core'

import marked from 'marked'
import TerminalRenderer from 'marked-terminal'
marked.setOptions({
  renderer: new TerminalRenderer()
})

import fuzzy from 'fuzzy'
import InquirerAutucompletePrompt from 'inquirer-autocomplete-prompt'
Utils.inquirer.registerPrompt('autocomplete', InquirerAutucompletePrompt);

import * as juejin from '../../common/api'

export const disabled = false // Set to true to disable this command temporarily
// export const plugin = '' // Set this for importing plugin config
export const command = 'pin'
export const desc = 'pin'
// export const aliases = ''
// export const middleware = (argv) => {}

export const builder = function (yargs: any) {
  yargs.option('single', { describe: 'render one pin a time' })
  // yargs.commandDir('pins')
}

export const handler = async function (argv: any) {
  const topics = await juejin.getTopics()
  const topic_id = await chooseTopic(topics)
  let cursor = "0"
  let page = 1
  let firstPinId

  while (true) {
    const pins = await juejin.getPinsByTopic({ topic_id, cursor })
    if (!firstPinId) {
      firstPinId = pins[0].msg_id
    }
    renderPins(topic_id, pins, argv)
    cursor = Buffer.from(JSON.stringify({ v: firstPinId, i: (page++) * 20 })).toString('base64')
  }
}

function renderPins(topic_id: string, pins: any[], argv) {
  Utils._.templateSettings.interpolate = /{{([\s\S]+?)}}/g
  const template = `
## {{ user }} 在 {{ date }} 发布沸点 {{ topic }}

{{ content }}

{{ images }}
`
  const pinsRendered: any[] = []
  pins.forEach(pin => {

    let title = ''
    if (pin.author_user_info.job_title || pin.author_user_info.company) {
      if (pin.author_user_info.job_title) {
        title += pin.author_user_info.job_title
      }

      if (pin.author_user_info.company) {
        title += '@' + pin.author_user_info.company
      }

      if (title) {
        title = ' [' + title + ']'
      }
    }
    pinsRendered.push(Utils._.template(template)({
      user: `${pin.author_user_info.user_name} [L${pin.author_user_info.level}]${title}`,
      date: Utils.day(pin.msg_Info.ctime).format('YYYY-MM-DD HH:mm'),
      content: pin.msg_Info.content,
      images: pin.msg_Info.pic_list.map(image => `![](${image})`).join('\n'),
      topic: `[${pin.topic.title}]`
    }))
  })

  if (argv.single) {
    pinsRendered.forEach(pin => {
      Utils.consoleReader(marked(pin), {
        plugin: 'semo-plugin-juejin',
        identifier: topic_id
      })
    })
  } else {

    Utils.consoleReader(marked(pinsRendered.join('\n\n---\n\n')), {
      plugin: 'semo-plugin-juejin',
      identifier: topic_id
    })
  }
}

async function chooseTopic(topics) {
  const selectTopic = await Utils.inquirer.prompt([
    {
      type: 'autocomplete',
      name: 'selected',
      message: `Please choose a juejin topic to continue:`,
      pageSize: 20,
      source: (answers, input) => {
        input = input || '';
        let i = 0
        var fuzzyResult = fuzzy.filter(input, topics, {
          extract: (el:any) => {
            return String(++i).padStart(2, '0') + ' ' + el.topic.title
          }
        });
        return fuzzyResult.map(function (el) {
          // console.log(el)
          return {
            name: el.string,
            value: el.original.topic_id
          }
        })
      }
    }
  ])

  return selectTopic.selected
}