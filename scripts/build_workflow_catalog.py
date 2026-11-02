#!/usr/bin/env python3
"""Turn exported NERM workflow configuration into RAG-ready Markdown.

The NERM exports are flattened configuration records, not end-user documents.
This script walks each CreateWorkflow or UpdateWorkflow through its ordered
steps, conditions, pages, forms, fields, validations, and notifications and
emits one readable Markdown document per workflow. It does not upload data or
call external services.
"""

from __future__ import annotations

import argparse
import html
import json
import re
import shutil
from collections import defaultdict
from pathlib import Path
from typing import Any, Iterable


WORKFLOW_CLASSES = {"CreateWorkflow", "UpdateWorkflow"}
GENERIC_DESCRIPTIONS = {
    "Provides the requester a page with forms",
    "Allows the requester to review",
    "Send a notification to a group of users",
    "Makes a request to a Restful API",
    "Set attribute(s) to a specific value.",
    "Changes the status of a non-employee.",
    "Runs another workflow with the ability to pass data in between.",
}
PAGE_CONTENT_CLASSES = {"FormHeading", "Paragraph", "MediumHeading"}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--create", type=Path, required=True, help="Create-workflow JSON export")
    parser.add_argument("--update", type=Path, required=True, help="Update-workflow JSON export")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("knowledge-base/uchicago-nerm/generated-workflows"),
        help="Directory for generated Markdown (default: %(default)s)",
    )
    args = parser.parse_args()

    records = read_export(args.create) + read_export(args.update)
    catalog = WorkflowCatalog(records)
    write_catalog(catalog, args.output)


def read_export(path: Path) -> list[dict[str, Any]]:
    try:
        contents = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise SystemExit(f"Export file not found: {path}") from error
    except json.JSONDecodeError as error:
        raise SystemExit(f"Invalid JSON in {path}: {error}") from error

    if not isinstance(contents, list) or not all(isinstance(item, dict) for item in contents):
        raise SystemExit(f"Expected {path} to contain a JSON array of objects.")

    return contents


