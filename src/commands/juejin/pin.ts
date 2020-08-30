import got from 'got'
import { Utils } from '@semo/core'

import fuzzy from 'fuzzy'
import InquirerAutucompletePrompt from 'inquirer-autocomplete-prompt'
Utils.inquirer.registerPrompt('autocomplete', InquirerAutucompletePrompt);


export const disabled = false // Set to true to disable this command temporarily
// export const plugin = '' // Set this for importing plugin config
export const command = 'pin'
export const desc = 'pin'
// export const aliases = ''
// export const middleware = (argv) => {}

export const builder = function (yargs: any) {
  // yargs.option('option', { default, describe, alias })
  // yargs.commandDir('pins')
}

export const handler = async function (argv: any) {
  const response: any = await got.post('https://apinew.juejin.im/tag_api/v1/query_topic_list', {
    json: { limit: 45, cursor: '0', sort_type: 7 },
    responseType: 'json'
  })

  const selectTopic = await Utils.inquirer.prompt([
    {
      type: 'autocomplete',
      name: 'selected',
      message: `Please choose a juejin topic to continue:`,
      pageSize: 20,
      source: (answers, input) => {
        


        input = input || '';
        let i = 0
        var fuzzyResult = fuzzy.filter(input, response.body.data, {
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

  console.log(selectTopic.selected)

}
