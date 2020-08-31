import got from 'got'

export async function getTopics({ limit = 45, cursor = '0', sort_type = 7 } = {}) {
  const response: any = await got.post('https://apinew.juejin.im/tag_api/v1/query_topic_list', {
    json: { limit, cursor, sort_type },
    responseType: 'json'
  })

  return response.body.data
}

export async function getPinsByTopic({ id_type = 4, sort_type = 200, limit = 20, cursor = "0", topic_id = "" } = {}) {
  const response: any = await got.post('https://apinew.juejin.im/recommend_api/v1/short_msg/topic', {
    json: { id_type, sort_type, limit, cursor, topic_id},
    responseType: 'json'
  })

  return response.body.data
}