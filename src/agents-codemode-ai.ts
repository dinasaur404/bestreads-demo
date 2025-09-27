type FetchLike =
  | typeof fetch
  | ((input: RequestInfo | URL, init?: RequestInit) => Promise<Response>);

type CodemodeTools = Record<string, unknown>;

type CodemodeOptions<TTools extends CodemodeTools> = {
  prompt: string;
  tools: TTools;
  globalOutbound?: { fetch: FetchLike } | { fetch: FetchLike };
  loader?: { fetch: FetchLike };
  proxy?: unknown;
};

type CodemodeResult<TTools extends CodemodeTools> = {
  prompt: string;
  tools: TTools;
};

export async function experimental_codemode<TTools extends CodemodeTools>(
  options: CodemodeOptions<TTools>,
): Promise<CodemodeResult<TTools>> {
  return {
    prompt: options.prompt,
    tools: options.tools,
  };
}

type CodeModeProxyArgs = {
  props: {
    binding: string;
    name: string;
    callback: string;
  };
};

export function CodeModeProxy(args: CodeModeProxyArgs) {
  return {
    ...args,
  };
}
