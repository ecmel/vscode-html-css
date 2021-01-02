# Visual Studio Code CSS Intellisense for HTML

HTML `id` and `class` attribute completion and validation for Visual Studio Code.

## Features

- HTML `id` and `class` attribute completion and validation.
- Supports linked and embedded style sheets.
- Supports template inheritance.
- Supports additional style sheets.
- Supports other HTML like languages.

## Usage

You can view a list of `id` and `class` attribute suggestions via `ctrl + space`. Invalid `class` selectors will be shown as warnings, `id` selectors will be shown as information.

## Linked and Embedded Style Sheets

Linked `[<link rel="stylesheet">]` and embedded `[<style></style>]` style sheets are used in completion for `id` and `class` attributes. Links support local and remote files. Absolute local file paths are relative to the workspace folder while others are relative to HTML file:

**`index.html`**
```html
<!DOCTYPE html>
<html>

<head>
    <!-- (1) Remote style sheet -->
    <link rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/bootstrap@4.5.3/dist/css/bootstrap.min.css">

    <!-- (2) Local style sheet relative to workspace folder -->
    <link rel="stylesheet" href="/style.css">

    <!-- (3) Local style sheet relative to this file -->
    <link rel="stylesheet" href="style.css">

    <!-- (4) Local style sheet relative to this file -->
    <link rel="stylesheet" href="./style.css">
    
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
All local links point to the same file which is in the root of workspace folder:

**`style.css`**
```css
.external {
    display: block;
}
```

## Template Inheritance

Template inheritance is supported for the following tags:

```
{% extends "base" %}

@extends('base')

{{< base }}
```

Only one level of inheritance is supported:

**`base.html`**
```html
<!doctype html>
<html>

<head>
    <link rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/bootstrap@4.5.3/dist/css/bootstrap.min.css">

    <style>
        #content {
            display: block;
        }

        .internal {
            display: block;
        }
    </style>

    <title>{{ title }}</title>
</head>

<body>
    {% block content %}{% endblock %}
</body>

</html>
```

Styles defined in `base.html` will also be available for completion in `home.html`:

**`home.html`**
```html
{% extends "base" %}

{% block content %}
<div id="content" class="container internal">
    <h1>Home</h1>
</div>
{% endblock %}
```

## Additional Style Sheets

If it is not possible to specify local or remote styles in HTML or via template inheritance, they can be specified in VS Code settings per workspace folder in `.vscode/settings.json` and will suggest for all HTML files within that workspace folder:

**`.vscode/settings.json`**
```json
{
    "css.styleSheets": [
        "https://cdn.jsdelivr.net/npm/bootstrap@4.5.3/dist/css/bootstrap.min.css",
        "/style.css",
        "style.css",
        "./style.css"
    ]
}
```

This configuration is same as the [first](#linked-and-embedded-style-sheets) example. All relative paths will be evaluated relative to the HTML file being edited.

## Selector Validation

Validated selectors can be configured with the `css.validation` setting. By default `class` selectors are validated:

```json
{
    "css.validation": {
        "id": false,
        "class": true
    }
}
```

## Supported Languages

Supported languages can be configured with the `css.enabledLanguages` setting. By default `html` is enabled:

```json
{
    "css.enabledLanguages": [
        "html"
    ]
}
```

Extension can be configured to support any language where it makes sense such as `nunjucks`, `twig`, `mustache`, etc. You should also install corresponding language extension which registers the language id in VS Code.

This setting is application scoped and changing the setting requires restarting VS Code.

## Installation

Extension can be installed from [Visual Studio Code Marketplace](https://marketplace.visualstudio.com/items?itemName=ecmel.vscode-html-css).
