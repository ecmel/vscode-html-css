# Visual Studio Code CSS Intellisense for HTML

[![commit](https://github.com/ecmel/vscode-html-css/actions/workflows/commit.yml/badge.svg)](https://github.com/ecmel/vscode-html-css/actions/workflows/commit.yml)

HTML `id` and `class` attribute completion for Visual Studio Code.

## Features

- HTML `id` and `class` attribute completion
- Supports completion from in file defined styles
- Supports specifying remote and local style sheets
- Supports any language for completion
- Supports go to definition for selectors
- Validates class attributes on demand

## Supported Languages

Supported languages can be configured with the `css.enabledLanguages` global setting. By default `html` is enabled:

```json
{
  "css.enabledLanguages": ["html"]
}
```

Extension can be configured to support any language where it makes sense such as `nunjucks`, `twig`, `mustache`, `vue`, `typescript` etc. You should also install corresponding language extension which registers the specific language id in VS Code.

This setting is application scoped and changing the setting requires restarting VS Code.

## Specifying Style Sheets

Remote and local style sheets with optional glob patterns can be specified in VS Code settings per workspace folder in `.vscode/settings.json` and will suggest in all configured languages within that workspace folder.

Glob patterns for local style sheets can have the following syntax:

| Pattern | Matches                                               |
| ------- | ----------------------------------------------------- |
| `*`     | zero or more characters in a path segment             |
| `?`     | one character in a path segment                       |
| `**`    | any number of path segments, including none           |
| `{}`    | group conditions like `**​/*.{css,scss}`              |
| `[]`    | a range of characters like `[0-9]` or negate `[!0-9]` |

## Examples

Configuration depends on your layout of the project. The following most basic setting will suggest from all `css` files in project's `src` folder:

**`.vscode/settings.json`**

```json
{
  "css.styleSheets": ["src/**/*.css"]
}
```

### [Bootstrap](https://getbootstrap.com/)

If Bootstrap `npm` module is used with additional `scss` the following can be a starting point:

**`.vscode/settings.json`**

```json
{
  "css.styleSheets": [
    "node_modules/bootstrap/dist/css/bootstrap.css",
    "src/**/*.scss"
  ]
}
```

or in case of Bootstrap CDN with additional plain `css`:

**`.vscode/settings.json`**

```json
{
  "css.styleSheets": [
    "https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css",
    "src/**/*.css"
  ]
}
```

All of Bootstrap's class selectors with additional user defined styles in the project will be available for completion in `html` files.

### [Lit](https://lit.dev/)

Enable `typescript` or `javascript` in global settings depending on your usage and restart VS Code:

```json
{
  "css.enabledLanguages": ["html", "typescript"]
}
```

Component's [static styles](https://lit.dev/docs/components/styles/) will be available for completion elsewhere in the component. If you need to use some base styles in every component you can specify as follows:

**`.vscode/settings.json`**

```json
{
  "css.styleSheets": ["src/base-styles.ts"]
}
```

### [Vue](https://vuejs.org/)

Install your favorite Vue language extension from [Marketplace](https://marketplace.visualstudio.com/search?term=tag%3Avue&target=VSCode&category=All%20categories&sortBy=Relevance) which registers `vue` language id then enable `vue` in global settings and restart VS Code:

```json
{
  "css.enabledLanguages": ["html", "vue"]
}
```

Styles defined in component's `<style>` section will be available for completion in component's `<template>` section.

## Go to Definition

Go to definition for `id` and `class` selectors for local style sheets are supported. Selecting `Go to Definition` from context menu (`F12` or `⌘ click`) on a selector will open the local style sheet which the selector is defined.

## Commands

### Validate class selectors

Validates all `class` selectors in the active editor. Auto validation can be configured in extension settings globally or per workspace.

### Clear style sheets cache

Clears style sheets cache.

## Sponsor

- [Github Sponsors](https://github.com/sponsors/ecmel)
- [Buy me a coffee](https://www.buymeacoffee.com/ecmel)

## Installation

Extension can be installed from [Visual Studio Code Marketplace](https://marketplace.visualstudio.com/items?itemName=ecmel.vscode-html-css).
