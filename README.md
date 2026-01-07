# Jinja2 Visualizer

A VS Code extension that helps you visualize and navigate complex nested Jinja2 Conditional blocks in your templates without modifying the source file.

## Features

- 🔍 **Visual representation** of nested Conditional blocks in Jinja2 templates
- 📊 **Indented tree view** showing the structure and nesting levels
- 🎯 **Click to navigate** - Jump directly to any block in your template
- ✨ **Non-invasive** - View logic structure without modifying your files
- 🚀 **Instant access** - Quick command to open the visualizer

Perfect for understanding complex template logic, debugging conditionals, and maintaining large Jinja2 template files.

## Usage

1. Open a Jinja2 template file (`.html`, `.jinja2`, `.j2`, or any file with Jinja2 syntax)
2. Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
3. Run the command: **"Jinja2: Open If/Else Visualizer"**
4. View the nested structure in the output panel
5. Click on any line in the visualizer to jump to that location in your template

### Example

For a template with nested conditionals like:
```jinja2
{% if user.is_authenticated %}
  {% if user.is_admin %}
    Admin dashboard
  {% elif user.is_moderator %}
    Moderator panel
  {% else %}
    User dashboard
  {% endif %}
{% else %}
  Please log in
{% endif %}
```

The visualizer displays:
```
IF user.is_authenticated (line 1)
  IF user.is_admin (line 2)
  ELIF user.is_moderator (line 4)
  ELSE (line 6)
ELSE (line 9)
```

## Requirements

- VS Code version 1.85.0 or higher
- No additional dependencies required

## Extension Settings

This extension does not add any VS Code settings. It works out of the box with the default command.

## Known Issues

- Currently only supports `if/elif/else/loops` blocks. Other Jinja2 constructs (macros, etc.) are not visualized.
- Inline if expressions are not included in the visualization.
- Complex multiline conditions are simplified in the display.

## Release Notes

### 0.0.1

Initial release of Jinja2 Visualizer
- Basic if/else/elif/loop block visualization
- Click-to-navigate functionality
- Support for nested conditionals

## Contributing

Found a bug or have a feature request? Please open an issue on the [GitHub repository](https://github.com/YOUR_USERNAME/jinja2visualiser).

## License

[MIT](LICENSE)

---

**Enjoy visualizing your Jinja2 templates!** 🎉
