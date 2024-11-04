import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { OpenAIStream, StreamingTextResponse } from 'ai';
import { Configuration, OpenAIApi } from 'openai-edge';
import { match } from '@formatjs/intl-localematcher';
import { z } from 'zod';

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

export const runtime = 'edge';

const SYSTEM_PROMPT = `You are a helpful AI assistant that helps users find information in their documents. 
Answer questions based on the context provided. If you don't know the answer, say so - don't make up information.
Keep responses concise and relevant to the query.`;

export async function POST(req: Request) {
  const json = await req.json();
  const { messages } = json;

  const supabase = createRouteHandlerClient({ cookies });
  
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // Get relevant document chunks based on the latest message
    const { data: chunks } = await supabase.rpc('match_documents', {
      query_text: messages[messages.length - 1].content,
      user_id: session.user.id,
      match_count: 5,
    });

    const context = chunks?.map((chunk: any) => chunk.content).join('\n') || '';

    const response = await openai.createChatCompletion({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'system', content: `Context from documents:\n${context}` },
        ...messages,
      ],
      stream: true,
    });

    const stream = OpenAIStream(response);
    return new StreamingTextResponse(stream);
  } catch (error) {
    console.error('Error in chat route:', error);
    return new Response('Error processing your request', { status: 500 });
  }
}