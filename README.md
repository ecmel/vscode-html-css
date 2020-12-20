# Visual Studio Code CSS Support for HTML Documents

Missing `id` and `class` attribute completion support for HTML documents.

## Features

- HTML `id` attribute completion.
- HTML `class` attribute completion.
- Supports linked `[<link rel="stylesheet">]` and embedded `[<style></style>]` style sheets.
- Supports template inheritance.
- Supports additional style sheets.
- Supports other HTML like languages.

## Linked and Embedded Style Sheets

In the following HTML file, completion will suggest for all `id` and `class` attributes. All
local links point to the same file which is in the root of workspace folder.

**`index.html`**
```html
<!DOCTYPE html>
<html>

<head>
    <!-- (1) Remote style sheet -->
    <link rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/bootstrap@4.5.3/dist/css/bootstrap.min.css">

    <!-- (2) Local style sheet relative to workspace folder -->
    <link rel="stylesheet" href="/site.css">

    <!-- (3) Local style sheet relative to this file -->
    <link rel="stylesheet" href="site.css">

    <!-- (4) Local style sheet relative to this file -->
    <link rel="stylesheet" href="./site.css">
    
    <!-- (5) Embedded style sheet -->
    <style>
        #content {
            display: block;
        }

        .internal {
            display: block;
        }
    </style>
</head>

<body>
    <div class="container external internal" id="content">
        <div class="row">
            <div class="col">1 of 2</div>
            <div class="col">2 of 2</div>
        </div>
    </div>
</body>

</html>
```

**`site.css`**
```css
.external {
    display: block;
}
```

## Template Inheritance

Template inheritance is supported for `{% extends "base" %}` and `{{< base }}` tags. 

## Additional Style Sheets

If it is not possible to specify local or remote styles within each HTML file or via template inheritance, they can be specified in VS Code settings per workspace folder in `.vscode/settings.json` and will suggest for all HTML files within that workspace folder.

**`.vscode/settings.json`**
```js
"css.styleSheets": [

  // (1)
  "https://cdn.jsdelivr.net/npm/bootstrap@4.5.3/dist/css/bootstrap.min.css",

  // (2)
  "/site.css",

  // (3)
  "site.css",

  // (4)
  "./site.css"
]
```

## Supported Languages

Supported languages can be configured with the `css.enabledLanguages` setting. By default 
`html` is enabled.

```json
"css.enabledLanguages": [
  "html"
]
```

Extension can be configured to support any language where it makes sense such as `nunjucks`, `twig`, `mustache`, etc. You should also install corresponding language extension which registers choosen language id in VS Code.

This setting is application scoped so it should be set in global settings and changing the 
setting requires restarting VS Code.

## Installation

[Visual Studio Code Marketplace](https://marketplace.visualstudio.com/items?itemName=ecmel.vscode-html-css)

## Usage

You can view a list of class and id attributes via `ctrl + space`. Note that, extension will be activated a few seconds after VS Code starts.
