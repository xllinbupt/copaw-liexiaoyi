export interface JobSpec {
  id: string;
  name: string;
  description: string;
  requirements: string;
  status?: string;
  pending_feedback_count?: number;
  created_at: string | null;
  updated_at: string | null;
}
