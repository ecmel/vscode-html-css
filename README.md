# Visual Studio Code CSS Intellisense for HTML

[![commit](https://github.com/ecmel/vscode-html-css/actions/workflows/commit.yml/badge.svg)](https://github.com/ecmel/vscode-html-css/actions/workflows/commit.yml)

HTML `id` and `class` attribute completion for Visual Studio Code.

## Features

- HTML `id` and `class` attribute completion
- Supports completion from in file styles
- Supports specifying remote and local style sheets
- Supports any language for completion
- Supports go to definition for selectors
- Validates class attributes on demand

## Usage

You can view a list of `id` and `class` attribute suggestions in configured languages.

## Specifying Style Sheets

Style sheets can be specified in VS Code settings per workspace folder in `.vscode/settings.json` and will suggest for all configured languages within that workspace folder.

### Example

**`.vscode/settings.json`**

```json
{
  "css.styleSheets": [
    "https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css",
    "node_modules/bootstrap/dist/css/bootstrap.css",
    "src/**/*.scss",
    "src/view/style.ts",
    "dist/style.css"
  ]
}
```

## Supported Languages

Supported languages can be configured with the `css.enabledLanguages` setting. By default `html` is enabled:

```json
{
  "css.enabledLanguages": ["html"]
}
```

Extension can be configured to support any language where it makes sense such as `nunjucks`, `twig`, `mustache`, `typescript` etc. You should also install corresponding language extension which registers the language id in VS Code.

This setting is application scoped and changing the setting requires restarting VS Code.

## Examples

Configuration depends on your layout of the project but some samples are below:

### Bootstrap

```json
{
  "css.enabledLanguages": ["html"]
}
```

```json
{
  "css.styleSheets": [
    "node_modules/bootstrap/dist/css/bootstrap.css",
    "src/**/*.css"
  ]
}
```

### Lit

```json
{
  "css.enabledLanguages": ["typescript"]
}
```

```json
{
  "css.styleSheets": ["src/view/style.ts"]
}
```

## Commands

### Validate selectors

Validates all `class` selectors in the active editor.

### Clear style cache

Clears style cache.

## Installation

Extension can be installed from [Visual Studio Code Marketplace](https://marketplace.visualstudio.com/items?itemName=ecmel.vscode-html-css).