class WorkflowCatalog:
    def __init__(self, records: Iterable[dict[str, Any]]) -> None:
        # Both exports repeat shared records (profile types, attributes, pages), so
        # de-duplicate by ID before indexing to avoid listing anything twice.
        unique: dict[str, dict[str, Any]] = {}
        for record in records:
            if isinstance(record.get("id"), str):
                unique.setdefault(record["id"], record)
        self.records = list(unique.values())
        self.by_id = unique

        self.steps: dict[str, list[dict[str, Any]]] = defaultdict(list)
        self.condition_actions: dict[str, list[dict[str, Any]]] = defaultdict(list)
        self.page_elements: dict[str, list[dict[str, Any]]] = defaultdict(list)
        self.form_attributes: dict[str, list[dict[str, Any]]] = defaultdict(list)
        self.validations: dict[str, list[dict[str, Any]]] = defaultdict(list)
        self.options: dict[str, list[dict[str, Any]]] = defaultdict(list)
        self.emails: dict[str, list[dict[str, Any]]] = defaultdict(list)
        self.performers: dict[str, list[dict[str, Any]]] = defaultdict(list)
        self.action_roles: dict[str, list[dict[str, Any]]] = defaultdict(list)
        self.run_configs: dict[str, list[dict[str, Any]]] = defaultdict(list)

        indexes = {
            "WorkflowStep": (self.steps, "workflow_id"),
            "WorkflowConditionAction": (self.condition_actions, "workflow_condition_id"),
            "PageElement": (self.page_elements, "page_id"),
            "FormAttribute": (self.form_attributes, "form_id"),
            "Validation": (self.validations, "ne_attribute_id"),
            "NeAttributeOption": (self.options, "ne_attribute_id"),
            "StandardEmail": (self.emails, "workflow_action_id"),
            "WorkflowActionPerformer": (self.performers, "workflow_action_id"),
            "WorkflowActionRole": (self.action_roles, "workflow_action_id"),
            "RunWorkflowActionConfiguration": (self.run_configs, "run_workflow_action_id"),
        }
        for record in self.records:
            index = indexes.get(record.get("class_name"))
            if index and isinstance(record.get(index[1]), str):
                index[0][record[index[1]]].append(record)

    @property
    def workflows(self) -> list[dict[str, Any]]:
        workflows = [
            record
            for record in self.records
            if record.get("class_name") in WORKFLOW_CLASSES and record.get("archived") is not True
        ]
        return sorted(
            workflows,
            key=lambda item: (str(item.get("name", "")).casefold(), str(item.get("id", ""))),
        )

    def name_of(self, record_id: object) -> str | None:
        record = self.by_id.get(record_id) if isinstance(record_id, str) else None
        return text(record.get("name") or record.get("label")) if record else None

    def ordered_steps(self, workflow: dict[str, Any]) -> list[dict[str, Any]]:
        return sorted(self.steps.get(workflow["id"], []), key=position)

    def condition_branch(self, condition: dict[str, Any]) -> list[dict[str, Any]]:
        links = sorted(self.condition_actions.get(condition["id"], []), key=position)
        return [self.by_id[link["workflow_action_id"]] for link in links if link.get("workflow_action_id") in self.by_id]

    def page_content(self, page: dict[str, Any]) -> list[str]:
        lines = []
        for element in sorted(self.page_elements.get(page["id"], []), key=sort_order):
            content = self.by_id.get(element.get("element_id"))
            if content and content.get("class_name") in PAGE_CONTENT_CLASSES:
                cleaned = strip_html(content.get("content"))
                if cleaned:
                    lines.append(cleaned)
        return lines

    def page_forms(self, page: dict[str, Any]) -> list[tuple[dict[str, Any], bool]]:
        forms = []
        for element in sorted(self.page_elements.get(page["id"], []), key=sort_order):
            if element.get("element_type") == "Form":
                form = self.by_id.get(element.get("element_id"))
                if form:
                    forms.append((form, element.get("read_only") is True))
        return forms

    def form_fields(self, form: dict[str, Any]) -> list[dict[str, Any]]:
        fields = []
        for form_attribute in sorted(self.form_attributes.get(form["id"], []), key=sort_order):
            if form_attribute.get("attr_type") != "ne_attribute":
                continue
            attribute = self.by_id.get(form_attribute.get("ne_attribute_id"))
            if attribute and attribute not in fields:
                fields.append(attribute)
        return fields

    def describe_field(self, attribute: dict[str, Any]) -> str:
        label = text(attribute.get("label")) or "Unnamed field"
        rules = [describe_validation(rule) for rule in self.validations.get(attribute["id"], [])]
        rules = [rule for rule in rules if rule]
        required = "Required" in rules
        rules = [rule for rule in rules if rule != "Required"]
        options = [
            text(option.get("option"))
            for option in sorted(self.options.get(attribute["id"], []), key=sort_order)
        ]

        parts = [f"**{label}**" + (" (required)" if required else "")]
        tooltip = text(attribute.get("tool_tip"))
        if tooltip:
            parts.append(tooltip)
        if any(options):
            parts.append("Options: " + ", ".join(option for option in options if option))
        if rules:
            parts.append("Rules: " + "; ".join(rules))
        return " — ".join(parts)

    def recipients(self, action: dict[str, Any]) -> list[str]:
        recipients: list[str] = []
        for performer in self.performers.get(action["id"], []):
            if performer.get("requester"):
                recipients.append("the requester")
            if performer.get("owner"):
                recipients.append("the profile owner")
            attribute = self.name_of(performer.get("contributor_attribute_id"))
            if attribute:
                recipients.append(f"the {attribute}")
            elif performer.get("contributors"):
                recipients.append("the profile contributors")
        for role in self.action_roles.get(action["id"], []):
            name = self.name_of(role.get("role_id"))
            if name:
                recipients.append(f"the {name} role")
        return list(dict.fromkeys(recipients))

    def describe_action(self, action: dict[str, Any]) -> str:
        kind = action.get("class_name")
        description = text(action.get("description"))
        detail = description if description and description not in GENERIC_DESCRIPTIONS else None
        page = self.name_of(action.get("page_id"))

        if kind == "RequestAction":
            summary = f"Requester completes the “{page}” page" if page else "Requester completes a form"
        elif kind == "ReviewAction":
            summary = f"Requester reviews and confirms the “{page}” page" if page else "Requester reviews the request"
        elif kind == "StatusChangeAction":
            summary = f"Profile status is set to {text(action.get('new_status')) or 'a new value'}"
        elif kind == "NotificationAction":
            subjects = [
                fill_placeholders(text(email.get("subject")) or text(email.get("name")))
                for email in (self.by_id.get(link.get("email_id")) for link in self.emails.get(action["id"], []))
                if email
            ]
            recipients = self.recipients(action)
            summary = "Email notification"
            if subjects:
                summary += " “" + "”, “".join(s for s in subjects if s) + "”"
            if recipients:
                summary += " sent to " + join_words(recipients)
        elif kind == "RunWorkflowAction":
            targets = [self.name_of(config.get("workflow_id")) for config in self.run_configs.get(action["id"], [])]
            targets = [target for target in targets if target]
            summary = "Runs the " + join_words(f"“{t}”" for t in targets) + " workflow" if targets else "Runs another workflow"
        else:
            summary = detail or description or text(kind) or "Workflow action"
            detail = None

        return f"{summary} ({detail})" if detail and detail != page else summary

    def referenced_pages(self, workflow: dict[str, Any]) -> list[dict[str, Any]]:
        pages: list[dict[str, Any]] = []

        def visit(action: dict[str, Any]) -> None:
            page = self.by_id.get(action.get("page_id"))
            if page and page not in pages:
                pages.append(page)

        for step in self.ordered_steps(workflow):
            target = self.by_id.get(step.get("step_id"))
            if not target:
                continue
            if step.get("step_type") == "WorkflowCondition":
                for action in self.condition_branch(target):
                    visit(action)
            else:
                visit(target)
        return pages


