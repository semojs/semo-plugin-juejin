import * as api from '../common/api'
import * as juejin from '../common/juejin'
export = (Utils) => {
  return {
    hook_repl: new Utils.Hook('semo', () => {
      return {
        api, juejin
      }
    })
  }
}