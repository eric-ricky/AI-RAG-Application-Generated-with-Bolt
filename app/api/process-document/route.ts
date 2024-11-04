import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { Configuration, OpenAIApi } from 'openai-edge';
import * as pdfjsLib from 'pdfjs-dist';

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const { fileName, userId } = await req.json();

    // Download the file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(fileName);

    if (downloadError) throw downloadError;

    // Convert PDF to text
    const pdf = await pdfjsLib.getDocument(await fileData.arrayBuffer()).promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + ' ';
    }

    // Split text into chunks
    const chunks = [];
    let currentChunk = '';
    const words = fullText.split(' ');

    for (let i = 0; i < words.length; i++) {
      currentChunk += words[i] + ' ';
      
      if (currentChunk.length >= CHUNK_SIZE || i === words.length - 1) {
        chunks.push(currentChunk.trim());
        const overlapStart = currentChunk.split(' ')
          .slice(-CHUNK_OVERLAP)
          .join(' ');
        currentChunk = overlapStart;
      }
    }

    // Generate embeddings and store in Supabase
    for (const chunk of chunks) {
      const embedding = await openai.createEmbedding({
        model: 'text-embedding-ada-002',
        input: chunk,
      });

      const [{ embedding: vector }] = (await embedding.json()).data;

      const { error: insertError } = await supabase
        .from('document_chunks')
        .insert({
          content: chunk,
          embedding: vector,
          document_id: fileName,
          user_id: userId,
        });

      if (insertError) throw insertError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing document:', error);
    return NextResponse.json(
      { error: 'Failed to process document' },
      { status: 500 }
    );
  }
}