import * as api from '../common/api.js'
import * as juejin from '../common/juejin.js'

export const hook_repl = {
  semo: () => {
    return {
      api,
      juejin,
    }
  },
}
