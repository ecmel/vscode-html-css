[![Marketplace Version](https://vsmarketplacebadge.apphb.com/version/ecmel.vscode-html-css.svg)](https://marketplace.visualstudio.com/items?itemName=ecmel.vscode-html-css)

# Visual Studio Code CSS Support for HTML Documents

Missing CSS support for HTML documents.

## Features

- Class attribute completion.
- Id attribute completion.
- Supports Zen Coding completion for class and id attributes.
- Scans workspace folder for css files.
- Supports optional resource.json file for fine tuned resource selection.
- Uses [vscode-css-languageservice](https://github.com/Microsoft/vscode-css-languageservice).

## Supported Languages

- html
- laravel-blade
- razor
- vue

## Optional resource.json

If a resource.json file is found in the root of the workspace, only files listed in the file will be used for class and id attribute completion.

### Example

```
{
  "css": {
    "site": [
      "node_modules/bootstrap/dist/css/bootstrap.css",
      "node_modules/font-awesome/css/font-awesome.css",
      "node_modules/awesome-bootstrap-checkbox/awesome-bootstrap-checkbox.css",
      "node_modules/select2/dist/css/select2.css",
      "node_modules/select2-bootstrap-theme/dist/select2-bootstrap.css"
    ],
    "style": [
      "src/main/resources/main/css/style.css"
    ]
  }
}
```

## Installation

[Visual Studio Code Marketplace](https://marketplace.visualstudio.com/items?itemName=ecmel.vscode-html-css)
