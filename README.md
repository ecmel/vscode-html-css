# Visual Studio Code CSS Support for HTML Documents

Missing CSS support for HTML documents.

## Features

- Class attribute completion.
- Id attribute completion.
- Supports Zen Coding completion for class and id attributes.
- Scans workspace folder for css and scss files.
- Supports remote css files.
- Uses [vscode-css-languageservice](https://github.com/Microsoft/vscode-css-languageservice).

## Supported Languages

Supported languages can be configured with the `css.enabledLanguages` configuration setting. By
default the following languages are enabled:

```json
"css.enabledLanguages": [
  "html",
  "laravel-blade",
  "razor",
  "vue",
  "pug",
  "jade",
  "handlebars",
  "php",
  "twig",
  "nunjucks",
  "javascriptreact",
  "typescriptreact",
  "HTML (EEx)"
]
```

## Remote Style Sheets

Remote style sheets can be specified in VS Code settings:

```json
"css.remoteStyleSheets": [
  "https://stackpath.bootstrapcdn.com/bootstrap/4.4.1/css/bootstrap.min.css"
]
```

## Style Sheet File Extensions

By default, `css` and `scss` files in the project are parsed. You may configure this in VS Code Settings

Remote style sheets can be specified in VS Code settings:

```json
"css.fileExtensions": [ "css", "scss"]
```

## Installation

[Visual Studio Code Marketplace](https://marketplace.visualstudio.com/items?itemName=ecmel.vscode-html-css)

## Usage

You can view a list of attributes via `ctrl + space`.
