export enum GradeLevel {
  Grade6 = "Grade 6",
  Grade7 = "Grade 7",
  Grade8 = "Grade 8",
  Grade9 = "Grade 9",
  Grade10 = "Grade 10",
  Grade11 = "Grade 11",
  Grade12 = "Grade 12",
}

export enum Subject {
  Math = "Math",
  Physics = "Physics",
  Chemistry = "Chemistry",
  Biology = "Biology",
  History = "History",
  Geography = "Geography",
  Literature = "Literature",
  English = "English",
  ComputerScience = "Computer Science",
}

export enum QuestionType {
  MultipleChoice = "multiple_choice",
  TrueFalse = "true_false",
  ShortAnswer = "short_answer",
}

export interface Question {
  id: number;
  type: QuestionType;
  text: string;
  options?: string[]; // For MC
  correctAnswer: string; // The expected answer
}

export interface Quiz {
  title: string;
  questions: Question[];
}

export interface UserAnswer {
  questionId: number;
  answer: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  images?: string[];
}

export interface GroundingSource {
  uri: string;
  title: string;
}
