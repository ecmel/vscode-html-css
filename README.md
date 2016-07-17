# vscode-html-css

CSS support in HTML documents.

## Features

- Style tag completion and hover.
- Style attribute completion and hover.
- Class attribute completion.
- Scans workspace folder for css files.
- Supports optional resource.json file for fine tuned resource selection.
- Uses [vscode-css-languageservice](https://github.com/Microsoft/vscode-css-languageservice).

## resource.json

If a resource.json file is found in the root of the workspace, only files listed in the file will be used.

### Example:

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
