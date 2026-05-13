import type { InputFromMap } from '@rntme/bindings';

export type RequestSource = {
  query: URLSearchParams;
  header: (name: string) => string | null;
  body: Record<string, unknown> | null;
  form: Record<string, string> | null;
};

export type ExtractOk = { ok: true; values: Record<string, unknown> };
export type ExtractErr = { ok: false; error: { code: string; message: string; path: string } };
export type ExtractResult = ExtractOk | ExtractErr;

export function extractInputs(map: InputFromMap, req: RequestSource): ExtractResult {
  const values: Record<string, unknown> = {};

  for (const [inputName, src] of Object.entries(map)) {
    const value = extractSingle(src, req);
    if (value.ok === false) {
      // Missing & required is an error; missing & optional → null
      if (src.from !== 'body' && (src as { required?: boolean }).required === true) {
        return {
          ok: false,
          error: {
            code: 'INPUT_FROM_MISSING',
            message: `required input "${inputName}" from ${src.from} is missing`,
            path: inputName,
          },
        };
      }
      values[inputName] = null;
      continue;
    }
    values[inputName] = value.value;
  }
  return { ok: true, values };
}

function extractSingle(src: { from: 'body'; path?: string } | { from: 'bodyBytes' } | { from: 'query'; name: string } | { from: 'header'; name: string } | { from: 'form'; name: string }, req: RequestSource): { ok: true; value: unknown } | { ok: false } {
  switch (src.from) {
    case 'query': {
      const v = req.query.get(src.name);
      if (v === null) return { ok: false };
      return { ok: true, value: v };
    }
    case 'header': {
      const v = req.header(src.name);
      if (v === null || v === undefined) return { ok: false };
      return { ok: true, value: v };
    }
    case 'form': {
      if (req.form === null) return { ok: false };
      const v = req.form[src.name];
      if (v === undefined) return { ok: false };
      return { ok: true, value: v };
    }
    case 'body': {
      if (req.body === null) return { ok: false };
      if (src.path === undefined) return { ok: true, value: req.body };
      return walkPath(req.body, src.path);
    }
    case 'bodyBytes': {
      // Raw byte bodies are precomputed by the HTTP operation handler and
      // merged into graph inputs after extractInputs; extractInputs is never
      // called with a bodyBytes entry. The case exists for type exhaustiveness.
      return { ok: false };
    }
  }
}

function walkPath(obj: Record<string, unknown>, path: string): { ok: true; value: unknown } | { ok: false } {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const p of parts) {
    if (current === null || current === undefined || typeof current !== 'object') return { ok: false };
    if (!(p in (current as Record<string, unknown>))) return { ok: false };
    current = (current as Record<string, unknown>)[p];
  }
  return { ok: true, value: current };
}
