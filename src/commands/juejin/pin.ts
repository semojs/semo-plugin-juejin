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

const JUEJIN_PIN_RECOMMENDED_TOPIC_ID = 1
const JUEJIN_PIN_HOT_TOPIC_ID = 2

export const disabled = false // Set to true to disable this command temporarily
// export const plugin = '' // Set this for importing plugin config
export const command = 'pin [topicKeyword]'
export const desc = 'View Juejin pins.'
// export const aliases = ''
// export const middleware = (argv) => {}

export const builder = function (yargs: any) {
  yargs.option('size', { default: 20, describe: 'The number of pins a time, should be 1, 2, 4, 5, 10, 20', alias: 'S', choices: [1, 2, 4, 5, 10, 20] })
}

export const handler = async function (argv: any) {
  let topics = await juejin.getTopics()

  topics.unshift({
    topic_id: JUEJIN_PIN_HOT_TOPIC_ID,
    topic: {
      title: '热门沸点'
    }
  })

  topics.unshift({
    topic_id: JUEJIN_PIN_RECOMMENDED_TOPIC_ID,
    topic: {
      title: '推荐沸点'
    }
  })
  
  let topicsFiltered: any[] = []
  if (argv.topicKeyword) {
    topicsFiltered = topics.filter(item => item.topic.title.indexOf(argv.topicKeyword) > -1)
  }

  let topic_id
  if (topicsFiltered.length === 1) {
    topic_id = topicsFiltered[0].topic_id
  } else if (topicsFiltered.length > 1) {
    topic_id = await chooseTopic(topicsFiltered)
  } else {
    Utils.warn('Topic not found!')
    topic_id = await chooseTopic(topics)
  }

  let cursor = "0"
  let page = 1
  let firstPinId

  while (true) {
    let pins 
    if (topic_id === JUEJIN_PIN_RECOMMENDED_TOPIC_ID) {
      pins = await juejin.getRecommendedPins({ cursor })
    } else if (topic_id === JUEJIN_PIN_HOT_TOPIC_ID) {
      pins = await juejin.getHotPins({ cursor })
    } else {
      pins = await juejin.getPinsByTopic({ topic_id, cursor })
    }

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
## [{{ user }}]({{ userLink }})

在 \`{{ date }}\` 发布沸点于 \`{{ topic }}\`

{{ content }}

{{ images }}

[查看原文]({{ pinLink }})
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
      date: Utils.day(pin.msg_Info.ctime * 1000).format('YYYY-MM-DD HH:mm'),
      content: pin.msg_Info.content,
      images: pin.msg_Info.pic_list.map(image => `![](${image})`).join('\n'),
      topic: `[${pin.topic.title}]`,
      pinLink: `https://juejin.im/pin/${pin.msg_id}`,
      userLink: `https://juejin.im/user/${pin.author_user_info.user_id}`
    }))
  })

  Utils._.chunk(pinsRendered, argv.size).forEach(pins => {
    Utils.consoleReader(marked(pins.join('\n\n---\n\n')), {
      plugin: 'semo-plugin-juejin',
      identifier: topic_id + ''
    })
  })
}

async function chooseTopic(topics) {
  const selectTopic = await Utils.inquirer.prompt([
    {
      type: 'autocomplete',
      name: 'selected',
      message: `Please choose a Juejin topic to continue:`,
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