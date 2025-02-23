import got from "got";

export async function getCategoryBriefs() {
  const response: any = await got.get(
    "https://api.juejin.cn/tag_api/v1/query_category_briefs?show_type=0",
    {
      responseType: "json",
    }
  );

  return response.body.data;
}

export async function getRecommendedAllFeed({
  id_type = 2,
  client_type = 2608,
  sort_type = 200,
  cursor = "0",
  limit = 20,
  uuid = "0",
} = {}) {
  const response: any = await got.post(
    `https://api.juejin.cn/recommend_api/v1/article/recommend_all_feed?aid=2608&spider=0&uuid=${uuid}`,
    {
      json: { id_type, client_type, limit, cursor, sort_type },
      responseType: "json",
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36",
      },
    }
  );
  return { posts: response.body.data, cursor: response.body.cursor };
}

export async function getRecommendedCateFeed({
  id_type = 2,
  sort_type = 200,
  cate_id = "",
  cursor = "0",
  limit = 20,
} = {}) {
  const response: any = await got.post(
    "https://api.juejin.cn/recommend_api/v1/article/recommend_cate_feed",
    {
      json: { id_type, limit, cursor, sort_type, cate_id },
      responseType: "json",
    }
  );

  return { posts: response.body.data, cursor: response.body.cursor };
}

export async function getRecommendedCateTagFeed({
  id_type = 2,
  sort_type = 200,
  cate_id = null,
  tag_id = null,
  cursor = "0",
  limit = 20,
} = {}) {
  const response: any = await got.post(
    "https://api.juejin.cn/recommend_api/v1/article/recommend_cate_tag_feed",
    {
      json: { id_type, limit, cursor, sort_type, cate_id, tag_id },
      responseType: "json",
    }
  );

  return { posts: response.body.data, cursor: response.body.cursor };
}

export async function getRecommendedTagList({ cate_id = "" }) {
  const response: any = await got.post(
    "https://api.juejin.cn/recommend_api/v1/tag/recommend_tag_list",
    {
      json: { cate_id },
      responseType: "json",
    }
  );

  return response.body.data;
}

export async function getPostDetail({ article_id }) {
  const response: any = await got.post(
    "https://api.juejin.cn/content_api/v1/article/detail",
    {
      json: {
        article_id,
        client_type: 2608,
        forbid_count: false,
        is_pre_load: false,
        need_theme: false,
        req_from: 1,
      },
      responseType: "json",
    }
  );

  return response.body.data;
}

export async function getTopics({
  limit = 45,
  cursor = "0",
  sort_type = 7,
} = {}) {
  const response: any = await got.post(
    "https://api.juejin.cn/tag_api/v1/query_topic_list",
    {
      json: { limit, cursor, sort_type },
      responseType: "json",
    }
  );

  return response.body.data;
}

export async function getPinsByTopic({
  id_type = 4,
  sort_type = 200,
  limit = 20,
  cursor = "0",
  topic_id = "",
} = {}) {
  const response: any = await got.post(
    "https://api.juejin.cn/recommend_api/v1/short_msg/topic",
    {
      json: { id_type, sort_type, limit, cursor, topic_id },
      responseType: "json",
    }
  );

  return response.body.data;
}

export async function getRecommendedPins({
  id_type = 4,
  sort_type = 300,
  cursor = "0",
  limit = 20,
} = {}) {
  const response: any = await got.post(
    "https://api.juejin.cn/recommend_api/v1/short_msg/recommend",
    {
      json: { id_type, sort_type, limit, cursor },
      responseType: "json",
    }
  );

  return response.body.data;
}

export async function getHotPins({
  id_type = 4,
  sort_type = 200,
  cursor = "0",
  limit = 20,
} = {}) {
  const response: any = await got.post(
    "https://api.juejin.cn/recommend_api/v1/short_msg/hot",
    {
      json: { id_type, sort_type, limit, cursor },
      responseType: "json",
    }
  );

  return response.body.data;
}
