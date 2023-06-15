import 'dotenv/config';
import { z } from 'zod';
import { OpenAIClient } from '../index';
import { createAgent } from './agent';
import { createFunc } from './func';

const weatherFunc = createFunc({
  name: 'get_current_weather',
  description: 'Get the current weather in a given location',
  inputSchema: { location: z.string() },
  outputSchema: { temperature: z.number() },
  runInternal: async (args) => ({ temperature: 22 }),
  parameters: {
    type: 'object',
    properties: {
      location: {
        type: 'string',
        description: 'The city and state, e.g. San Francisco, CA',
      },
    },
    required: ['location'],
  },
});

const landmarkFunc = createFunc({
  name: 'get_landmark_location',
  description: 'Get the city a landmark is located in',
  inputSchema: { name: z.string() },
  outputSchema: { city: z.string() },
  runInternal: async (args) => {
    const client = new OpenAIClient();
    const { message } = await client.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'Respond with what is logged and nothing else',
        },
        {
          role: 'user',
          content: `locationOf(${args.name}) |> shape({ city: string }) |> log:format=json`,
        },
      ],
    });
    // Definitely 100% reliable
    return JSON.parse(message.content || '') as { city: string };
  },
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'The name of the landmark, e.g. Golden Gate Bridge',
      },
    },
    required: ['name'],
  },
});

(async () => {
  const query = process.argv[2];
  const agent = createAgent([weatherFunc, landmarkFunc]);
  await agent.run(query);
})();
