import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, MessageSquare, AlertCircle } from 'lucide-react';
import Sidebar from './Sidebar';
import { useInterventions } from '../context/InterventionContext';

interface Message {
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const EXAMPLE_QUESTIONS = [
  "How many intervention requests do I have in pending status?",
  "Show me my latest transfers",
  "What's the total GHG emission saving from my interventions?",
  "List my active partnerships",
  "Show me interventions created in the last month",
  "What's my average GHG emission saving per intervention?",
  "List my interventions with third party verification",
  "How many completed transfers do I have?",
  "Show me notifications I haven't read yet"
];

export default function ChatWithData() {
  const { interventionData, isLoading: dataLoading, error: dataError, refreshInterventions } = useInterventions();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    refreshInterventions();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const question = input.trim();
    setInput('');
    setError(null);

    const userMessage: Message = {
      type: 'user',
      content: question,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('http://localhost:3001/api/chat-with-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ question }),
      });

      if (!response.ok) {
        throw new Error('Failed to get answer');
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to get answer');
      }

      const assistantMessage: Message = {
        type: 'assistant',
        content: data.answer,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      console.error('Chat error:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuestionClick = (question: string) => {
    setInput(question);
  };

  if (dataLoading && interventionData.length === 0) {
    return (
      <div className="min-h-screen bg-[#DAE9E6] flex items-center justify-center">
        <div className="flex items-center gap-2 bg-white/50 p-4 rounded-lg">
          <Loader2 className="w-6 h-6 animate-spin text-[#103D5E]" />
          <span className="text-[#103D5E]">Loading data...</span>
        </div>
      </div>
    );
  }

  if (dataError) {
    return (
      <div className="min-h-screen bg-[#DAE9E6] flex items-center justify-center">
        <div className="flex items-center gap-2 bg-red-50 p-4 rounded-lg text-red-600">
          <AlertCircle className="w-6 h-6" />
          <span>Error loading data: {dataError}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#DAE9E6]">
      <div className="flex min-h-[calc(100vh-4rem)]">
        <Sidebar />
        <div className="flex-1 p-8">
          <div className="max-w-4xl mx-auto space-y-6">
            <div>
              <div className="flex items-center gap-2">
                <MessageSquare className="w-6 h-6 text-[#103D5E]" />
                <h1 className="text-2xl font-bold text-[#103D5E]">Chat with Your Data</h1>
              </div>
              <p className="text-[#103D5E]/70 mt-1">
                Ask questions about your interventions, transfers, partnerships, and more
              </p>
            </div>

            <div className="bg-white/25 backdrop-blur-md rounded-lg border border-white/20 p-6">
              <div className="flex flex-col space-y-4 h-[500px] overflow-y-auto p-4 bg-white/10 rounded-lg border border-white/20">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                    <MessageSquare className="w-12 h-12 text-[#103D5E]/40" />
                    <div className="space-y-2">
                      <p className="text-lg font-medium text-[#103D5E]">No messages yet</p>
                      <p className="text-sm text-[#103D5E]/70">Start by asking a question about your data</p>
                    </div>
                  </div>
                ) : (
                  messages.map((message, index) => (
                    <div key={index} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] p-4 rounded-lg ${
                        message.type === 'user'
                          ? 'bg-[#103D5E] text-white'
                          : 'bg-white/50 text-[#103D5E] border border-white/20'
                      }`}>
                        <p className="whitespace-pre-wrap">{message.content}</p>
                        <p className="text-xs opacity-70 mt-2">{message.timestamp.toLocaleTimeString()}</p>
                      </div>
                    </div>
                  ))
                )}
                {isLoading && (
                  <div className="flex justify-center">
                    <div className="flex items-center space-x-2 bg-white/50 p-4 rounded-lg border border-white/20">
                      <Loader2 className="w-4 h-4 animate-spin text-[#103D5E]" />
                      <span className="text-sm text-[#103D5E]">Thinking...</span>
                    </div>
                  </div>
                )}
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm font-medium text-red-800">Error</p>
                    <p className="text-xs text-red-700">{error}</p>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {messages.length === 0 && (
                <div className="mt-6 space-y-2">
                  <p className="text-sm font-medium text-[#103D5E]/70">Try asking:</p>
                  <div className="flex flex-wrap gap-2">
                    {EXAMPLE_QUESTIONS.map((question, index) => (
                      <button
                        key={index}
                        onClick={() => handleQuestionClick(question)}
                        className="px-4 py-2 text-sm bg-white/50 text-[#103D5E] rounded-lg border border-white/20 hover:bg-white/70 transition-all"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-6 flex space-x-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a question about your data..."
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-white/50 border border-white/20 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#103D5E] text-[#103D5E] placeholder:text-[#103D5E]/50"
                />
                <button 
                  type="submit" 
                  disabled={isLoading || !input.trim()}
                  className="px-6 py-2 bg-[#103D5E] text-white rounded-lg hover:bg-[#103D5E]/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}