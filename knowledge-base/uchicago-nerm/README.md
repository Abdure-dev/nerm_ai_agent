# UChicago NERM knowledge base

Place approved University of Chicago NERM source documents in this folder while
developing the RAG pipeline.

Examples:

- NERM user guides and FAQs
- assignment and profile workflow instructions
- approved policy documents and training material

Do not add student, employee, non-employee, or other personal records. The
source files in this directory are ignored by Git and will not be committed.

When documents are ready, the next implementation step is to validate, extract,
chunk, and index them in the Gemini Enterprise knowledge source.

## Workflow configuration exports

The supplied NERM create/update workflow exports can be transformed into
RAG-ready Markdown with:

```bash
python3 scripts/build_workflow_catalog.py \
  --create /path/to/create_workflows.json \
  --update /path/to/update_workflows.json
```

The generated summaries are written to `generated-workflows/`. They explain
workflows, their forms, fields, and configured actions; they do not replace
approved UChicago policy documents.

## Gemini Enterprise configuration

After the source documents are indexed in a Gemini Enterprise data store, add
its full resource name to `frontend/.env.local`:

```env
ENTERPRISE_RAG_DATA_STORE=projects/PROJECT_NUMBER/locations/global/collections/default_collection/dataStores/uchicago-nerm
```

The project segment is the numeric Google Cloud project number, not the project
ID. The chat service then restricts retrieval to that data store and displays
the grounded document references returned by Gemini Enterprise.
