import type {
  AssistantContentChatMessage,
  AssistantFunctionChatMessage,
  FunctionChatMessage,
} from '../index';

export const isMsg = {
  /** Is it an assistant messsage with a function call? */
  assFunc(msg: unknown): msg is AssistantFunctionChatMessage {
    return typeof msg === 'object' && msg !== null && 'function_call' in msg;
  },
  /** Is it an assistant messsage with content? */
  assContent(msg: any): msg is AssistantContentChatMessage {
    return typeof msg === 'object' && msg !== null && msg.content != null;
  },
  /** Is it a function message? */
  function(msg: any): msg is FunctionChatMessage {
    return typeof msg === 'object' && msg !== null && msg.role === 'function';
  },
} as const;
