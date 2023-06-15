import type { output, ZodObject, ZodRawShape, ZodTypeAny } from 'zod';
import { z } from 'zod';
import type { ChatMessageFunction } from '../index';

type Parsed<T extends ZodRawShape | ZodTypeAny> = T extends ZodTypeAny
  ? output<T>
  : T extends ZodRawShape
  ? output<ZodObject<T>>
  : never;

const isZodType = (input: ZodRawShape | ZodTypeAny): input is ZodTypeAny => {
  return typeof input.parse === 'function';
};

export interface IFunc<Output extends any> {
  run(args: string): Promise<Output>;
  spec: ChatMessageFunction;
}

class Func<In extends ZodTypeAny, Out extends ZodTypeAny>
  implements IFunc<Parsed<Out>>
{
  constructor(
    public readonly name: string,
    public readonly description: string,
    public readonly parameters: Record<string, unknown>,
    private readonly inputSchema: In,
    private readonly outputSchema: Out,
    // TODO: pick less awful name
    private readonly runInternal: (args: Parsed<In>) => Promise<Parsed<Out>>
  ) {}

  private parseArgs(args: string): Parsed<In> {
    try {
      // TODO: use parse-json for better error messages
      const json = JSON.parse(args);
      return this.inputSchema.parse(json);
    } catch (e) {
      // @ts-ignore
      throw new Error(`Error parsing arguments: ${e.message}`);
    }
  }

  get spec(): ChatMessageFunction {
    return {
      name: this.name,
      description: this.description,
      parameters: this.parameters,
    };
  }

  async run(args: string): Promise<Parsed<Out>> {
    const parsedArgs = this.parseArgs(args);
    const val = await this.runInternal(parsedArgs);
    return this.outputSchema.parse(val);
  }
}

export function createFunc<
  In extends ZodTypeAny | ZodRawShape,
  Out extends ZodTypeAny | ZodRawShape
>(args: {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  inputSchema: In;
  outputSchema: Out;
  runInternal: (args: Parsed<In>) => Promise<Parsed<Out>>;
}): IFunc<Parsed<Out>> {
  const {
    name,
    description,
    parameters,
    inputSchema,
    outputSchema,
    runInternal,
  } = args;
  const inSchema: ZodTypeAny = isZodType(inputSchema)
    ? inputSchema
    : z.object(inputSchema);
  const outSchema: ZodTypeAny = isZodType(outputSchema)
    ? outputSchema
    : z.object(outputSchema);
  return new Func(
    name,
    description,
    parameters,
    inSchema,
    outSchema,
    runInternal
  );
}
