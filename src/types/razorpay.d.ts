declare module 'razorpay' {
  export interface RazorpayOrder {
    id: string
    entity: 'order'
    amount: number | string
    amount_paid: number | string
    amount_due: number | string
    currency: string
    receipt: string
    status: string
    attempts: number
    created_at: number
  }

  export interface RazorpayOrderCreateOptions {
    amount: number
    currency: string
    receipt: string
    notes?: Record<string, string>
  }

  export default class Razorpay {
    constructor(options: { key_id: string; key_secret: string })
    orders: {
      create(options: RazorpayOrderCreateOptions): Promise<RazorpayOrder>
    }
  }
}
