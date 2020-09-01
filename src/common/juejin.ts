
import { Utils } from '@semo/core'

import marked from 'marked'
import TerminalRenderer from 'marked-terminal'
marked.setOptions({
  renderer: new TerminalRenderer()
})

import fuzzy from 'fuzzy'
import InquirerAutucompletePrompt from 'inquirer-autocomplete-prompt'
Utils.inquirer.registerPrompt('autocomplete', InquirerAutucompletePrompt);

import * as juejin from './api'

import Prompt from 'prompt-sync'
const prompt = Prompt()

const JUEJIN_PIN_RECOMMENDED_TOPIC_ID = 1
const JUEJIN_PIN_HOT_TOPIC_ID = 2

export async function pins(topicKeyword, opts) {
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
  if (topicKeyword) {
    topicsFiltered = topics.filter(item => item.topic.title.indexOf(topicKeyword) > -1)
  }

  let topic_id
  if (topicsFiltered.length === 1) {
    topic_id = topicsFiltered[0].topic_id
  } else if (topicsFiltered.length > 1) {
    topic_id = await chooseTopic(topicsFiltered)
  } else {
    if (topicKeyword) {
      Utils.warn('Topic not found!')
    }
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
    const goon = renderPins(topic_id, pins, opts)
    if (!goon) {
      break;
    }
    cursor = Buffer.from(JSON.stringify({ v: firstPinId, i: (page++) * 20 })).toString('base64')
  }
}


function renderPins(topic_id: string, pins: any[], opts) {
  Utils._.templateSettings.interpolate = /{{([\s\S]+?)}}/g
  const template = `
## {{ user }}

在 \`{{ date }}\` 发布沸点于 \`{{ topic }}\`

{{ content }}{{ outLink }}

{{ images }}

{{ pinLink }}
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
      user: `[${pin.author_user_info.user_name}](https://juejin.im/user/${pin.author_user_info.user_id}) [L${pin.author_user_info.level}]${title}`,
      date: Utils.day(pin.msg_Info.ctime * 1000).format('YYYY-MM-DD HH:mm'),
      content: pin.msg_Info.content,
      images: pin.msg_Info.pic_list.map(image => `![](${image})`).join('\n'),
      topic: `[${pin.topic.title}]`,
      pinLink: `[查看原文](https://juejin.im/pin/${pin.msg_id})`,
      outLink: pin.msg_Info.url ? ('\n\n===> ' + `[${pin.msg_Info.url_title ? pin.msg_Info.url_title : '相关链接'}](${pin.msg_Info.url})` + ' <===' ) : ''
    }))
  })

  for (const pins of Utils._.chunk(pinsRendered, opts.size)) {
    if (!opts.less && Utils.shell.which('mdcat')) {
      const tmpPath = Utils.consoleReader(pins.join('\n\n---\n\n'), {
        plugin: 'semo-plugin-juejin',
        identifier: topic_id + '',
        // @ts-ignore
        tmpPathOnly: true
      })

      Utils.exec(`/usr/local/bin/mdcat ${tmpPath}`)

      console.log('\n---\n')
      const input = prompt('Continue？(Y/n) [enter to continue, ^C or n+enter to quit]: ', 'Y', {
        echo: ''
      })

      if (input === 'n' || Utils._.isNull(input)) return false
      console.log()
    } else {

      Utils.consoleReader(marked(pins.join('\n\n---\n\n')), {
        plugin: 'semo-plugin-juejin',
        identifier: topic_id + ''
      })
    }
  }

  return true
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