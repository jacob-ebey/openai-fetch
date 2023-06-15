import type { output, ZodTypeAny } from 'zod';
import type { ChatMessage, ChatMessageFunction } from '../index';
import { OpenAIClient } from '../index';

interface ITask<Output extends any> {
  run(args: string): Promise<Output>;
  spec: ChatMessageFunction;
}

export abstract class Task<Schema extends ZodTypeAny, Output extends any>
  implements ITask<Output>
{
  // TODO: pick less awful name
  /** Perform the task (API/LLM call, query, calculation, etc.) */
  protected abstract runInternal(args: output<Schema>): Promise<Output>;

  // TODO: auto-generate this from the schema
  /** Get the JSON schema for the task's arguments */
  protected abstract get parameters(): Record<string, unknown>;

  public abstract readonly name: string;
  public abstract readonly description: string;
  protected abstract readonly schema: Schema;

  private parseArgs(args: string): output<typeof this.schema> {
    try {
      // TODO: use parse-json for better error messages
      const json = JSON.parse(args);
      return this.schema.parse(json);
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

  async run(args: string): Promise<Output> {
    const parsedArgs = this.parseArgs(args);
    return this.runInternal(parsedArgs);
  }
}

export class Agent {
  private client = new OpenAIClient();
  private messages: ChatMessage[] = [];
  private tasks: Map<string, ITask<any>> = new Map();

  constructor(tasks: ITask<any>[] = []) {
    tasks.forEach((task) => this.tasks.set(task.spec.name, task));
  }

  private logMessage(message: ChatMessage) {
    const body =
      message.content === null ? message.function_call : message.content;
    let msg = `${message.role}: `;
    if (message.role === 'function') {
      msg += `${message.name}`;
    }
    console.log(`${msg} ${JSON.stringify(body)}`);
    console.log(`-----`);
  }

  private addMessage(message: ChatMessage) {
    this.messages.push(message);
    this.logMessage(message);
  }

  private async runTask(message: ChatMessage): Promise<ChatMessage> {
    if (message.role !== 'assistant' || message.function_call == null) {
      throw new Error('Invalid message');
    }
    const { name, arguments: args } = message.function_call;
    if (!args) {
      throw new Error('Missing arguments');
    }
    const task = this.tasks.get(name);
    if (!task) {
      throw new Error(`Unknown task: ${name}`);
    }
    const output = await task.run(args);
    const msg = {
      role: 'function',
      name,
      content: JSON.stringify(output),
    } as ChatMessage;
    this.addMessage(msg);
    return msg;
  }

  private async runLLM(): Promise<ChatMessage> {
    const { message } = await this.client.createChatCompletion({
      model: 'gpt-3.5-turbo-0613',
      messages: this.messages,
      functions: Array.from(this.tasks.values()).map((task) => task.spec),
    });
    this.addMessage(message);
    return message;
  }

  async run(messageContent: string) {
    this.addMessage({
      role: 'user',
      content: messageContent,
    });

    let count = 0;
    while (true) {
      count++;
      if (count > 10) {
        throw new Error('Too many iterations');
      }
      const msg = await this.runLLM();
      if (msg.role === 'assistant' && msg.content) {
        return msg;
      }
      await this.runTask(msg);
    }
  }
}
