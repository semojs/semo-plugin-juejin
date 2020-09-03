import { convertUrlToMarkdown, convertMarkdownToFile } from 'semo-plugin-read'
import { Utils } from '@semo/core'
import got from 'got'
import iterm2Version from 'iterm2-version'
import terminalImage from 'terminal-image'
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
const JUEJIN_POST_RECOMMENDED_ALL_CATEGORY_ID = 1
const JUEJIN_POST_RECOMMENDED_ALL_TAG_ID = 1

export async function pins(topicKeyword, opts) {
  let topics = await juejin.getTopics()

  topics.unshift({
    topic_id: JUEJIN_PIN_HOT_TOPIC_ID,
    topic: {
      title: '热门沸点',
      short: 'hot'
    }
  })

  topics.unshift({
    topic_id: JUEJIN_PIN_RECOMMENDED_TOPIC_ID,
    topic: {
      title: '推荐沸点',
      short: 'recommand'
    }
  })
  
  let topicsFiltered: any[] = []
  if (topicKeyword) {
    topicsFiltered = topics.filter(item => {
      return fuzzy.test(topicKeyword, item.topic.title)
        || fuzzy.test(topicKeyword, item.topic.short)
    })
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
    const goon = await renderPins(topic_id, pins, opts)
    if (!goon) {
      break;
    }
    cursor = Buffer.from(JSON.stringify({ v: firstPinId, i: (page++) * 20 })).toString('base64')
  }
}


