import type {
  Plugin,
  ParserOptions,
  PathSupportOption,
  BooleanSupportOption,
  StringArraySupportOption,
  PathArraySupportOption
} from "prettier"
import { parsers as babelParsers } from "prettier/plugins/babel"
import { parsers as flowParsers } from "prettier/plugins/flow"
import { parsers as typescriptParsers } from "prettier/plugins/typescript"

import type { PrettierOptions } from "./types"
import { preprocess } from "./preprocess"

const options: Record<
  Exclude<keyof PrettierOptions, keyof ParserOptions>,
  | PathSupportOption
  | BooleanSupportOption
  | StringArraySupportOption
  | PathArraySupportOption
> = {
  importOrder: {
    type: "path",
    category: "Global",
    array: true,
    default: [{ value: [] }],
    description: "Provide an order to sort imports."
  },
  importOrderCaseInsensitive: {
    type: "boolean",
    category: "Global",
    default: false,
    description: "Provide a case sensitivity boolean flag"
  },
  importOrderParserPlugins: {
    type: "path",
    category: "Global",
    array: true,
    // By default, we add ts and jsx as parsers but if users define something
    // we take that option
    default: [{ value: ["typescript", "jsx"] }],
    description: "Provide a list of plugins for special syntax"
  },
  importOrderSeparation: {
    type: "boolean",
    category: "Global",
    default: false,
    description: "Should imports be separated by new line?"
  },
  importOrderGroupNamespaceSpecifiers: {
    type: "boolean",
    category: "Global",
    default: false,
    description:
      "Should namespace specifiers be grouped at the top of their group?"
  },
  importOrderSortSpecifiers: {
    type: "boolean",
    category: "Global",
    default: false,
    description: "Should specifiers be sorted?"
  },
  importOrderBuiltinModulesToTop: {
    type: "boolean",
    category: "Global",
    default: false,
    description: "Should node-builtins be hoisted to the top?"
  },
  importOrderMergeDuplicateImports: {
    type: "boolean",
    category: "Global",
    default: false,
    description: "Should duplicate imports be merged?"
  }
}

export default {
  parsers: {
    babel: {
      ...babelParsers.babel,
      preprocess
    },
    flow: {
      ...flowParsers.flow,
      preprocess
    },
    typescript: {
      ...typescriptParsers.typescript,
      preprocess
    }
  },
  options
} as Plugin
