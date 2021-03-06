interface Options {
  ignoreExitCode?: boolean;
  encoding?: string;
  trim?: boolean;
}

export function configure(opts: Options) {
  const {
    ignoreExitCode = false, // throws on exit code != 0
    encoding = "utf-8", // null for Uint8Array or TextDecoder encoding
    trim = true, // trim string output. invalid for encoding null
  } = opts;

  const encoder = new TextEncoder();
  const decoder = new TextDecoder(encoding);

  if (encoding == null && trim) {
    throw new Error("Must specify an encoding if trim is enabled");
  }

  async function shImpl(
    args: string[],
    strings: TemplateStringsArray,
    keys: string[],
  ) {
    let command = strings[0];
    for (let i = 1; i < strings.length; i++) {
      command += keys[i - 1].toString();
      command += strings[i];
    }

    let proc = Deno.run({
      cmd: ["/bin/sh", "-c", command],
      stdin: "piped",
      stdout: "piped",
      stderr: "piped",
    });

    if (args.length > 0) {
      await proc.stdin.write(encoder.encode(args[0]));
    }

    await proc.stdin.close();
    let stdout = await proc.output();
    let { code } = await proc.status();

    if (code != 0 && !ignoreExitCode) {
      let stderr = await proc.stderrOutput();
      let decoder = new TextDecoder("utf-8");
      let error = decoder.decode(stderr).trim();
      throw new Error(`Non-zero exit code: ${code} ${error}`);
    }

    if (encoding == null) {
      return stdout;
    }

    let text = decoder.decode(stdout);
    if (trim) text = text.trim();
    await proc.stderr.close(); // fix "Too many open files error"
    await proc.close(); // fix "Too many open files error"
    return text;
  }

  return function sh(...args: any) {
    if (Array.isArray(args[0])) {
      const [strings, ...keys] = args;
      return shImpl([], strings, keys);
    } else {
      return function (strings: TemplateStringsArray, ...keys: string[]) {
        return shImpl(args, strings, keys);
      };
    }
  };
}

export default configure({});
