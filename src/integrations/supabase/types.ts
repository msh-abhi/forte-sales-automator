export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      communication_history: {
        Row: {
          communication_type: string
          content: string
          direction: string
          external_id: string | null
          id: string
          lead_id: string
          metadata: Json | null
          sent_at: string
          subject: string | null
        }
        Insert: {
          communication_type: string
          content: string
          direction: string
          external_id?: string | null
          id?: string
          lead_id: string
          metadata?: Json | null
          sent_at?: string
          subject?: string | null
        }
        Update: {
          communication_type?: string
          content?: string
          direction?: string
          external_id?: string | null
          id?: string
          lead_id?: string
          metadata?: Json | null
          sent_at?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          created_at: string
          director_email: string
          director_first_name: string
          director_last_name: string
          director_phone_number: string | null
          discount_rate_dr: number | null
          early_bird_deadline: string | null
          ensemble_program_name: string | null
          estimated_performers: number | null
          follow_up_count: number
          form_submission_date: string
          id: string
          invoice_status: string | null
          last_communication_date: string | null
          last_email_sent_type: string | null
          last_reply_content: string | null
          last_sms_sent_type: string | null
          payment_date: string | null
          quickbooks_customer_id: string | null
          quote_sent_date: string | null
          raw_submission_data: Json | null
          reply_detected: boolean
          savings: number | null
          school_name: string | null
          season: string | null
          standard_rate_sr: number | null
          status: string
          updated_at: string
          workout_program_name: string | null
        }
        Insert: {
          created_at?: string
          director_email: string
          director_first_name: string
          director_last_name: string
          director_phone_number?: string | null
          discount_rate_dr?: number | null
          early_bird_deadline?: string | null
          ensemble_program_name?: string | null
          estimated_performers?: number | null
          follow_up_count?: number
          form_submission_date?: string
          id?: string
          invoice_status?: string | null
          last_communication_date?: string | null
          last_email_sent_type?: string | null
          last_reply_content?: string | null
          last_sms_sent_type?: string | null
          payment_date?: string | null
          quickbooks_customer_id?: string | null
          quote_sent_date?: string | null
          raw_submission_data?: Json | null
          reply_detected?: boolean
          savings?: number | null
          school_name?: string | null
          season?: string | null
          standard_rate_sr?: number | null
          status?: string
          updated_at?: string
          workout_program_name?: string | null
        }
        Update: {
          created_at?: string
          director_email?: string
          director_first_name?: string
          director_last_name?: string
          director_phone_number?: string | null
          discount_rate_dr?: number | null
          early_bird_deadline?: string | null
          ensemble_program_name?: string | null
          estimated_performers?: number | null
          follow_up_count?: number
          form_submission_date?: string
          id?: string
          invoice_status?: string | null
          last_communication_date?: string | null
          last_email_sent_type?: string | null
          last_reply_content?: string | null
          last_sms_sent_type?: string | null
          payment_date?: string | null
          quickbooks_customer_id?: string | null
          quote_sent_date?: string | null
          raw_submission_data?: Json | null
          reply_detected?: boolean
          savings?: number | null
          school_name?: string | null
          season?: string | null
          standard_rate_sr?: number | null
          status?: string
          updated_at?: string
          workout_program_name?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
