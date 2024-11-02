// src/components/example-questions.tsx
import { Button } from '@/components/ui/button';

interface ExampleQuestionsProps {
  onQuestionClick: (question: string) => void;
}

export function ExampleQuestions({ onQuestionClick }: ExampleQuestionsProps) {
  const questions = [
    "How many intervention requests do I have?",
    "Show me my latest transfers",
    "What's the total GHG emission saving from my interventions?",
    "List my active partnerships",
    "Show me interventions with pending status"
  ];

  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-500">Try asking:</p>
      <div className="flex flex-wrap gap-2">
        {questions.map((question, index) => (
          <Button
            key={index}
            variant="outline"
            size="sm"
            onClick={() => onQuestionClick(question)}
            className="text-sm"
          >
            {question}
          </Button>
        ))}
      </div>
    </div>
  );
}