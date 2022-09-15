/**
 * @type {import('prettier').Options}
 */
module.exports = {
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  semi: false,
  singleQuote: false,
  trailingComma: "none",
  bracketSpacing: true,
  bracketSameLine: true,
  plugins: [require("./dist/index.js")],
  importOrder: ["^@plasmo/(.*)$", "^@plasmohq/(.*)$", "^~(.*)$", "^[./]"],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true
}