def write_catalog(catalog: WorkflowCatalog, output: Path) -> None:
    resolved = output.resolve()
    if resolved == Path.cwd().resolve() or resolved in Path.cwd().resolve().parents:
        raise SystemExit(f"Refusing to replace {output}: choose a dedicated output directory.")
    if output.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True)

    index_rows = []
    for workflow in catalog.workflows:
        identifier = text(workflow.get("uid")) or text(workflow.get("name")) or workflow["id"]
        filename = f"{slug(identifier)}--{workflow['id'][:8]}.md"
        (output / filename).write_text(render_workflow(catalog, workflow), encoding="utf-8")
        purpose = text(workflow.get("description"))
        index_rows.append(
            f"- [{text(workflow.get('name')) or 'Untitled workflow'}]({filename}) "
            f"— {workflow_kind(workflow)}"
            + (f": {purpose}" if purpose else "")
        )

    (output / "README.md").write_text(
        "# UChicago NERM workflow catalog\n\n"
        f"Generated {len(index_rows)} RAG-ready workflow documents from the supplied NERM exports. "
        "Generated files are derived configuration summaries, not authoritative policy text.\n\n"
        "## Workflows\n\n" + "\n".join(index_rows) + "\n",
        encoding="utf-8",
    )
    print(f"Generated {len(index_rows)} workflow documents in {output}")


def render_workflow(catalog: WorkflowCatalog, workflow: dict[str, Any]) -> str:
    name = text(workflow.get("name")) or "Untitled workflow"
    profile_type = catalog.name_of(workflow.get("profile_type_id"))
    lines = [f"# {name}", "", "## Workflow summary", ""]
    add_metadata(lines, "What it does", text(workflow.get("description")))
    add_metadata(lines, "Workflow type", workflow_kind(workflow))
    add_metadata(lines, "Applies to", f"{profile_type} profiles" if profile_type else None)
    if workflow.get("class_name") == "UpdateWorkflow":
        add_metadata(lines, "Available when the profile is", text(workflow.get("profile_status")))
    if workflow.get("bulk_import_usage") is True:
        add_metadata(lines, "Used by", "bulk CSV import")
    add_metadata(lines, "Status", text(workflow.get("status")))
    add_metadata(lines, "Workflow ID", text(workflow.get("uid")))

    step_lines = []
    for number, step in enumerate(catalog.ordered_steps(workflow), start=1):
        target = catalog.by_id.get(step.get("step_id"))
        if not target:
            continue
        if step.get("step_type") == "WorkflowCondition":
            condition = re.sub(r"^if\s+", "", text(target.get("name")) or "a condition is met", flags=re.I)
            step_lines.append(f"{number}. If {condition}:")
            for action in catalog.condition_branch(target):
                step_lines.append(f"   - {catalog.describe_action(action)}")
        else:
            step_lines.append(f"{number}. {catalog.describe_action(target)}")
    if step_lines:
        lines.extend(["", "## Steps", "", *step_lines])

    page_sections = []
    for page in catalog.referenced_pages(workflow):
        section = [f"### {text(page.get('name')) or 'Form page'}", ""]
        content = catalog.page_content(page)
        section.extend(f"> {line}" for line in content)
        if content:
            section.append("")
        for form, read_only in catalog.page_forms(page):
            fields = catalog.form_fields(form)
            if not fields:
                continue
            heading = text(form.get("name")) or "Form"
            if read_only:
                section.append(f"{heading} (shown for reference, read-only): " + ", ".join(
                    text(field.get("label")) or "Unnamed field" for field in fields
                ))
                section.append("")
            else:
                section.append(f"{heading} fields:")
                section.extend(f"- {catalog.describe_field(field)}" for field in fields)
                section.append("")
        if len(section) > 2:
            page_sections.append(section)
    if page_sections:
        lines.extend(["", "## Pages and fields", ""])
        for section in page_sections:
            lines.extend(section)

    lines.extend(
        [
            "",
            "## Source note",
            "",
            "This summary was generated from a University of Chicago NERM workflow configuration export. "
            "Confirm operational details in the live NERM application or approved UChicago documentation.",
            "",
        ]
    )
    return "\n".join(line.rstrip() for line in lines).replace("\n\n\n", "\n\n")


