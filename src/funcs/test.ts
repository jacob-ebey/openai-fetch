import 'dotenv/config';
import type { output } from 'zod';
import { z } from 'zod';
import { OpenAIClient } from '../index';
import { Agent, Task } from './lib';

const WeatherSchema = z.object({
  location: z.string(),
});
type WeatherArgs = output<typeof WeatherSchema>;
type WeatherOutput = { temperature: number };

class WeatherTask extends Task<typeof WeatherSchema, WeatherOutput> {
  public readonly name = 'get_current_weather';
  public readonly description = 'Get the current weather in a given location';
  protected readonly schema = WeatherSchema;

  protected async runInternal(args: WeatherArgs) {
    return Promise.resolve({
      temperature: 22,
    });
  }
  protected get parameters() {
    return {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'The city and state, e.g. San Francisco, CA',
        },
      },
      required: ['location'],
    };
  }
}

const LandmarkSchema = z.object({
  name: z.string(),
});
type LandmarkArgs = output<typeof LandmarkSchema>;
type LandmarkOutput = { city: string };

class LandmarkTask extends Task<typeof LandmarkSchema, LandmarkOutput> {
  public readonly name = 'get_landmark_location';
  public readonly description = 'Get the city a landmark is located in';
  protected readonly schema = LandmarkSchema;

  protected async runInternal(args: LandmarkArgs) {
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
    return JSON.parse(message.content || '') as LandmarkOutput;
  }
  protected get parameters() {
    return {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The name of the landmark, e.g. Golden Gate Bridge',
        },
      },
      required: ['name'],
    };
  }
}

(async () => {
  const query = process.argv[2];
  const agent = new Agent([new WeatherTask(), new LandmarkTask()]);
  await agent.run(query);
})();
