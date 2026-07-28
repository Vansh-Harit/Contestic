export type ContestCategory = 'Naming' | 'Content Writing' | 'Design' | 'Video Editing' | 'Others'
export type AIPolicy = 'none' | 'partial' | 'allowed'
export type ContestStatus = 'draft' | 'active' | 'judging' | 'completed' | 'cancelled'
export type SubmissionStatus = 'submitted' | 'winner' | 'not_selected'
export type PaymentStatus = 'pending' | 'captured' | 'failed' | 'refunded'
export type PayoutStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  upi_id: string | null
  created_at: string
}

export interface Contest {
  id: string
  lister_id: string
  title: string
  description: string
  public_summary: string | null
  category: ContestCategory
  prize_amount: number
  platform_fee: number
  total_charged: number
  max_entries: number
  deadline: string
  ai_policy: AIPolicy
  status: ContestStatus
  razorpay_order_id: string | null
  razorpay_payment_id: string | null
  winner_submission_id: string | null
  entry_deadline: string | null
  entry_limit: number | null
  entry_window_hours: number | null
  created_at: string
  updated_at: string
  profiles?: Profile
  submission_count?: number
  entry_count?: number
}

export interface Submission {
  id: string
  contest_id: string
  contestant_id: string
  content: string
  file_url: string | null
  status: SubmissionStatus
  submitted_at: string
  profiles?: Profile
  contests?: Contest
}

export interface Payment {
  id: string
  contest_id: string
  razorpay_order_id: string
  razorpay_payment_id: string | null
  amount: number
  platform_fee: number
  prize_amount: number
  payment_status: PaymentStatus
  payout_status: PayoutStatus
  payout_transfer_id: string | null
  created_at: string
}

export interface ContestFormData {
  title: string
  description: string
  public_summary: string
  category: ContestCategory
  prize_amount_inr: number
  max_entries: number
  deadline: string
  ai_policy: AIPolicy
  entry_window_hours: 24 | 48
  materials: Array<{ type: 'link' | 'text'; label: string; content: string }>
}

declare global {
  interface Window {
    Razorpay: any
  }
}