def describe_validation(rule: dict[str, Any]) -> str | None:
    method = rule.get("validation_method")
    value, value_two, value_three = rule.get("value"), rule.get("value_two"), rule.get("value_three")
    if method == "required":
        return "Required"
    if method == "characters" and value == "<" and value_two:
        return f"fewer than {value_two} characters"
    if method == "days" and value_two:
        if value_two == "-1" and value == ">":
            return "must be today or later" if value_three == "from today" else "must be today or earlier"
        comparison = {"<": "less than", ">": "more than"}.get(str(value), str(value))
        return f"must be {comparison} {value_two} days {value_three or 'from today'}"
    if method == "date_format" and value:
        return f"date format {value}"
    if method == "email_format":
        return "must be a valid email address"
    if method == "unique":
        return "must be unique in NERM"
    if method == "no_special_chars":
        return "no special characters"
    if method == "custom_format" and value:
        return f"must match the pattern `{value}`"
    return None


def workflow_kind(workflow: dict[str, Any]) -> str:
    return {
        "CreateWorkflow": "Create workflow (creates a new profile)",
        "UpdateWorkflow": "Update workflow (changes an existing profile)",
    }.get(str(workflow.get("class_name")), text(workflow.get("class_name")) or "Workflow")


def add_metadata(lines: list[str], label: str, value: str | None) -> None:
    if value:
        lines.append(f"- **{label}:** {value}")


def strip_html(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    value = re.sub(r'<a\s[^>]*href="([^"]+)"[^>]*>(.*?)</a>', r"\2 (\1)", value, flags=re.I | re.S)
    value = re.sub(r"<br\s*/?>", "\n", value, flags=re.I)
    value = html.unescape(re.sub(r"<[^>]+>", "", value))
    lines = [" ".join(line.split()) for line in value.splitlines()]
    return " ".join(line for line in lines if line) or None


def fill_placeholders(value: str | None) -> str | None:
    """Render NERM template tags such as {{profile.name}} as readable [profile name] markers."""
    if not value:
        return value
    return re.sub(
        r"\{\{\s*([^}]+?)\s*\}\}",
        lambda match: "[" + re.sub(r"[._]+", " ", match.group(1)) + "]",
        value,
    )


def text(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    value = " ".join(value.split())
    return value or None


def join_words(items: Iterable[str]) -> str:
    items = list(items)
    if len(items) <= 1:
        return "".join(items)
    return ", ".join(items[:-1]) + " and " + items[-1]


def position(record: dict[str, Any]) -> tuple[int, str]:
    value = record.get("position", 0)
    return (value if isinstance(value, int) else 0, str(record.get("id", "")))


def sort_order(record: dict[str, Any]) -> tuple[int, str]:
    value = record.get("order", record.get("position", 0))
    return (value if isinstance(value, int) else 0, str(record.get("id", "")))


def slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.casefold()).strip("-") or "workflow"


if __name__ == "__main__":
    main()
