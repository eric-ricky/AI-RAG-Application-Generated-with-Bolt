"use client";

import { useChat } from 'ai/react';
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { Bot, FileText, Send, User } from 'lucide-react';

export default function ChatPage() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat({
      api: '/api/chat',
    });
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const supabase = createClientComponentClient();
  const router = useRouter();

  useEffect(() => {
    const fetchDocuments = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching documents:', error);
        return;
      }

      setDocuments(data || []);
    };

    fetchDocuments();
  }, [router, supabase]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  if (documents.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold">No documents found</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Upload some documents to start chatting
          </p>
          <Button
            className="mt-4"
            onClick={() => router.push('/upload')}
          >
            Upload Documents
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl h-screen py-8 flex flex-col">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Chat with Your Documents</h1>
        <p className="text-muted-foreground">
          Ask questions about your uploaded documents
        </p>
      </div>

      <div className="flex-1 flex flex-col">
        <ScrollArea
          ref={scrollAreaRef}
          className="flex-1 pr-4"
        >
          {messages.map((message, i) => (
            <div
              key={i}
              className={`flex items-start gap-4 mb-4 ${
                message.role === 'assistant'
                  ? 'bg-muted/50 p-4 rounded-lg'
                  : ''
              }`}
            >
              {message.role === 'assistant' ? (
                <Bot className="h-6 w-6 mt-1" />
              ) : (
                <User className="h-6 w-6 mt-1" />
              )}
              <div className="flex-1">
                <div className="text-sm font-medium mb-1">
                  {message.role === 'assistant' ? 'AI Assistant' : 'You'}
                </div>
                <div className="text-sm">{message.content}</div>
              </div>
            </div>
          ))}
        </ScrollArea>

        <form
          onSubmit={handleSubmit}
          className="mt-4 flex items-center gap-2"
        >
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder="Ask a question about your documents..."
            disabled={isLoading}
          />
          <Button type="submit" disabled={isLoading}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}