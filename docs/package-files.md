---
nav: LaTeX package files
description: Extend IntelliSense in Texpile for unknown LaTeX packages with package files in LaTeX Workshop's format.
blurb: Extends IntelliSense for unknown LaTeX packages.
icon: package
order: 36.6
section: Advanced
---

# LaTeX package files

Extends IntelliSense for unknown LaTeX packages.

Texpile by default supports a wide range of completion for LaTeX packages. However, for the less common ones, you will have to create your own package files for Texpile to support them.

## Where to find it

1. Open a LaTeX file in the **source editor** that uses the package (`\usepackage{package name}`).
2. Open the command palette with Ctrl K (Cmd K on macOS).
3. Type in **Save Package File**, **Edit Package File**, or **Edit Global Package File**.

Folder package files are stored in the `.texpile` folder and are shared with collaborators through Git and real-time collaboration. Global package files are your own, and work in every folder.

With **Save Package File for …**, Texpile will automatically scan the `.sty` file in your TeX installation and draft one. However, in many cases, this first draft might not be reliable and will require double checking.

## An example of a package file

```json
{
	"macros": [{ "name": "reviewnote", "arg": { "format": "[]{}", "snippet": "reviewnote[${1:who}]{${2:text}}" }, "doc": "Review note" }],
	"envs": [{ "name": "reviewbox" }]
}
```

Package files use LaTeX Workshop's package format, and you can use them directly.

## Reference

| Field         | Type                         | Default          | Description                                                                                                                                              |
| ------------- | ---------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `macros`      | object[]                     | `[]`             | The package's commands. Each one takes the fields from `name` down.                                                                                      |
| `envs`        | object[]                     | `[]`             | The package's environments. Each one takes the fields from `name` down.                                                                                  |
| `keys`        | `{ "group name": string[] }` | `{}`             | Named lists of `key=value` keys, for `arg.keys` and `args`.                                                                                              |
| `args`        | string[]                     | none             | Groups from `keys` that completion offers as package options, in `\usepackage[…]`.                                                                       |
| `name`        | string                       | none             | Required. The command without its backslash, such as `"reviewnote"`, or the environment's name.                                                          |
| `arg.format`  | string, such as `"[]{}"`     | none             | Required with `arg`. The arguments in order: `[]` optional, `{}` required. The visual editor keeps them attached. `()` and `<>` work in completion only. |
| `arg.snippet` | string                       | none             | Required with `arg`. What completion inserts, without the backslash, in [snippet syntax](snippets.md#syntax-and-variables).                              |
| `arg.keys`    | string[]                     | none             | Groups from `keys` that completion offers inside the argument.                                                                                           |
| `arg.keyPos`  | number                       | `0`              | The argument that holds the keys, counted from 0.                                                                                                        |
| `detail`      | string                       | the package name | Shown beside the name in the completion list.                                                                                                            |
| `doc`         | string                       | none             | Shown in the completion list's info panel.                                                                                                               |
| `unusual`     | boolean                      | `false`          | `true` keeps the entry out of the completion list.                                                                                                       |

Comments and trailing commas are allowed.

## Errors

| Message                                                                     | Fix                                                      |
| --------------------------------------------------------------------------- | -------------------------------------------------------- |
| The file is not valid JSON: line 5, column 24 (…)                           | Fix the JSON near that line and column.                  |
| The file needs to start with { and end with }.                              | Put the contents inside one pair of braces.              |
| 2 of its entries are not in the package file format, so they were left out. | Check those entries against the [reference](#reference). |

[Snippets](snippets.md) [LaTeX source editor](latex/source-editor.md)
