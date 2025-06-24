# Documentation

This directory contains the project's documentation files, including guides, specifications, and other relevant information.

Use `backlog doc create <title>` to add a new document. By default, files are saved here, but you can specify a subfolder with `-p <path>`.
List all documents with `backlog doc list`.

## Web Interface Documentation

The following documentation covers the Backlog.md web interface:

- **[WEB_DEVELOPMENT.md](WEB_DEVELOPMENT.md)** - Complete development guide for the React web interface
- **[API_REFERENCE.md](API_REFERENCE.md)** - Full API documentation with examples
- **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** - Common issues and solutions for the web interface

### Quick Start

Start the web server:
```bash
backlog serve
```

For development setup and contribution guidelines, see [WEB_DEVELOPMENT.md](WEB_DEVELOPMENT.md).

### Development Quality Assurance

- **[DEVELOPMENT_SAFEGUARDS.md](DEVELOPMENT_SAFEGUARDS.md)** - Safeguards to prevent import errors and compilation issues

## Configuration Options

`config.yml` supports the following keys:

- `project_name`: Name of the project
- `default_assignee`: Optional user assigned to new tasks
- `default_status`: Default status for new tasks
- `statuses`: List of allowed task statuses
- `labels`: List of available labels
- `milestones`: Project milestones
- `date_format`: Format for `created_date` values (default `yyyy-mm-dd`)

Default statuses are `To Do`, `In Progress`, and `Done`. Draft tasks live in `.backlog/drafts`.
