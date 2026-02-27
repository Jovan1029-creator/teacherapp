// src\lib\types.ts
export type UserRole = 'school_admin' | 'teacher'

export type Difficulty = 'easy' | 'medium' | 'hard'

export interface School {
  id: string
  name: string
  logo_url: string | null
  region: string | null
  district: string | null
  phone: string | null
  created_at: string
}

export interface UserProfile {
  id: string
  school_id: string
  role: UserRole
  full_name: string
  phone: string | null
  created_at: string
}

export interface Classroom {
  id: string
  school_id: string
  name: string
  year: number | null
  created_at: string
}

export interface Subject {
  id: string
  school_id: string
  name: string
  created_at: string
}

export interface TeacherSubject {
  id: string
  school_id: string
  teacher_id: string
  subject_id: string
  class_id: string
  created_at: string
  teacher?: UserProfile
  subject?: Subject
  classroom?: Classroom
}

export interface Student {
  id: string
  school_id: string
  class_id: string
  admission_no: string | null
  full_name: string
  sex: string | null
  created_at: string
  classroom?: Classroom
}

export interface Topic {
  id: string
  school_id: string
  subject_id: string
  form_level: number
  title: string
  syllabus_ref: string | null
  created_at: string
  subject?: Subject
}

export interface LessonPlan {
  id: string
  school_id: string
  teacher_id: string
  class_id: string
  subject_id: string
  topic_id: string | null
  week_no: number | null
  executed_at: string | null
  generator_fields?: Record<string, string> | null
  objectives: string | null
  introduction: string | null
  activities: string | null
  resources: string | null
  assessment: string | null
  notes: string | null
  created_at: string
  teacher?: UserProfile
  classroom?: Classroom
  subject?: Subject
  topic?: Topic | null
}

export interface Question {
  id: string
  school_id: string
  teacher_id: string | null
  subject_id: string
  topic_id: string | null
  type: string
  difficulty: Difficulty
  question_text: string
  choices: Record<string, string>
  correct_answer: string
  marks: number
  created_at: string
  topic?: Topic | null
  subject?: Subject
}

export type AiDraftQuestionType = 'mcq' | 'true_false' | 'short_answer' | 'structured' | 'essay'

export interface AiDraftMarkingSchemeItem {
  criterion?: string
  marks?: number
}

export interface AiDraftQuestion {
  question_number?: number
  question_text: string
  marks?: number
  topic_hint?: string | null
  difficulty?: Difficulty | string
  choices?: Record<string, string> | null
  answer_key?: {
    correct_option?: string | null
    correct_value?: string | null
    accepted_answers?: string[] | null
    model_answer?: string | null
  } | null
  marking_scheme?: {
    type?: string | null
    items?: AiDraftMarkingSchemeItem[] | null
    notes?: string | null
  } | null
}

export interface AiDraftSection {
  title?: string
  question_type?: AiDraftQuestionType | string
  section_instructions?: string[] | null
  questions?: AiDraftQuestion[] | null
}

export interface AiGeneratedTestDraft {
  paper_title?: string
  subject?: string
  class_level?: string
  term?: string | null
  date?: string | null
  instructions?: string[] | null
  sections?: AiDraftSection[] | null
  totals?: {
    total_questions?: number
    total_marks?: number
  } | null
}

export interface Test {
  id: string
  school_id: string
  teacher_id: string
  class_id: string
  subject_id: string
  title: string
  term: string | null
  date: string | null
  ai_draft_json?: AiGeneratedTestDraft | null
  total_marks: number
  created_at: string
  classroom?: Classroom
  subject?: Subject
}

export interface ExamTimetableEntry {
  id: string
  school_id: string
  test_id: string | null
  teacher_id: string
  class_id: string
  subject_id: string
  title: string
  term: string | null
  exam_date: string | null
  starts_at: string
  duration_minutes: number
  venue: string | null
  notes: string | null
  created_at: string
  teacher?: UserProfile
  classroom?: Classroom
  subject?: Subject
}

export interface TestQuestion {
  id: string
  test_id: string
  question_id: string
  order_no: number | null
  marks: number
  question?: Question
}

export interface Attempt {
  id: string
  test_id: string
  student_id: string
  submitted_at: string
  total_score: number
  student?: Student
  attempt_answers?: Array<{ id: string }>
}

export interface AttemptAnswer {
  id: string
  attempt_id: string
  question_id: string
  answer_text: string | null
  is_correct: boolean | null
  score: number
  question?: Question
}

export interface StudentCsvRow {
  admission_no?: string
  full_name: string
  sex?: string
}

export interface StudentMarkingInput {
  student_id: string
  answers: Record<string, string>
}

export interface TestWithQuestions extends Test {
  test_questions: Array<TestQuestion>
}

export interface TopicPerformance {
  topic_id: string
  topic_title: string
  correct_count: number
  total_count: number
  pct_correct: number
}

export interface ScoreDistributionBucket {
  bucket: string
  count: number
}

export interface ScoreTrendPoint {
  test_id: string
  test_title: string
  date: string | null
  average_score: number
}
