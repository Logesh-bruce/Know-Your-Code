export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface QuizResult {
  total: number;
  correct: number;
  percentage: number;
  areasToReview: string[];
}