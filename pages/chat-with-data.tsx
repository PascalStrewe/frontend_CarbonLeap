// pages/chat-with-data.tsx
import React from 'react';
import ChatWithData from '../src/components/chat-with-data';

export default function ChatWithDataPage() {
  return (
    <div className="min-h-screen bg-[#FFF2EC] p-8">
      <h1 className="text-2xl font-bold text-[#103D5E] mb-6">Chat with Your Data</h1>
      <ChatWithData />
    </div>
  );
}