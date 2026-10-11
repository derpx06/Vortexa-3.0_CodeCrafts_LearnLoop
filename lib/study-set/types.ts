/**
 * Study aids generated from a course: flashcards and a multiple-choice quiz.
 * Shared by the `/api/stages/[id]/study-set` route and the course hub pages.
 */

export interface Flashcard {
  id: string;
  front: string;
  back: string;
}

export interface StudyQuizQuestion {
  id: string;
  question: string;
  options: string[];
  /** Index into `options` of the correct answer. */
  answer: number;
  explanation?: string;
}

export interface StudySet {
  flashcards: Flashcard[];
  quiz: StudyQuizQuestion[];
  generatedAt: number;
}

/** What the course hub shows before the learner picks a mode. */
export interface CourseOverview {
  id: string;
  name: string;
  description?: string;
  isOwner: boolean;
  slideCount: number;
  sceneCount: number;
  firstSceneId?: string;
  hasStudySet: boolean;
}
