# Visual Studio Code CSS Support for HTML Documents

Missing CSS support for HTML documents.

## Features

- HTML `class` attribute completion.
- HTML `id` attribute completion.
- Supports completion from `<link rel="stylesheet">` and `<style></style>` tags.
- Supports completion from additional style sheets.

## Example

In the following HTML file, completion will suggest for all `id` and `class` attributes.

#### **`index.html`**
```html
<!DOCTYPE html>
<html>

<head>
    <!-- (1) -->
    <link
        href="https://cdn.jsdelivr.net/npm/bootstrap@4.5.3/dist/css/bootstrap.min.css"
        rel="stylesheet">

    <!-- (2) -->
    <link href="site.css" rel="stylesheet">
    <link href="./site.css" rel="stylesheet">
    <link href="/site.css" rel="stylesheet">

    <!-- (3) -->
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

#### **`site.css`**
```css
.external {
    display: block;
}
```

1. External style sheet which will be fetched from `href`.
2. Local style sheets which are all equivalent and points to `site.css` file in the root of workspace folder.
3. Embedded style.

If it is not possible to specify local or remote styles within each HTML file, they can be specified in VS Code settings per workspace folder in `.vscode/settings.json` and will suggest for all HTML files within that workspace folder:

#### **`.vscode/settings.json`**
```js
"css.styleSheets": [

  // (1)
  "https://cdn.jsdelivr.net/npm/bootstrap@4.5.3/dist/css/bootstrap.min.css",

  // (2)
  "site.css",
  "./site.css",
  "/site.css"
]
```

## Supported Languages

Supported languages can be configured with the `css.enabledLanguages` setting. By default 
`html` is enabled:

```json
"css.enabledLanguages": [
  "html"
]
```

Extension can be configured to support any language where it makes sense such as `handlebars`, 
`php`, `javascriptreact`, `nunjucks` etc. You should install corresponding language extension
which registers choosen language id in VS Code.

This setting is application scoped so it should be set in global settings.

## Installation

[Visual Studio Code Marketplace](https://marketplace.visualstudio.com/items?itemName=ecmel.vscode-html-css)

## Usage

You can view a list of class and id attributes via `ctrl + space`.
