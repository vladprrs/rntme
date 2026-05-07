# CV-extract demo fixtures

`sample-resume.pdf` — a minimal one-page fictional resume used by the integration test (`test/integration/extract.test.ts`) and by the manual e2e checklist. The PDF is hand-rolled so the repo doesn't need pandoc/wkhtmltopdf at build time. The integration test base64-encodes the bytes and passes them through a mocked OpenRouter client, so the file's real content is irrelevant to the test — only its existence and the persona staying clearly fictional matter. Replace freely as long as the file is < 200 KB and the persona is fictional.
