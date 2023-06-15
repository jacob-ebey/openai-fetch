import type { ChatMessage } from '../index';
import { OpenAIClient } from '../index';
import type { IFunc } from './func';
import { isMsg } from './is-msg';

class Agent {
  private client = new OpenAIClient();
  private messages: ChatMessage[] = [];
  private funcs: Map<string, IFunc<any>> = new Map();

  constructor(
    private readonly model: string = `gpt-3.5-turbo-0613`,
    funcs: IFunc<any>[],
    private readonly maxIterations: number = 10
  ) {
    funcs.forEach((func) => this.funcs.set(func.spec.name, func));
  }

  private logMessage(msg: ChatMessage) {
    const body = isMsg.assFunc(msg) ? msg.function_call : msg.content;
    const txt = `${msg.role}: ${isMsg.function(msg) ? `${msg.name}` : ''}`;
    console.log(`${txt} ${JSON.stringify(body)}`);
    console.log(`-----`);
  }

  private addMessage(message: ChatMessage) {
    this.messages.push(message);
    this.logMessage(message);
  }

  private async runFunc(message: ChatMessage): Promise<void> {
    if (!isMsg.assFunc(message)) throw new Error('Invalid message');
    const { name } = message.function_call;
    const func = this.funcs.get(name);
    if (!func) throw new Error(`Unknown function: ${name}`);
    const out = await func.run(message.function_call.arguments || '');
    this.addMessage({ role: 'function', name, content: JSON.stringify(out) });
  }

  private async runLLM(): Promise<ChatMessage> {
    const { message } = await this.client.createChatCompletion({
      model: this.model,
      messages: this.messages,
      functions: Array.from(this.funcs.values()).map((func) => func.spec),
    });
    this.addMessage(message);
    return message;
  }

  async run(messageContent: string) {
    // Add the initial user message
    this.addMessage({ role: 'user', content: messageContent });

    let count = 0;
    while (true) {
      // Check if we've hit the iteration limit
      if (count > this.maxIterations) {
        throw new Error('Too many iterations');
      }
      // Run the model
      const msg = await this.runLLM();
      // Break if the assistant message has content (no function call)
      if (msg.role === 'assistant' && msg.content) {
        return msg;
      }
      // Otherwise, run the function
      await this.runFunc(msg);
      count++;
    }
  }
}

export function createAgent(
  funcs: IFunc<any>[],
  opts?: {
    model?: string;
    maxIterations?: number;
  }
) {
  return new Agent(opts?.model, funcs, opts?.maxIterations);
}
