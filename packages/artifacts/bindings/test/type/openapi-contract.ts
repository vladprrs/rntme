import { generateOpenApi, type OpenApiGenOptions } from '../../src/openapi/emit.js';
import type { ValidatedBindings } from '../../src/types/artifact.js';
import type { OpenApiDoc } from '../../src/types/openapi.js';
import type { Result } from '../../src/types/result.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2)
    ? true
    : false;

type Expect<T extends true> = T;

type GenerateOpenApiFunctionContract = Expect<Equal<
  typeof generateOpenApi,
  (validated: ValidatedBindings, options?: OpenApiGenOptions) => Result<OpenApiDoc>
>>;

type GenerateOpenApiParameterContract = Expect<Equal<
  Parameters<typeof generateOpenApi>,
  [validated: ValidatedBindings, options?: OpenApiGenOptions]
>>;