async function renderPins(topic_id: string, pins: any[], opts) {
  Utils._.templateSettings.interpolate = /{{([\s\S]+?)}}/g
  const template = `
## {{ user }}

在 \`{{ date }}\` 发布沸点于 \`{{ topic }}\`

{{ content }}{{ outLink }}

{{ images }}

{{ pinLink }}
`
  

  for (const chunkedPins of Utils._.chunk(pins, opts.size)) {
    const pinsRendered: any[] = []
    for (let pin of chunkedPins) {
      pin.msg_Info.pic_list = pin.msg_Info.pic_list.map(image => image.replace('.image', '.png'))

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

      let images: any = ''
      if (opts.less || opts.mdcat || !itSupportTerminalImage()) {
        images = pin.msg_Info.pic_list.map(image => `![](${image})`).join('\n')
      } else {
        const imagesData = await Promise.all(pin.msg_Info.pic_list.map(image => (async function (image) {
          const body = await got(image).buffer()
          return terminalImage.buffer(body, { width: 'auto', height: 'auto' })
        })(image)))

        images = imagesData.join('\n\n')
      }


      pinsRendered.push(Utils._.template(template)({
        user: `[${pin.author_user_info.user_name}](https://juejin.im/user/${pin.author_user_info.user_id}) [L${pin.author_user_info.level}]${title}`,
        date: Utils.day(pin.msg_Info.ctime * 1000).format('YYYY-MM-DD HH:mm'),
        content: pin.msg_Info.content,
        images,
        topic: `[${pin.topic.title}]`,
        pinLink: `[查看原文](https://juejin.im/pin/${pin.msg_id})`,
        outLink: pin.msg_Info.url ? ('\n\n===> ' + `[${pin.msg_Info.url_title ? pin.msg_Info.url_title : '相关链接'}](${pin.msg_Info.url})` + ' <===' ) : ''
      }))
    }

    if (opts.less) {
      Utils.consoleReader(marked(pinsRendered.join('\n\n---\n\n')), {
        plugin: 'semo-plugin-juejin',
        identifier: topic_id + ''
      })
    } else if (opts.mdcat && Utils.shell.which('mdcat')) {
      Utils.clearConsole()

      const tmpPath = Utils.consoleReader(pinsRendered.join('\n\n---\n\n'), {
        plugin: 'semo-plugin-juejin',
        identifier: topic_id + '',
        tmpPathOnly: true
      })

      Utils.exec(`mdcat ${tmpPath}`)
      Utils.fs.unlinkSync(tmpPath)

      console.log()
      const input = prompt('Continue？[Y/n] [Press enter to continue, ^C or n+enter to quit]: ', 'Y', {
        echo: ''
      })

      if (input === 'n' || Utils._.isNull(input)) return false
      console.log()
    } else {
      Utils.clearConsole()

      console.log(marked(pinsRendered.join('\n\n---\n\n')))

      const input = prompt('Continue？[Y/n] [Press enter to continue, ^C or n+enter to quit]: ', 'Y', {
        echo: ''
      })

      if (input === 'n' || Utils._.isNull(input)) return false
      console.log()
      
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

function itSupportTerminalImage() {
  const version: any = iterm2Version()
  return process.env.TERM_PROGRAM === 'iTerm.app' && Number(version[0]) >= 3
}

export async function posts(categoryKeyword = '', tagKeyword = '', sortKeyword = '', opts: any = {}) {
  const categories = await juejin.getCategoryBriefs()
  categories.unshift({
    category_id: JUEJIN_POST_RECOMMENDED_ALL_CATEGORY_ID,
    category_name: '全站推荐',
    category_url: 'all'
  })

  let categoriesFiltered: any[] = []
  if (categoryKeyword) {
    categoriesFiltered = categories.filter(item => { 
      return fuzzy.test(categoryKeyword, item.category_name)
        || fuzzy.test(categoryKeyword, item.category_url)
    })
  }

  let cate_id
  if (categoriesFiltered.length === 1) {
    cate_id = categoriesFiltered[0].category_id
  } else if (categoriesFiltered.length > 1) {
    cate_id = await chooseCategory(categoriesFiltered)
  } else {
    if (categoryKeyword) {
      Utils.warn('Category not found!')
    }
    cate_id = await chooseCategory(categories)
  }

  let tag_id
  if (cate_id !== JUEJIN_POST_RECOMMENDED_ALL_CATEGORY_ID) {
    const tags = await juejin.getRecommendedTagList({
      cate_id
    })

    tags.unshift({
      tag_id: JUEJIN_POST_RECOMMENDED_ALL_TAG_ID,
      tag_name: '全部',
      tag_key: 'all'
    })

    let tagsFiltered: any[] = []
    if (tagKeyword) {
      tagsFiltered = tags.filter(item => {
        item.tag_key = item.tag_key || ''
        return fuzzy.test(tagKeyword, item.tag_name) || fuzzy.test(tagKeyword, item.tag_key)
      })
    }

    if (tagsFiltered.length === 1) {
      tag_id = tagsFiltered[0].tag_id
    } else if (tagsFiltered.length > 1) {
      tag_id = await chooseTag(tagsFiltered)
    } else {
      if (tagKeyword) {
        Utils.warn('Tag not found!')
      }
      tag_id = await chooseTag(tags)
    }
  }

  let sort_type = 200
  const sorts = [
    {
      key: 'hot',
      value: 200,
      name: '热门',
    },
    {
      key: 'new',
      value: 300,
      name: '最新',
    },
    {
      key: 'top3',
      value: 3,
      name: '3天热榜',
    },
    {
      key: 'top7',
      value: 7,
      name: '7天热榜',
    },
    {
      key: 'top-month',
      value: 30,
      name: '30天热榜',
    },
    {
      key: 'top-all',
      value: 0,
      name: '全站热榜',
    },
  ]
  let sortsFiltered: any[] = []
  if (sortKeyword) {
    sortsFiltered = sorts.filter(item => {
      return fuzzy.test(sortKeyword, item.name)
        || fuzzy.test(sortKeyword, item.key)
    })
  }

  if (sortsFiltered.length === 1) {
    sort_type = sortsFiltered[0].value
  } else if (sortsFiltered.length > 1) {
    sort_type = await chooseSortType(sortsFiltered)
  } else {
    if (sortKeyword) {
      Utils.warn('Sort type not found!')
    }
    sort_type = await chooseSortType(sorts)
  }

  let posts, cursor = '0'
  while (true) {
    let data = await getPosts(cate_id, tag_id, sort_type, cursor)
    posts = data.posts

    posts.unshift({
      category: {
        category_name: '系统功能'
      },
      article_info: {
        article_id: 0,
        title: '下一页'
      }
    })
    
    const post_id = await choosePost(posts)

    if (post_id === 0) {
      cursor = data.cursor
      continue
    }
  
    const url = `https://juejin.im/post/${post_id}`
    const converted = await convertUrlToMarkdown({ url })
  
    const { markdown, title } = converted
  
    if (opts.copy || opts.copyOnly) {
      await convertMarkdownToFile({
        format: 'clipboard',
        markdown,
        title,
        converted,
        argv: {
          url
        }
      })
    }
  
    if (!opts.copyOnly) {
      Utils.consoleReader(marked(markdown), {
        plugin: 'semo-plugin-juejin',
        identifier: post_id
      })
    }
  }
}

async function choosePost(posts) {
  const selectSort = await Utils.inquirer.prompt([
    {
      type: 'list',
      name: 'selected',
      message: `Please choose a Juejin post to continue:`,
      pageSize: 21,
      choices: posts.map((el, i) => {
        el = el.item_info ? el.item_info : el
        return {
          name: String(++i).padStart(2, '0') + ' ' + `[${el.category ? el.category.category_name : ''}${el.tags ? ' / ' + el.tags[0].tag_name : ''}] ` + el.article_info.title,
          value: el.article_info.article_id
        }
      })
    }
  ])

  return selectSort.selected
}

async function chooseSortType(sorts) {
  const selectSort = await Utils.inquirer.prompt([
    {
      type: 'autocomplete',
      name: 'selected',
      message: `Please choose a Juejin tag to continue:`,
      pageSize: 20,
      source: (answers, input) => {
        input = input || '';
        let i = 0
        var fuzzyResult = fuzzy.filter(input, sorts, {
          extract: (el:any) => {
            return String(++i).padStart(2, '0') + ' ' + el.name
          }
        });
        return fuzzyResult.map(function (el) {
          return {
            name: el.string + ` (${el.original.key})`,
            value: el.original.value
          }
        })
      }
    }
  ])

  return selectSort.selected
}

export async function getPosts(cate_id, tag_id = null, sort_type = 200, cursor = '0') {
  let data = { posts: [], cursor: '0' }
  if (cate_id === JUEJIN_POST_RECOMMENDED_ALL_CATEGORY_ID) {
    data = await juejin.getRecommendedAllFeed({ sort_type, cursor })
  } else {
    if (tag_id === JUEJIN_POST_RECOMMENDED_ALL_TAG_ID) {
      data = await juejin.getRecommendedCateFeed({ cate_id, sort_type, cursor })
    } else {
      data = await juejin.getRecommendedCateTagFeed({ cate_id, tag_id, sort_type, cursor })
    }
  }

  return data
}

async function chooseTag(tags) {
  const selectCategory = await Utils.inquirer.prompt([
    {
      type: 'autocomplete',
      name: 'selected',
      message: `Please choose a Juejin tag to continue:`,
      pageSize: 20,
      source: (answers, input) => {
        input = input || '';
        let i = 0
        var fuzzyResult = fuzzy.filter(input, tags, {
          extract: (el:any) => {
            return String(++i).padStart(2, '0') + ' ' + el.tag_name
          }
        });
        return fuzzyResult.map(function (el) {
          // console.log(el)
          return {
            name: el.string + `${el.original.tag_key ? ' (' + el.original.tag_key + ')' : ''}`,
            value: el.original.tag_id
          }
        })
      }
    }
  ])

  return selectCategory.selected
}

async function chooseCategory(categories) {
  const selectCategory = await Utils.inquirer.prompt([
    {
      type: 'autocomplete',
      name: 'selected',
      message: `Please choose a Juejin category to continue:`,
      pageSize: 20,
      source: (answers, input) => {
        input = input || '';
        let i = 0
        var fuzzyResult = fuzzy.filter(input, categories, {
          extract: (el:any) => {
            return String(++i).padStart(2, '0') + ' ' + el.category_name
          }
        });
        return fuzzyResult.map(function (el) {
          // console.log(el)
          return {
            name: el.string + ` (${el.original.category_url})`,
            value: el.original.category_id
          }
        })
      }
    }
  ])

  return selectCategory.selected
}