# Static Hints for frappe-mcp-server

This directory contains static hint files that provide supplementary context, instructions, and workflow guidance for Frappe DocTypes and workflows. These hints are specifically tailored for Large Language Model (LLM) consumption and augment the metadata retrieved dynamically via the `get_doctype_schema` tool.

## Purpose

Static hints serve several purposes:

- Provide additional, LLM-friendly context for specific Frappe DocTypes
- Describe common or complex multi-DocType workflows
- Offer guidance for modules or scenarios where standard descriptions might be insufficient
- Ensure the hint system is maintainable and easy to update

## File Structure

Each hint file in this directory should:

- Be in JSON format
- Contain an array of hint objects
- Follow the naming convention: descriptive names like `sales_hints.json`, `manufacturing_hints.json`, etc.

## Hint Schema

Each hint object should follow this structure:

For DocType hints:

```json
{
  "type": "doctype",
  "target": "Sales Order",
  "hint": "A detailed description of the DocType, its purpose, and usage guidance..."
}
```

For Workflow hints:

```json
{
  "type": "workflow",
  "target": "Create Invoice from Sales Order",
  "id": "WF-SAL-001",
  "description": "Brief description of the workflow",
  "steps": ["Step 1: Do this...", "Step 2: Then do that...", "..."],
  "related_doctypes": ["Sales Order", "Sales Invoice"]
}
```

## Adding New Hints

To add new hints:

1. Identify the DocType or workflow you want to document
2. Determine if it fits in an existing hint file or needs a new one
3. Create or update the appropriate JSON file following the schema above
4. Restart the frappe-mcp-server for the changes to take effect

## Using Hints

The static hints are automatically loaded when the server starts and are accessible through the `get_frappe_usage_info` tool, which combines DocType metadata with relevant static hints and app-provided instructions (if available).

Example usage:

```javascript
// Get information about a DocType
{
  "doctype": "Sales Order"
}

// Get information about a workflow
{
  "workflow": "Create Invoice from Sales Order"
}
```

## Maintenance

As Frappe/ERPNext evolves, these hints may need updates. The file-based approach makes it easy to maintain and version control these hints.

When updating hints:

- Focus on _how_ to use Frappe effectively
- Don't replicate basic field descriptions already available via schema introspection
- Add significant LLM-specific value that helps understand the context and relationships

## Custom App Introspection

In addition to these static hints, frappe-mcp-server now supports custom app introspection, allowing Frappe apps to provide their own usage instructions directly. This means:

1. App developers can include LLM-friendly instructions within their apps
2. Instructions can be updated with the app, rather than requiring updates to the static hints
3. App-specific knowledge can be more accurately represented

For details on implementing custom app introspection in your Frappe app, see the [Custom App Introspection documentation](../docs/custom_app_introspection.md).

When both static hints and app-provided instructions are available for a DocType, the `get_frappe_usage_info` tool will combine them to provide the most comprehensive information.
