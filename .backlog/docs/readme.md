# Documentation

This directory contains the project's documentation files, including guides, specifications, and other relevant information.

Use `backlog doc create <title>` to add a new document. By default, files are saved here, but you can specify a subfolder with `-p <path>`.
List all documents with `backlog doc list`.

## Configuration Options

`config.yml` supports the following keys:

- `project_name`: Name of the project
- `default_assignee`: Optional user assigned to new tasks
- `default_status`: Default status for new tasks
- `statuses`: List of allowed task statuses
- `labels`: List of available labels
- `milestones`: Project milestones
- `date_format`: Format for `created_date` values (default `yyyy-mm-dd`)
